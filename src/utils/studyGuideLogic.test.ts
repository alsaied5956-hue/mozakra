import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLessonToOutline,
  moveLessonInOutline,
  removeLessonFromOutline,
  renumberStudyPages,
  splitTextIntoLocalOutlineFallback,
} from './outlineHelpers';
import {
  attachSourceContentToLessons,
  buildLessonBatches,
  computeTargetPageBudget,
  rebalanceOutlineEstimatedPages,
  splitSourceIntoSequentialChunks,
} from './chunking';
import { buildFallbackIllustrationSvg, sanitizeIllustrationSvg } from './svgSanitizer';
import {
  buildDynamicCoverVisualSvg,
  renderSceneIllustrationSvg,
} from './sceneRenderer';
import {
  buildTeacherEmblemSvg,
  DEFAULT_TEACHER_PROFILE,
  formatSubjectGrade,
  getTeacherInitials,
  inferSubjectIcon,
  SUBJECT_PRESETS,
  THEME_PALETTES,
} from './themes';
import { buildExportHtml, buildExportMarkdown } from './exportDocument';
import {
  buildImageCacheKey,
  deleteCachedImage,
  getCachedImage,
  setCachedImage,
} from './imageCache';
import { buildCoverImagePrompt, buildPageImagePrompt } from './imagePrompts';
import { OutlineLesson, StudyGuideDocument, TeacherProfile } from '../types/studyGuide';

test('DEFAULT_TEACHER_PROFILE uses clean empty strings with no hardcoded dummy teacher names', () => {
  assert.equal(DEFAULT_TEACHER_PROFILE.teacherName, '');
  assert.equal(DEFAULT_TEACHER_PROFILE.subject, '');
  assert.equal(DEFAULT_TEACHER_PROFILE.gradeLevel, '');
  assert.equal(DEFAULT_TEACHER_PROFILE.subjectGrade, '');
  assert.equal(DEFAULT_TEACHER_PROFILE.guideTitle, '');
  assert.equal(DEFAULT_TEACHER_PROFILE.detailLevel, 'balanced');
});

test('SUBJECT_PRESETS explicitly covers History and Programming alongside core subjects and custom inference', () => {
  const presetIds = SUBJECT_PRESETS.map((p) => p.id);
  assert.ok(presetIds.includes('التاريخ'));
  assert.ok(presetIds.includes('البرمجة'));
  assert.equal(inferSubjectIcon('التاريخ'), 'scroll');
  assert.equal(inferSubjectIcon('تاريخ الحضارات'), 'scroll');
  assert.equal(inferSubjectIcon('البرمجة'), 'code');
  assert.equal(inferSubjectIcon('تطوير تطبيقات بايثون'), 'code');
  assert.equal(inferSubjectIcon('المهارات الحياتية'), 'compass');
});

test('formatSubjectGrade and getTeacherInitials extract accurate Arabic values', () => {
  assert.equal(formatSubjectGrade('الأحياء', 'الثاني الثانوي'), 'الأحياء — الثاني الثانوي');
  assert.equal(formatSubjectGrade('التاريخ', ''), 'التاريخ');
  assert.equal(getTeacherInitials('أ. سارة محمود'), 'سم');
  assert.equal(getTeacherInitials('أ. طارق العلي'), 'طع');
  assert.equal(getTeacherInitials('ميس إيمان عادل'), 'إع');
  assert.equal(getTeacherInitials(''), 'م');
});

test('buildTeacherEmblemSvg produces valid SVG containing custom teacher initials and scroll/code glyphs', () => {
  const palette = THEME_PALETTES['navy-gold'];
  const historySvg = buildTeacherEmblemSvg('أ. طارق العلي', 'scroll', palette);
  assert.ok(historySvg.startsWith('<svg'));
  assert.ok(historySvg.includes('طع'));

  const codeSvg = buildTeacherEmblemSvg('م. سلمى حسن', 'code', palette);
  assert.ok(codeSvg.includes('سح'));
  assert.ok(codeSvg.includes('polyline'));
});

test('computeTargetPageBudget keeps 37-page PDF proportional (no 95-page inflation and no 4-page shortcut)', () => {
  const pages37 = Array.from({ length: 37 }, (_, idx) => `--- صفحة ${idx + 1} ---\nمحتوى الدرس رقم ${idx + 1}`).join('\n\n');

  const balanced = computeTargetPageBudget(pages37, 'balanced', 37);
  assert.equal(balanced.estimatedSourcePages, 37);
  assert.ok(balanced.minPages >= 28 && balanced.minPages <= 32);
  assert.ok(balanced.maxPages >= 42 && balanced.maxPages <= 46);
  assert.equal(balanced.targetPages, 37);

  const detailed = computeTargetPageBudget(pages37, 'detailed', 37);
  assert.ok(detailed.targetPages > 37 && detailed.targetPages <= 55);
  assert.ok(detailed.maxPages <= 60);

  const concise = computeTargetPageBudget(pages37, 'concise', 37);
  assert.ok(concise.minPages >= 18 && concise.targetPages >= 24);
  assert.ok(concise.maxPages <= 37);
});

test('rebalanceOutlineEstimatedPages prevents 95-page inflation on long multi-lesson outlines', () => {
  const inflatedLessons: OutlineLesson[] = Array.from({ length: 36 }, (_, idx) => ({
    id: `l-${idx + 1}`,
    order: idx + 1,
    title: `الدرس ${idx + 1}`,
    subtopics: ['نقطة أ', 'نقطة ب'],
    sourceExcerpt: 'ملخص',
    sourceContent: 'نص متوسط الطول '.repeat(30),
    estimatedPages: 3, // bloated raw LLM estimate (36 * 3 = 108!)
  }));

  const pages37 = Array.from({ length: 37 }, (_, idx) => `--- صفحة ${idx + 1} ---\nنص`).join('\n\n');
  const balancedBudget = computeTargetPageBudget(pages37, 'balanced', 37);
  const rebalanced = rebalanceOutlineEstimatedPages(inflatedLessons, balancedBudget, 'balanced');
  const totalEstimated = rebalanced.reduce((sum, l) => sum + l.estimatedPages, 0);

  assert.equal(totalEstimated, 36);
});

test('sanitizeIllustrationSvg strips unsafe scripts and rejects sparse SVGs while preserving rich vector scenes', () => {
  const richUnsafe =
    '```svg\n<svg viewBox="0 0 480 260"><script>alert(1)</script><rect width="480" height="260" fill="#fff"/><circle cx="50" cy="50" r="20" onclick="hack()" fill="#000" /><circle cx="90" cy="90" r="10"/><line x1="0" y1="0" x2="10" y2="10"/><path d="M0 0 L10 10"/><ellipse cx="10" cy="10" rx="5" ry="2"/></svg>\n```';
  const cleaned = sanitizeIllustrationSvg(richUnsafe);
  assert.ok(cleaned);
  assert.equal(cleaned.includes('<script'), false);
  assert.equal(cleaned.includes('onclick'), false);
  assert.ok(cleaned.includes('<circle'));
  assert.equal(sanitizeIllustrationSvg('<svg viewBox="0 0 480 260"><line x1="0" y1="0" x2="10" y2="10"/></svg>'), null);
  assert.equal(sanitizeIllustrationSvg('not an svg'), null);
});

test('renderSceneIllustrationSvg generates rich domain scenes for History battles and Programming code with XML escaping', () => {
  const palette = THEME_PALETTES['navy-gold'];

  const battleSvg = renderSceneIllustrationSvg({
    spec: {
      sceneCategory: 'history-battle',
      sceneTitle: 'معركة حطين (583 هـ)',
      sceneDescription: 'سيطرة الجيش الأيوبي على مصادر المياه وتطويق خصومه',
      charactersOrActors: ['صلاح الدين الأيوبي', '<الجيش الصليبي>'],
      visualStages: ['١. توحيد الجبهة', '٢. السيطرة على الماء', '٣. النصر وفتح القدس'],
    },
    title: 'معركة حطين',
    subject: 'التاريخ',
    subjectIcon: 'scroll',
    illustrationStyle: 'رسوم كاريكاتيرية مرحة',
    palette,
  });
  assert.ok(battleSvg.startsWith('<svg'));
  assert.ok(battleSvg.includes('&lt;الجيش الصليبي&gt;'));
  assert.ok(battleSvg.includes('صلاح الدين الأيوبي'));

  const codeSvg = renderSceneIllustrationSvg({
    spec: {
      sceneCategory: 'programming-code',
      sceneTitle: 'الجملة الشرطية if/else',
      sceneDescription: 'تنفيذ الشرط وفحص درجة الطالب في بايثون',
      charactersOrActors: ['score', 'print'],
      visualStages: ['١. إدخال الدرجة', '٢. فحص الشرط', '٣. طباعة النتيجة'],
      keyEquationOrCode: 'if score >= 60:\n    print("ناجح")',
    },
    title: 'الجمل الشرطية',
    subject: 'البرمجة',
    subjectIcon: 'code',
    illustrationStyle: 'رسوم توضيحية تخيلية مفصلة',
    palette: THEME_PALETTES['emerald-slate'],
  });
  assert.ok(codeSvg.startsWith('<svg'));
  assert.ok(codeSvg.includes('if score &gt;= 60:'));
  assert.ok(codeSvg.includes('#0F172A')); // dark code window backdrop
});

test('buildDynamicCoverVisualSvg dynamically renders cover artwork tied to subject and book topics', () => {
  const coverSvg = buildDynamicCoverVisualSvg({
    subject: 'التاريخ',
    gradeLevel: 'الثاني الثانوي',
    teacherName: 'أ. طارق العلي',
    guideTitle: 'معارك وفتوحات فاصلة',
    lessonTopics: ['معركة حطين', 'معركة عين جالوت', 'فتح القسطنطينية'],
    palette: THEME_PALETTES['navy-gold'],
  });
  assert.ok(coverSvg.startsWith('<svg'));
  assert.ok(coverSvg.includes('معركة حطين'));
  assert.ok(coverSvg.includes('معركة عين جالوت'));
});

test('buildFallbackIllustrationSvg safely escapes XML characters and varies by topic', () => {
  const svg = buildFallbackIllustrationSvg({
    title: 'الضوء <والمرايا> & العدسات',
    caption: 'مشهد كرتوني',
    subjectIcon: 'atom',
    illustrationStyle: 'رسوم كاريكاتيرية مرحة',
    palette: THEME_PALETTES['emerald-slate'],
  });
  assert.ok(svg.includes('&lt;والمرايا&gt; &amp; العدسات'));
  assert.ok(svg.includes('<svg'));
});

test('splitSourceIntoSequentialChunks preserves all 36 PDF pages in exact sequence without truncation', () => {
  const pages: string[] = [];
  for (let p = 1; p <= 36; p++) {
    pages.push(
      `--- صفحة ${p} ---\nالدرس رقم ${p}: شرح تفصيلي للموضوع العلمي رقم ${p} يتضمن تعاريف وأمثلة وتدريبات متكاملة للطلاب في هذا القسم. `.repeat(5)
    );
  }
  const fullPdfText = pages.join('\n\n');
  const chunks = splitSourceIntoSequentialChunks(fullPdfText, 6500, 'balanced', 36);

  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[chunks.length - 1].totalChunks, chunks.length);
  assert.ok(chunks[0].targetLessonCount >= 1);

  const reassembled = chunks.map((c) => c.text).join('\n\n');
  for (let p = 1; p <= 36; p++) {
    assert.ok(reassembled.includes(`--- صفحة ${p} ---`), `Missing page ${p}`);
  }

  const defaultChunks = splitSourceIntoSequentialChunks(fullPdfText, undefined, 'balanced', 36);
  assert.ok(defaultChunks.length >= 2 && defaultChunks.length <= 4);
});

test('attachSourceContentToLessons and buildLessonBatches preserve full lesson text', () => {
  const chunkText = `الدرس الأول: تركيب الخلية
تحتوي الخلية على نواة وسيتوبلازم وغشاء بلازمي يحميها.

الدرس الثاني: البلاستيدات الخضراء
تقوم البلاستيدات الخضراء بعملية البناء الضوئي لإنتاج الغذاء.`;

  const draftLessons = [
    {
      id: 'l1',
      order: 1,
      title: 'الدرس الأول: تركيب الخلية',
      subtopics: ['النواة', 'السيتوبلازم'],
      sourceExcerpt: 'مكونات الخلية',
      estimatedPages: 1,
    },
    {
      id: 'l2',
      order: 2,
      title: 'الدرس الثاني: البلاستيدات الخضراء',
      subtopics: ['البناء الضوئي'],
      sourceExcerpt: 'البناء الضوئي',
      estimatedPages: 1,
    },
  ];

  const enriched = attachSourceContentToLessons(draftLessons, chunkText, 'صفحات 1–2');
  assert.ok(enriched[0].sourceContent.includes('غشاء بلازمي'));
  assert.ok(enriched[1].sourceContent.includes('البناء الضوئي'));
  assert.equal(enriched[0].sourceRange, 'صفحات 1–2');

  const batches = buildLessonBatches(enriched, 1, 5000);
  assert.equal(batches.length, 2);
  assert.equal(batches[0][0].title, 'الدرس الأول: تركيب الخلية');
  assert.equal(batches[1][0].title, 'الدرس الثاني: البلاستيدات الخضراء');
});

test('outlineHelpers reorder, add, remove, and resequence lessons accurately', () => {
  const initial: OutlineLesson[] = [
    { id: '1', order: 1, title: 'الدرس الأول', subtopics: ['أ'], sourceExcerpt: 'أ', sourceContent: 'أ', estimatedPages: 1 },
    { id: '2', order: 2, title: 'الدرس الثاني', subtopics: ['ب'], sourceExcerpt: 'ب', sourceContent: 'ب', estimatedPages: 1 },
  ];

  const moved = moveLessonInOutline(initial, 1, 'up');
  assert.equal(moved[0].title, 'الدرس الثاني');
  assert.equal(moved[0].order, 1);
  assert.equal(moved[1].order, 2);

  const added = addLessonToOutline(moved, 'الدرس الثالث', 'فكرة 1، فكرة 2');
  assert.equal(added.length, 3);
  assert.equal(added[2].order, 3);
  assert.deepEqual(added[2].subtopics, ['فكرة 1', 'فكرة 2']);

  const removed = removeLessonFromOutline(added, '2');
  assert.equal(removed.length, 2);
  assert.equal(removed[0].order, 1);
  assert.equal(removed[1].order, 2);
});

test('splitTextIntoLocalOutlineFallback preserves lesson sequence', () => {
  const lessons = splitTextIntoLocalOutlineFallback(
    'الدرس الأول: الضوء\nيسير في خطوط مستقيمة.\nالدرس الثاني: الظل\nيتكون خلف الجسم المعتم.'
  );
  assert.equal(lessons.length, 2);
  assert.equal(lessons[0].title, 'الدرس الأول: الضوء');
  assert.equal(lessons[1].title, 'الدرس الثاني: الظل');
});

test('exportDocument generates complete HTML and Markdown with verbatim custom teacher branding and code snippets', () => {
  const profile: TeacherProfile = {
    teacherName: 'أ. سارة محمود',
    subject: 'البرمجة',
    gradeLevel: 'الثاني الثانوي',
    subjectGrade: 'البرمجة — الثاني الثانوي',
    guideTitle: 'مذكرة أساسيات بايثون',
    academicYear: '2026 / 2027',
    logoMode: 'auto',
    uploadedLogoDataUrl: null,
    subjectIcon: 'code',
    themeId: 'navy-gold',
    teachingStyle: 'أسلوب قصصي وتخيلي مبتكر',
    illustrationStyle: 'رسوم كاريكاتيرية مرحة',
    detailLevel: 'balanced',
  };

  const doc: StudyGuideDocument = {
    guideTitle: 'مذكرة أساسيات بايثون',
    outlineSummary: 'ملخص المنهج',
    coverImageUrl: 'data:image/png;base64,COVER_BASE64_SAMPLE',
    generatedAt: '2026-11-18',
    pages: renumberStudyPages([
      {
        id: 'p1',
        pageNumber: 99,
        lessonOrder: 1,
        lessonTitle: 'الجمل الشرطية في بايثون',
        pageSubtitle: 'كيف يتخذ البرنامج قراراً؟',
        explanationBlocks: [{ heading: 'شرط if', body: 'يفحص الشرط أولاً قبل التنفيذ.' }],
        codeSnippet: 'if score >= 60:\n    print("ناجح")',
        analogyTitle: 'إشارة المرور',
        analogyText: 'البرنامج ينظر إلى الشرط مثل السائق أمام الإشارة.',
        pitfallTitle: 'نسيان النقطتين',
        pitfallText: 'لا تنسَ وضع : في نهاية سطر if.',
        quickRecap: ['if تبدأ بالشرط', 'المسافة البادئة إلزامية'],
        teacherNote: 'جرّب الكود بنفسك.',
        illustrationCaption: 'توضيح كرتوني لتدفق الشرط',
        illustrationKeywords: ['بايثون', 'شروط'],
        illustrationSpec: {
          sceneCategory: 'programming-code',
          sceneTitle: 'قرار الشرط',
          sceneDescription: 'متحكم يفحص الدرجة داخل محرر الكود',
          charactersOrActors: ['score', 'print'],
          visualStages: ['١. إدخال القيمة', '٢. اختبار الشرط', '٣. الطباعة'],
          keyEquationOrCode: 'if score >= 60: print("ناجح")',
        },
        illustrationSvg: '',
        illustrationImageUrl: 'data:image/png;base64,PAGE1_BASE64_SAMPLE',
      },
    ]),
  };

  assert.equal(doc.pages[0].pageNumber, 1);
  const md = buildExportMarkdown(doc, profile);
  assert.ok(md.includes('# مذكرة أساسيات بايثون'));
  assert.ok(md.includes('أ. سارة محمود'));
  assert.ok(md.includes('صفحة 1: الجمل الشرطية في بايثون'));
  assert.ok(md.includes('if score >= 60:'));

  const html = buildExportHtml(doc, profile, THEME_PALETTES['navy-gold']);
  assert.ok(html.includes('dir="rtl"'));
  assert.ok(html.includes('dir="ltr"'));
  assert.ok(html.includes('صفحة 1'));
  assert.ok(html.includes('أ. سارة محمود'));
  assert.ok(html.includes('البرمجة — الثاني الثانوي'));
  assert.ok(html.includes('src="data:image/png;base64,COVER_BASE64_SAMPLE"'));
  assert.ok(html.includes('src="data:image/png;base64,PAGE1_BASE64_SAMPLE"'));
  assert.equal(html.includes('محمد السعيد'), false);
});

test('buildCoverImagePrompt and buildPageImagePrompt generate rich English scenes without embedded text', () => {
  const coverPrompt = buildCoverImagePrompt({
    guideTitle: 'أطلس المعارك الإسلامية',
    subject: 'التاريخ',
    gradeLevel: 'الثاني الثانوي',
    lessonTopics: ['معركة حطين', 'معركة عين جالوت'],
    illustrationStyle: 'رسوم كاريكاتيرية مرحة',
    customNote: 'خريطة وفرسان في التلال',
  });
  assert.ok(coverPrompt.includes('historical'));
  assert.ok(coverPrompt.includes('NO text'));
  assert.ok(coverPrompt.includes('خريطة وفرسان في التلال'));

  const codePrompt = buildPageImagePrompt({
    subject: 'البرمجة',
    lessonTitle: 'حلقات التكرار for',
    analogyText: 'مثل ساعي البريد الذي يمر على كل بيت في الشارع',
    illustrationStyle: 'رسوم توضيحية تخيلية مفصلة',
  });
  assert.ok(codePrompt.includes('programming'));
  assert.ok(codePrompt.includes('ZERO garbled text'));
  assert.ok(codePrompt.includes('16:9'));
});

test('imageCache stores, retrieves, and deletes base64 images deterministically', async () => {
  const key = buildImageCacheKey({
    kind: 'page',
    subject: 'العلوم',
    guideTitle: 'أسرار الضوء',
    lessonTitle: 'انكسار الضوء',
    illustrationStyle: 'رسوم كاريكاتيرية مرحة',
  });
  assert.ok(key.startsWith('img_page_'));

  await setCachedImage(key, 'data:image/png;base64,TESTDATA123');
  const fetched = await getCachedImage(key);
  assert.equal(fetched, 'data:image/png;base64,TESTDATA123');

  await deleteCachedImage(key);
  const afterDelete = await getCachedImage(key);
  assert.equal(afterDelete, null);
});
