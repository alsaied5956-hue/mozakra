import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';
const MIN_REQUEST_SPACING_MS = 4100;

type DetailLevel = 'balanced' | 'detailed' | 'concise';
type SceneCategory =
  | 'history-battle'
  | 'history-civilization'
  | 'history-timeline'
  | 'programming-flow'
  | 'programming-code'
  | 'science-optics'
  | 'science-biology'
  | 'science-physics'
  | 'science-chemistry'
  | 'math-visual'
  | 'arabic-grammar'
  | 'geography-map'
  | 'conceptual-story';

const VALID_SCENE_CATEGORIES = new Set<SceneCategory>([
  'history-battle',
  'history-civilization',
  'history-timeline',
  'programming-flow',
  'programming-code',
  'science-optics',
  'science-biology',
  'science-physics',
  'science-chemistry',
  'math-visual',
  'arabic-grammar',
  'geography-map',
  'conceptual-story',
]);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseRetryDelaySeconds(rawError: string): number | null {
  const retryDelayMatch = rawError.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (retryDelayMatch) {
    return Math.max(1, Math.ceil(Number(retryDelayMatch[1])));
  }
  const proseMatch = rawError.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (proseMatch) {
    return Math.max(1, Math.ceil(Number(proseMatch[1])));
  }
  return null;
}

function isQuotaExceededError(message: string): boolean {
  return message.includes('429') || message.includes('RESOURCE_EXHAUSTED');
}

function isTransientServerError(message: string): boolean {
  return (
    message.includes('503') ||
    message.includes('500') ||
    message.includes('UNAVAILABLE') ||
    message.includes('GEMINI_UPSTREAM_TIMEOUT')
  );
}

let pacingQueue: Promise<void> = Promise.resolve();
let lastGeminiCallAt = 0;

function scheduleGeminiRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = pacingQueue.then(async () => {
    const elapsed = Date.now() - lastGeminiCallAt;
    if (lastGeminiCallAt > 0 && elapsed < MIN_REQUEST_SPACING_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, MIN_REQUEST_SPACING_MS - elapsed)
      );
    }
    lastGeminiCallAt = Date.now();
    return fn();
  });

  // Keep queue chain healthy regardless of individual errors
  pacingQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_UPSTREAM_TIMEOUT')), timeoutMs)
    ),
  ]);
}

async function generateJsonWithRateLimitGuard(
  ai: GoogleGenAI,
  contents: string,
  timeoutMs = 45000
) {
  try {
    return await scheduleGeminiRequest(() =>
      withTimeout(
        () =>
          ai.models.generateContent({
            model: MODEL_NAME,
            contents,
            config: {
              responseMimeType: 'application/json',
            },
          }),
        timeoutMs
      )
    );
  } catch (primaryErr) {
    const primaryMsg =
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.error('[Gemini Primary Error]', primaryMsg.slice(0, 260));

    if (isQuotaExceededError(primaryMsg)) {
      const retrySec = parseRetryDelaySeconds(primaryMsg);

      // Try alternate free-tier model quota bucket first before asking client to wait
      try {
        console.info(`[Gemini Rate-Limit Fallback] Trying ${FALLBACK_MODEL} with LOW thinking`);
        return await withTimeout(
          () =>
            ai.models.generateContent({
              model: FALLBACK_MODEL,
              contents,
              config: {
                responseMimeType: 'application/json',
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            }),
          30000
        );
      } catch (fallbackErr) {
        const fallbackMsg =
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        console.error('[Gemini Fallback Error]', fallbackMsg.slice(0, 220));

        // If primary quota window resets quickly (<= 15s), wait cleanly and retry once
        if (retrySec !== null && retrySec <= 15) {
          await new Promise((resolve) => setTimeout(resolve, (retrySec + 1) * 1000));
          return await withTimeout(
            () =>
              ai.models.generateContent({
                model: MODEL_NAME,
                contents,
                config: {
                  responseMimeType: 'application/json',
                },
              }),
            timeoutMs
          );
        }

        // Surface original 429 retry metadata so client can auto-wait & resume seamlessly
        throw primaryErr;
      }
    }

    if (isTransientServerError(primaryMsg)) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return await scheduleGeminiRequest(() =>
        withTimeout(
          () =>
            ai.models.generateContent({
              model: MODEL_NAME,
              contents,
              config: {
                responseMimeType: 'application/json',
              },
            }),
          timeoutMs
        )
      );
    }

    throw primaryErr;
  }
}

function mapGeminiError(error: unknown): {
  status: number;
  message: string;
  retryAfterSeconds?: number;
  quotaExceeded?: boolean;
} {
  const raw = error instanceof Error ? error.message : String(error);
  console.error('[Gemini Error]', raw.slice(0, 320));
  if (raw.includes('GEMINI_UPSTREAM_TIMEOUT')) {
    return {
      status: 504,
      message: 'استغرقت خدمة الذكاء الاصطناعي وقتاً أطول من المعتاد للرد. يرجى المحاولة مرة أخرى.',
    };
  }
  if (raw.includes('GEMINI_API_KEY_MISSING')) {
    return {
      status: 503,
      message: 'مفتاح Gemini API غير مضبوط حالياً. يرجى ضبطه من لوحة Settings > Secrets في المنصة.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'تعذر التحقق من مفتاح Gemini API. يرجى مراجعة المفتاح في لوحة Settings > Secrets.',
    };
  }
  if (isQuotaExceededError(raw)) {
    const retryAfterSeconds = parseRetryDelaySeconds(raw) ?? 45;
    if (retryAfterSeconds > 120) {
      const hours = Math.max(1, Math.round(retryAfterSeconds / 3600));
      return {
        status: 429,
        retryAfterSeconds,
        quotaExceeded: true,
        message: `تم استنفاد حصة التوليد المجانية المؤقتة على هذا المفتاح (إعادة الضبط بعد نحو ${hours} ساعة). يمكنك المحاولة لاحقاً أو إضافة مفتاح API في Settings > Secrets.`,
      };
    }
    return {
      status: 429,
      retryAfterSeconds,
      quotaExceeded: true,
      message: `تم الوصول إلى حد الطلبات المؤقت على الخطة المجانية (١٥ طلباً في الدقيقة). يمكن الانتظار ${retryAfterSeconds} ثانية للاستكمال تلقائياً، أو تفعيل مفتاح مدفوع في Settings > Secrets لرفع الحد.`,
    };
  }
  return {
    status: 500,
    message: `حدث خطأ أثناء معالجة المحتوى بالذكاء الاصطناعي: ${raw.slice(0, 120)}`,
  };
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function stripCodeFences(code: string): string {
  return code
    .replace(/^```[a-zA-Z0-9_+-]*\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function inferServerSceneCategory(subject: string, text: string): SceneCategory {
  const combined = `${subject} ${text}`.toLowerCase();
  if (/(حرب|معرك|غزو|فتح|جيش|أسطول|معاهد|صلح|ثورة|انتصار|هزيم|قائد)/.test(combined)) {
    return 'history-battle';
  }
  if (/(تاريخ|خلافة|دولة|فرعون|حضار|عصر|قرن|مملكة|سلطان|ملك|تراث)/.test(combined)) {
    return 'history-timeline';
  }
  if (/(خوارزم|مخطط تدفق|شرط|حلقة|تكرار|دالة|متغير|مصفوف|flowchart|loop|if)/.test(combined)) {
    return 'programming-flow';
  }
  if (/(برمج|بايثون|جافا|كود|شيفرة|حاسب|html|css|python|javascript|c\+\+|programming|code)/.test(combined)) {
    return 'programming-code';
  }
  if (/(منشور|طيف|انكسار|مرآ|مرايا|انعكاس|ضوء|عدس|ظل)/.test(combined)) {
    return 'science-optics';
  }
  if (/(خلي|نواة|نبات|تمثيل ضوئ|تنفس|دم|قلب|أحياء|جهاز|ميتوكوندريا|dna|وراث)/.test(combined)) {
    return 'science-biology';
  }
  if (/(كيمياء|تفاعل|ذرة|عنصر|مركب|حمض|قاعدة|معادلة كيمي|أكسدة)/.test(combined)) {
    return 'science-chemistry';
  }
  if (/(فيزياء|قوة|حركة|سرعة|كهرباء|تيار|مغناطيس|طاقة|جهد|مقاوم)/.test(combined)) {
    return 'science-physics';
  }
  if (/(كسر|كسور|نسبة|مئوية|معادلة|مثلث|زاوية|جبر|هندس|رياضيات|تفاضل)/.test(combined)) {
    return 'math-visual';
  }
  if (/(نحو|مبتدأ|خبر|كان|إعراب|فعل|بلاغة|لغة عربية|قصيدة|أدب)/.test(combined)) {
    return 'arabic-grammar';
  }
  if (/(جغرافيا|خريطة|قارة|مناخ|تضاريس|نهر|محيط|دورة المياه)/.test(combined)) {
    return 'geography-map';
  }
  return 'conceptual-story';
}

function normalizeSceneCategory(raw: unknown, subject: string, fallbackText: string): SceneCategory {
  if (typeof raw === 'string' && VALID_SCENE_CATEGORIES.has(raw as SceneCategory)) {
    return raw as SceneCategory;
  }
  return inferServerSceneCategory(subject, fallbackText);
}

interface OutlineLessonInput {
  id: string;
  order: number;
  title: string;
  subtopics: string[];
  sourceExcerpt: string;
  sourceContent?: string;
  sourceRange?: string;
  estimatedPages: number;
}

interface TeacherProfileInput {
  teacherName: string;
  subject?: string;
  gradeLevel?: string;
  subjectGrade: string;
  guideTitle: string;
  teachingStyle: string;
  illustrationStyle: string;
  detailLevel?: DetailLevel;
}

interface PaletteInput {
  primary: string;
  primaryDark: string;
  secondary: string;
  softSurface: string;
  softBorder: string;
}

const app = express();
app.use(express.json({ limit: '15mb' }));

async function analyzeChunkWithGemini(params: {
  chunkText: string;
  chunkIndex: number;
  totalChunks: number;
  pageRangeLabel: string;
  subjectGrade: string;
  subject: string;
  teacherName: string;
  detailLevel: DetailLevel;
  chunkTargetLessons: number;
}) {
  const {
    chunkText,
    chunkIndex,
    totalChunks,
    pageRangeLabel,
    subjectGrade,
    subject,
    teacherName,
    detailLevel,
    chunkTargetLessons,
  } = params;
  const ai = getAiClient();

  const detailGuidance =
    detailLevel === 'detailed'
      ? 'النمط المختار: شرح مفصل موسّع — اجعل estimatedPages مساوياً لـ 1 للدروس العادية أو 2 للدروس الطويلة الغنية بالتفاصيل فقط (بحد أقصى 2).'
      : detailLevel === 'concise'
      ? 'النمط المختار: مركّز وواضح — اجمع الأفكار المترابطة في دروس متماسكة واجعل estimatedPages = 1 لكل درس.'
      : 'النمط المختار: متوازن ومنطقي حسب حجم الملف — حافظ على تناسب عدد الصفحات مع المصدر، اجمع الفقرات الفرعية المترابطة تحت الدرس الرئيسي لها بدلاً من تفتيتها لعشرات الدروس الصغيرة، واجعل estimatedPages = 1 لكل درس.';

  const domainHint = /تاريخ|حضار|حرب|غزو/.test(`${subject} ${subjectGrade}`)
    ? 'ملاحظة تخصصية (التاريخ): حافظ على التسلسل الزمني والتواريخ وأسماء القادة والأحداث والمعارك والأسباب والنتائج.'
    : /برمج|حاسب|بايثون|كود/.test(`${subject} ${subjectGrade}`)
    ? 'ملاحظة تخصصية (البرمجة): حافظ على تسلسل المفاهيم البرمجية والأكواد والأمثلة التطبيقية.'
    : '';

  const response = await generateJsonWithRateLimitGuard(
    ai,
    `أنت خبير مناهج ومصمم تعليمي عربي. حلل هذا الجزء من المادة الدراسية (${pageRangeLabel || `الجزء ${chunkIndex + 1} من ${totalChunks}`}) لاستخراج الدروس والمحاور المتكاملة بنفس التسلسل الأصلي للمصدر.

تعليمات صارمة للتوازن والشمول:
- حافظ على جميع الموضوعات والأفكار الرئيسية في هذا الجزء دون حذف أو قفز.
- يُمنع التضخم المبالغ فيه (لا تفتّت الفقرات المترابطة إلى 8 دروس صغيرة متناثرة)، ويُمنع الاختصار المخل (لا تدمج المنهج كله في لمحة واحدة).
- العدد المستهدف التقريبي للدروس المتماسكة في هذا الجزء: نحو ${Math.max(1, chunkTargetLessons)} إلى ${Math.max(2, chunkTargetLessons + 1)} دروس متوازنة (أو حسب عدد الدروس الرئيسية الفعلية في النص).
- لا تخترع أسماء معلمين من عندك.
${detailGuidance}
${domainHint}

بيانات المذكرة:
${teacherName ? `- المعلم: ${teacherName}` : ''}
${subjectGrade ? `- المادة والصف: ${subjectGrade}` : ''}
- موضع الجزء: ${chunkIndex + 1} من ${totalChunks} (${pageRangeLabel})

النص المصدري لهذا الجزء:
"""
${chunkText}
"""

المطلوب بصيغة JSON فقط:
{
  "suggestedTitle": "${chunkIndex === 0 ? 'عنوان جذاب ومبتكر للمذكرة بالعربية' : ''}",
  "summary": "وصف موجز من جملة إلى جملتين لموضوعات هذا الجزء",
  "lessons": [
    {
      "order": 1,
      "title": "عنوان الدرس أو القسم كما يرد في المصدر",
      "subtopics": ["نقطة فرعية 1", "نقطة فرعية 2", "نقطة فرعية 3"],
      "sourceExcerpt": "ملخص علمي مركز للمادة الواردة في هذا الدرس",
      "estimatedPages": 1
    }
  ]
}`
  );

  const parsed = JSON.parse(stripJsonFences(response.text ?? '{}')) as {
    suggestedTitle?: string;
    summary?: string;
    lessons?: Array<{
      order?: number;
      title?: string;
      subtopics?: string[];
      sourceExcerpt?: string;
      estimatedPages?: number;
    }>;
  };

  const maxEstPages = detailLevel === 'detailed' ? 2 : 1;
  const lessons = (parsed.lessons ?? []).map((lesson, idx) => ({
    id: `lesson-${Date.now()}-${chunkIndex}-${idx + 1}`,
    order: idx + 1,
    title: lesson.title?.trim() || `القسم ${idx + 1} (${pageRangeLabel})`,
    subtopics:
      Array.isArray(lesson.subtopics) && lesson.subtopics.length > 0
        ? lesson.subtopics
        : ['المفهوم الأساسي'],
    sourceExcerpt: lesson.sourceExcerpt?.trim() || '',
    sourceRange: pageRangeLabel,
    estimatedPages:
      lesson.estimatedPages && lesson.estimatedPages >= 2 && maxEstPages >= 2 ? 2 : 1,
  }));

  return {
    suggestedTitle: parsed.suggestedTitle?.trim() || '',
    summary: parsed.summary?.trim() || '',
    lessons,
  };
}

app.post('/api/analyze-outline-chunk', async (req: Request, res: Response) => {
  try {
    const {
      chunkText,
      chunkIndex = 0,
      totalChunks = 1,
      pageRangeLabel = '',
      subjectGrade = '',
      subject = '',
      teacherName = '',
      detailLevel = 'balanced',
      chunkTargetLessons = 2,
    } = req.body as {
      chunkText?: string;
      chunkIndex?: number;
      totalChunks?: number;
      pageRangeLabel?: string;
      subjectGrade?: string;
      subject?: string;
      teacherName?: string;
      detailLevel?: DetailLevel;
      chunkTargetLessons?: number;
    };

    if (!chunkText || chunkText.trim().length < 15) {
      res.status(400).json({
        error: 'النص في هذا الجزء قصير جداً أو فارغ.',
      });
      return;
    }

    const result = await analyzeChunkWithGemini({
      chunkText: chunkText.trim(),
      chunkIndex,
      totalChunks,
      pageRangeLabel: pageRangeLabel || `الجزء ${chunkIndex + 1}`,
      subjectGrade: subjectGrade.trim(),
      subject: subject.trim(),
      teacherName: teacherName.trim(),
      detailLevel,
      chunkTargetLessons: Math.max(1, Math.min(6, Number(chunkTargetLessons) || 2)),
    });

    if (result.lessons.length === 0) {
      res.status(422).json({
        error: `لم نتمكن من استخراج موضوعات واضحة في ${pageRangeLabel || `الجزء ${chunkIndex + 1}`}.`,
      });
      return;
    }

    res.json(result);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

app.post('/api/analyze-outline', async (req: Request, res: Response) => {
  try {
    const {
      rawText,
      subjectGrade = '',
      subject = '',
      teacherName = '',
      detailLevel = 'balanced',
    } = req.body as {
      rawText?: string;
      subjectGrade?: string;
      subject?: string;
      teacherName?: string;
      detailLevel?: DetailLevel;
    };

    if (!rawText || rawText.trim().length < 20) {
      res.status(400).json({
        error: 'يرجى إدخال نص تعليمي لا يقل عن ٢٠ حرفاً ليتم تحليله واستخراج الدروس.',
      });
      return;
    }

    const result = await analyzeChunkWithGemini({
      chunkText: rawText.trim(),
      chunkIndex: 0,
      totalChunks: 1,
      pageRangeLabel: 'النص الكامل',
      subjectGrade: subjectGrade.trim(),
      subject: subject.trim(),
      teacherName: teacherName.trim(),
      detailLevel,
      chunkTargetLessons: 3,
    });

    if (result.lessons.length === 0) {
      res.status(422).json({
        error: 'لم نتمكن من تحديد دروس واضحة في النص. تأكد من وضوح العناوين أو أضف مزيداً من التفاصيل.',
      });
      return;
    }

    res.json({
      suggestedTitle: result.suggestedTitle || 'مذكرة التفوق الإبداعية',
      summary: result.summary || 'مذكرة تعليمية مبسطة ومنظمة بأسلوب حديث.',
      lessons: result.lessons.map((l) => ({
        ...l,
        sourceContent: rawText.trim(),
      })),
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

function buildDomainPedagogyInstructions(subjectText: string): string {
  const s = subjectText.toLowerCase();
  if (/(تاريخ|حضار|حرب|غزو|دول|خلافة|عصر|history)/.test(s)) {
    return `توجيه تخصصي لمادة التاريخ:
- التزم بدقة التواريخ الهجرية/الميلادية وأسماء القادة والشخصيات والمعارك المذكورة في النص المصدري.
- رتّب الشرح في تسلسل منطقي واضح: (الخلفية والأسباب ← مجريات الأحداث والخطة ← النتائج والدروس المستفادة).
- اجعل illustrationSpec من الفئة "history-battle" للمعارك والحروب والفتوحات، أو "history-timeline" للتسلسل الزمني، أو "history-civilization" للحضارات والآثار، واكتب وصفاً لمشهد قصصي حي يضم القادة أو العناصر التاريخية المذكورة.`;
  }
  if (/(برمج|حاسب|كود|بايثون|جافا|خوارزم|programming|code|python|javascript)/.test(s)) {
    return `توجيه تخصصي لمادة البرمجة والحاسب:
- إذا تضمن الدرس مثالاً برمجياً أو بناء جملة (Syntax)، أضف حقل "codeSnippet" يحتوي على مثال كود نظيف ومرتب باللغة الإنجليزية (دون علامات \`\`\`) يوضح الفكرة عملياً، واشرح ماذا يفعل سطراً بسطر في explanationBlocks.
- ركّز في pitfallText على الأخطاء البرمجية الشائعة (مثل النسيان النقطتين : أو المسافة البادئة أو علامات المقارنة = مقابل ==).
- اجعل illustrationSpec من الفئة "programming-code" أو "programming-flow" واذكر عناصر الشيفرة ومخرجاتها في visualStages.`;
  }
  return `توجيه تخصصي للمادة الدراسية (${subjectText || 'المادة'}):
- حوّل النص المصدري إلى شرح تربوي مبتكر يسهل على الطالب فهمه وحفظه دون حشو أو اختصار مخل.
- اختر أنسب sceneCategory في illustrationSpec لموضوع الصفحة تحديداً (science-optics / science-biology / science-physics / science-chemistry / math-visual / arabic-grammar / geography-map / conceptual-story).`;
}

async function generateLessonBatch(params: {
  ai: GoogleGenAI;
  lessons: OutlineLessonInput[];
  teacherProfile: TeacherProfileInput;
  palette: PaletteInput;
  detailLevel: DetailLevel;
}) {
  const { ai, lessons, teacherProfile, detailLevel } = params;
  const maxPagesPerLesson = detailLevel === 'detailed' ? 2 : 1;

  const lessonsPrompt = lessons
    .map((l) => {
      const fullLessonSource = (l.sourceContent || l.sourceExcerpt || l.title).trim();
      const targetPageCount = Math.max(
        1,
        Math.min(maxPagesPerLesson, Number(l.estimatedPages) || 1)
      );
      return `=== الدرس رقم ${l.order}: ${l.title} ===
النطاق في المصدر: ${l.sourceRange || 'تسلسل المنهج'}
عدد الصفحات المطلوب لهذا الدرس بالضبط: ${targetPageCount} صفحة
العناصر الفرعية: ${l.subtopics.join(' | ')}
النص المصدري الكامل لهذا الدرس:
"""
${fullLessonSource}
"""`;
    })
    .join('\n\n');

  const subjectContext =
    teacherProfile.subject || teacherProfile.subjectGrade || '';
  const domainInstructions = buildDomainPedagogyInstructions(subjectContext);

  const response = await generateJsonWithRateLimitGuard(
    ai,
    `أنت مؤلف تربوي مبدع ومصمم مشاهد تعليمية. مهمتك تحويل الدروس التالية إلى صفحات مذكرة دراسية غنية ومبتكرة ومتوازنة الطول، تحافظ على تسلسل المادة العلمية وجميع مفاهيمها الأساسية دون تضخم مبالغ فيه ودون اختصار مخل.

تحذير صارم:
- التزم بعدد الصفحات المحدد لكل درس أعلاه (${maxPagesPerLesson === 1 ? 'صفحة واحدة متكاملة ومتوازنة لكل درس' : '١ إلى ٢ صفحة حسب المحدد لكل درس'}). يُمنع توليد صفحات زائدة أو حشو مكرر.
- التزم بتغطية كل فكرة ومعلومة أساسية وردت في النص المصدري الخاص بكل درس، وأعد صياغتها بأسلوب تربوي جديد واضح ومشوق للطلاب.
- كل صفحة يجب أن تحتوي على محتوى فريد مستمد مباشرة من الدرس الخاص بها.
- لا تذكر أو تخترع أي اسم معلم غير المذكور في بيانات المعلم أدناه.

${domainInstructions}

بيانات المذكرة:
${teacherProfile.teacherName.trim() ? `- اسم المعلم: ${teacherProfile.teacherName.trim()}` : ''}
${teacherProfile.subjectGrade.trim() ? `- المادة والصف: ${teacherProfile.subjectGrade.trim()}` : ''}
${teacherProfile.guideTitle.trim() ? `- عنوان المذكرة: ${teacherProfile.guideTitle.trim()}` : ''}
- الأسلوب التربوي المطلوب: ${teacherProfile.teachingStyle}
- نمط الرسوم المطلوب: ${teacherProfile.illustrationStyle}

الدروس المطلوب تحويلها في هذه الدفعة:
${lessonsPrompt}

قواعد صارمة لكل صفحة في مصفوفة pages:
1. lessonOrder: الرقم الترتيبي للدرس (${lessons.map((l) => l.order).join('، ')}).
2. lessonTitle: عنوان واضح للدرس (وإذا انقسم الدرس لصفحتين أضف "(الجزء ١)" ثم "(الجزء ٢)").
3. pageSubtitle: عنوان فرعي مشوق ومرتبط بالدرس.
4. explanationBlocks: من ٢ إلى ٣ فقرات شرح متكاملة ومفيدة تغطي النص المصدري للدرس دون حذف.
5. codeSnippet: (لمادة البرمجة/الحاسب فقط إذا كان الدرس يحتوي على كود) مثال كود برمجي نظيف متعدد الأسطر، وإلا اتركه سلسلة فارغة "".
6. analogyTitle و analogyText: فقرة "معلومة بصورة / تشبيه تخيلي" تقرّب المفهوم بمشهد ملموس.
7. pitfallTitle و pitfallText: فقرة "تنبيه مهم / فخ بيقع فيه الطلاب" تحذر من خطأ شائع في هذا الدرس.
8. quickRecap: مصفوفة من ٣ نقاط مركزة تمثل "خلاصة سريعة".
9. illustrationCaption: وصف مختصر وجذاب للمشهد التوضيحي بالصفحة.
10. illustrationSpec: مواصفات دلالية دقيقة لتكوين المشهد التوضيحي الكرتوني/المفاهيمي (يُمنع كتابة نقاط عشوائية، ركّز على القصة والمشهد الفعلي للدرس):
   - sceneCategory: إحدى القيم الدقيقة التالية فقط:
     "history-battle" | "history-civilization" | "history-timeline" | "programming-flow" | "programming-code" | "science-optics" | "science-biology" | "science-physics" | "science-chemistry" | "math-visual" | "arabic-grammar" | "geography-map" | "conceptual-story"
   - sceneTitle: عنوان قصير داخل المشهد (٢-٥ كلمات).
   - sceneDescription: وصف حيّ من جملة واحدة يصف ماذا يحدث في المشهد (شخصيات/قادة/أدوات/كود).
   - charactersOrActors: مصفوفة من ٢ إلى ٣ عناصر تمثل الشخصيات أو الأطراف الفاعلة في المشهد (مثل ["صلاح الدين", "بحيرة طبرية"] أو ["متغير score", "جملة if"]).
   - visualStages: مصفوفة من ٣ مراحل بصرية متسلسلة من اليمين لليسار (كل مرحلة ٢-٤ كلمات).
   - keyEquationOrCode: معادلة أو تاريخ أو سطر كود قصير إن وُجد (اختياري).

أرجع النتيجة بصيغة JSON فقط بهذا الهيكل:
{
  "pages": [
    {
      "lessonOrder": 1,
      "lessonTitle": "عنوان الدرس",
      "pageSubtitle": "عنوان فرعي مشوق",
      "explanationBlocks": [{ "heading": "عنوان الفقرة", "body": "نص الشرح الوافي" }],
      "codeSnippet": "",
      "analogyTitle": "عنوان التشبيه",
      "analogyText": "نص التشبيه التخيلي",
      "pitfallTitle": "عنوان الفخ الشائع",
      "pitfallText": "نص التنبيه المهم",
      "quickRecap": ["نقطة ١", "نقطة ٢", "نقطة ٣"],
      "illustrationCaption": "تعليق تحت الرسم",
      "illustrationKeywords": ["كلمة١", "كلمة٢"],
      "illustrationSpec": {
        "sceneCategory": "conceptual-story",
        "sceneTitle": "عنوان المشهد",
        "sceneDescription": "وصف دقيق للمشهد التوضيحي",
        "charactersOrActors": ["العنصر الأول", "العنصر الثاني"],
        "visualStages": ["١. البداية", "٢. الحدث", "٣. النتيجة"],
        "keyEquationOrCode": ""
      }
    }
  ]
}`,
    60000
  );

  const parsed = JSON.parse(stripJsonFences(response.text ?? '{}')) as {
    pages?: Array<Record<string, unknown>>;
  };
  return parsed.pages ?? [];
}

function normalizeBatchPages(
  rawPages: Array<Record<string, unknown>>,
  batchLessons: OutlineLessonInput[],
  detailLevel: DetailLevel,
  subjectContext: string
) {
  const maxPagesPerLesson = detailLevel === 'detailed' ? 2 : 1;
  const maxBatchPages = batchLessons.reduce(
    (sum, l) =>
      sum + Math.max(1, Math.min(maxPagesPerLesson, Number(l.estimatedPages) || 1)),
    0
  );

  // Enforce proportional page cap so LLM never inflates pages beyond budget
  const boundedPages = rawPages.slice(0, Math.max(batchLessons.length, maxBatchPages));

  return boundedPages.map((rawPage, idx) => {
    const matchedLesson =
      batchLessons.find((l) => l.order === Number(rawPage.lessonOrder)) ??
      batchLessons[Math.min(idx, batchLessons.length - 1)];

    const blocks = Array.isArray(rawPage.explanationBlocks)
      ? (rawPage.explanationBlocks as Array<{ heading?: string; body?: string }>)
          .map((b) => ({
            heading: b.heading?.trim() || 'الفكرة الرئيسية',
            body: b.body?.trim() || '',
          }))
          .filter((b) => b.body.length > 0)
      : [];

    const safeBlocks =
      blocks.length > 0
        ? blocks
        : [
            {
              heading: 'الشرح المبسط للدرس',
              body:
                matchedLesson?.sourceContent ||
                matchedLesson?.sourceExcerpt ||
                matchedLesson?.title ||
                '',
            },
          ];

    const recap = Array.isArray(rawPage.quickRecap)
      ? (rawPage.quickRecap as string[]).map((s) => String(s).trim()).filter(Boolean)
      : [];

    const lessonTitle = String(
      rawPage.lessonTitle || matchedLesson?.title || `الدرس ${idx + 1}`
    );

    const rawSpec = (rawPage.illustrationSpec ?? {}) as Record<string, unknown>;
    const actors = Array.isArray(rawSpec.charactersOrActors)
      ? (rawSpec.charactersOrActors as unknown[]).map((a) => String(a).trim()).filter(Boolean).slice(0, 3)
      : [];
    const stages = Array.isArray(rawSpec.visualStages)
      ? (rawSpec.visualStages as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
      : [];

    const rawCode =
      typeof rawPage.codeSnippet === 'string' ? stripCodeFences(rawPage.codeSnippet) : '';

    const sceneCategory = normalizeSceneCategory(
      rawSpec.sceneCategory,
      subjectContext,
      `${lessonTitle} ${safeBlocks.map((b) => b.body).join(' ')}`
    );

    return {
      id: `page-${Date.now()}-${matchedLesson?.order ?? idx + 1}-${idx + 1}`,
      pageNumber: idx + 1,
      lessonOrder: Number(rawPage.lessonOrder) || matchedLesson?.order || idx + 1,
      lessonTitle,
      pageSubtitle: String(rawPage.pageSubtitle || ''),
      explanationBlocks: safeBlocks,
      codeSnippet: rawCode || undefined,
      analogyTitle: String(rawPage.analogyTitle || 'تشبيه من حياتنا اليومية'),
      analogyText: String(rawPage.analogyText || ''),
      pitfallTitle: String(rawPage.pitfallTitle || 'انتبه لهذا الخطأ الشائع'),
      pitfallText: String(rawPage.pitfallText || ''),
      quickRecap: recap.length > 0 ? recap : ['مراجعة المفهوم الأساسي للدرس'],
      teacherNote: '',
      illustrationCaption: String(
        rawPage.illustrationCaption || `مشهد توضيحي: ${matchedLesson?.title || lessonTitle}`
      ),
      illustrationKeywords: Array.isArray(rawPage.illustrationKeywords)
        ? (rawPage.illustrationKeywords as string[])
        : [],
      illustrationSpec: {
        sceneCategory,
        sceneTitle: String(rawSpec.sceneTitle || lessonTitle),
        sceneDescription: String(
          rawSpec.sceneDescription ||
            rawPage.illustrationCaption ||
            `رسم تعليمي يشرح ${lessonTitle}`
        ),
        charactersOrActors: actors.length > 0 ? actors : [lessonTitle],
        visualStages:
          stages.length >= 3
            ? stages
            : ['١. المفهوم الأساسي', '٢. التطبيق والمقارنة', '٣. الخلاصة'],
        keyEquationOrCode:
          typeof rawSpec.keyEquationOrCode === 'string' && rawSpec.keyEquationOrCode.trim()
            ? rawSpec.keyEquationOrCode.trim()
            : rawCode || undefined,
      },
      illustrationSvg: '',
      illustrationStatus: 'idle' as const,
    };
  });
}

app.post('/api/generate-batch', async (req: Request, res: Response) => {
  try {
    const {
      lessons,
      teacherProfile,
      palette,
      detailLevel = 'balanced',
    } = req.body as {
      lessons?: OutlineLessonInput[];
      teacherProfile?: TeacherProfileInput;
      palette?: PaletteInput;
      detailLevel?: DetailLevel;
    };

    if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
      res.status(400).json({ error: 'لا توجد دروس في هذه الدفعة لتوليدها.' });
      return;
    }

    if (!teacherProfile || !palette) {
      res.status(400).json({ error: 'بيانات المعلم أو الألوان غير مكتملة.' });
      return;
    }

    const effectiveDetailLevel: DetailLevel =
      detailLevel || teacherProfile.detailLevel || 'balanced';
    const subjectContext =
      teacherProfile.subject || teacherProfile.subjectGrade || '';

    const ai = getAiClient();
    const rawPages = await generateLessonBatch({
      ai,
      lessons,
      teacherProfile,
      palette,
      detailLevel: effectiveDetailLevel,
    });

    const pages = normalizeBatchPages(
      rawPages,
      lessons,
      effectiveDetailLevel,
      subjectContext
    );
    if (pages.length === 0) {
      res.status(422).json({
        error: 'لم يُرجع نموذج التوليد صفحات صالحة لهذه الدفعة. يرجى إعادة المحاولة.',
      });
      return;
    }

    res.json({ pages });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

app.post('/api/generate-guide', async (req: Request, res: Response) => {
  try {
    const {
      outline,
      rawText,
      teacherProfile,
      palette,
      detailLevel = 'balanced',
    } = req.body as {
      outline?: OutlineLessonInput[];
      rawText?: string;
      teacherProfile?: TeacherProfileInput;
      palette?: PaletteInput;
      detailLevel?: DetailLevel;
    };

    if (!outline || !Array.isArray(outline) || outline.length === 0) {
      res.status(400).json({ error: 'الفهرس فارغ. يرجى تحليل المحتوى أو إضافة درس واحد على الأقل.' });
      return;
    }

    if (!teacherProfile || !palette) {
      res.status(400).json({ error: 'بيانات المعلم أو الألوان غير مكتملة.' });
      return;
    }

    const effectiveDetailLevel: DetailLevel =
      detailLevel || teacherProfile.detailLevel || 'balanced';
    const subjectContext =
      teacherProfile.subject || teacherProfile.subjectGrade || '';

    const ai = getAiClient();
    const enrichedOutline = outline.map((l) => ({
      ...l,
      sourceContent: l.sourceContent || l.sourceExcerpt || rawText || l.title,
    }));

    const chunks: OutlineLessonInput[][] = [];
    for (let i = 0; i < enrichedOutline.length; i += 2) {
      chunks.push(enrichedOutline.slice(i, i + 2));
    }

    const allPages = [];
    for (const chunk of chunks) {
      const rawPages = await generateLessonBatch({
        ai,
        lessons: chunk,
        teacherProfile,
        palette,
        detailLevel: effectiveDetailLevel,
      });
      allPages.push(
        ...normalizeBatchPages(rawPages, chunk, effectiveDetailLevel, subjectContext)
      );
    }

    res.json({
      pages: allPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })),
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

app.post('/api/regenerate-illustration', async (req: Request, res: Response) => {
  try {
    const {
      lessonTitle,
      explanationSummary,
      analogyText,
      subject = '',
      illustrationStyle,
      palette,
      customNote,
    } = req.body as {
      lessonTitle?: string;
      explanationSummary?: string;
      analogyText?: string;
      subject?: string;
      illustrationStyle?: string;
      palette?: PaletteInput;
      customNote?: string;
    };

    if (!lessonTitle || !palette) {
      res.status(400).json({ error: 'بيانات الصفحة غير كافية لإعادة توليد الرسم.' });
      return;
    }

    const ai = getAiClient();

    const response = await generateJsonWithRateLimitGuard(
      ai,
      `صمّم مواصفات مشهد توضيحي جديد ومبتكر لصفحة في مذكرة دراسية بأسلوب "${illustrationStyle || 'رسوم كاريكاتيرية مرحة'}".

- المادة الدراسية: ${subject || 'عام'}
- عنوان الدرس: ${lessonTitle}
- ملخص الشرح: ${explanationSummary || ''}
- التشبيه التخيلي: ${analogyText || ''}
- توجيه المعلم الخاص للمشهد الجديد: ${customNote || 'اقترح زاوية بصرية جديدة ومبتكرة توضح الفكرة'}

أرجع JSON فقط بهذا الهيكل الدقيق:
{
  "illustrationCaption": "تعليق عربي جذاب يوضح فكرة المشهد الجديد",
  "illustrationSpec": {
    "sceneCategory": "إحدى القيم: history-battle | history-civilization | history-timeline | programming-flow | programming-code | science-optics | science-biology | science-physics | science-chemistry | math-visual | arabic-grammar | geography-map | conceptual-story",
    "sceneTitle": "عنوان المشهد (٢-٥ كلمات)",
    "sceneDescription": "وصف دقيق وحي للمشهد الجديد وما يظهر فيه من شخصيات أو أدوات أو كود",
    "charactersOrActors": ["شخصية أو عنصر ١", "شخصية أو عنصر ٢"],
    "visualStages": ["١. البداية", "٢. التحول أو الحدث", "٣. النتيجة"],
    "keyEquationOrCode": "اختياري: معادلة أو سطر كود أو تاريخ محوري"
  }
}`
    );

    const parsed = JSON.parse(stripJsonFences(response.text ?? '{}')) as {
      illustrationCaption?: string;
      illustrationSpec?: Record<string, unknown>;
    };

    const rawSpec = parsed.illustrationSpec ?? {};
    const sceneCategory = normalizeSceneCategory(
      rawSpec.sceneCategory,
      subject,
      `${lessonTitle} ${explanationSummary || ''} ${customNote || ''}`
    );

    const actors = Array.isArray(rawSpec.charactersOrActors)
      ? (rawSpec.charactersOrActors as unknown[]).map((a) => String(a).trim()).filter(Boolean).slice(0, 3)
      : [lessonTitle];
    const stages = Array.isArray(rawSpec.visualStages)
      ? (rawSpec.visualStages as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 3)
      : ['١. الفكرة', '٢. الشرح البصري', '٣. النتيجة'];

    res.json({
      illustrationCaption:
        parsed.illustrationCaption?.trim() || `مشهد جديد: ${lessonTitle}`,
      illustrationSpec: {
        sceneCategory,
        sceneTitle: String(rawSpec.sceneTitle || lessonTitle),
        sceneDescription: String(
          rawSpec.sceneDescription ||
            parsed.illustrationCaption ||
            `مشهد توضيحي لدرس ${lessonTitle}`
        ),
        charactersOrActors: actors,
        visualStages: stages,
        keyEquationOrCode:
          typeof rawSpec.keyEquationOrCode === 'string' && rawSpec.keyEquationOrCode.trim()
            ? rawSpec.keyEquationOrCode.trim()
            : undefined,
      },
      illustrationSvg: '',
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

app.post('/api/regenerate-cover', async (req: Request, res: Response) => {
  try {
    const {
      guideTitle = '',
      subject = '',
      gradeLevel = '',
      outlineSummary = '',
      lessonTopics = [],
      customNote = '',
      prevSeed = 0,
    } = req.body as {
      guideTitle?: string;
      subject?: string;
      gradeLevel?: string;
      outlineSummary?: string;
      lessonTopics?: string[];
      customNote?: string;
      prevSeed?: number;
    };

    const ai = getAiClient();
    const safeTopics = Array.isArray(lessonTopics) ? lessonTopics.slice(0, 4) : [];

    const response = await generateJsonWithRateLimitGuard(
      ai,
      `صمّم هوية بصرية لغلاف مذكرة دراسية ديناميكية مخصصة لمحتوى الكتاب والمادة:
- عنوان المذكرة: ${guideTitle || 'مذكرة دراسية شاملة'}
- المادة: ${subject || 'غير محددة'}
- الصف الدراسي: ${gradeLevel || ''}
- أبرز محاور الكتاب: ${safeTopics.join(' | ') || outlineSummary || 'دروس المنهج الكاملة'}
- توجيه المعلم لتصميم الغلاف: ${customNote || 'اقترح تصميماً تعليمياً ملهماً يعبر بوضوح عن المادة'}

أرجع JSON فقط بهذا الهيكل:
{
  "headlineMotif": "عبارة بصرية أو شعار موضوعي قصير من ٣ إلى ٥ كلمات يعبر عن روح المادة ومحتوى الكتاب",
  "sceneCategory": "إحدى القيم: history-battle | history-civilization | history-timeline | programming-flow | programming-code | science-optics | science-biology | science-physics | science-chemistry | math-visual | arabic-grammar | geography-map | conceptual-story",
  "visualElements": ["عنصر بصري ١", "عنصر بصري ٢", "عنصر بصري ٣"],
  "subtitleTag": "وسم قصير للمادة أو المنهج"
}`
    );

    const parsed = JSON.parse(stripJsonFences(response.text ?? '{}')) as {
      headlineMotif?: string;
      sceneCategory?: string;
      visualElements?: string[];
      subtitleTag?: string;
    };

    const sceneCategory = normalizeSceneCategory(
      parsed.sceneCategory,
      subject,
      `${guideTitle} ${safeTopics.join(' ')} ${outlineSummary} ${customNote}`
    );

    const visualElements = Array.isArray(parsed.visualElements)
      ? parsed.visualElements.map((v) => String(v).trim()).filter(Boolean).slice(0, 4)
      : safeTopics.slice(0, 3);

    res.json({
      coverVisualSpec: {
        headlineMotif:
          parsed.headlineMotif?.trim() ||
          (subject ? `رحلة الإبداع في ${subject}` : 'مذكرة تعليمية ميسّرة'),
        sceneCategory,
        visualElements:
          visualElements.length > 0
            ? visualElements
            : ['شرح مبتكر متسلسل', 'مشاهد توضيحية مخصصة', 'خلاصات مركزة'],
        subtitleTag: parsed.subtitleTag?.trim() || subject || undefined,
        seed: (Number(prevSeed) || 0) + 1,
      },
    });
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

let imagePacingQueue: Promise<void> = Promise.resolve();
let lastImageCallAt = 0;
const IMAGE_PACING_MS = 1800;

function scheduleImageRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = imagePacingQueue.then(async () => {
    const elapsed = Date.now() - lastImageCallAt;
    if (lastImageCallAt > 0 && elapsed < IMAGE_PACING_MS) {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_PACING_MS - elapsed));
    }
    lastImageCallAt = Date.now();
    return fn();
  });

  imagePacingQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function tryGeminiFlashImage(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  aspectRatio: string
): Promise<{ imageUrl: string; modelUsed: string } | null> {
  const response = await withTimeout(
    () =>
      ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || '16:9',
          },
        },
      }),
    45000
  );

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      return {
        imageUrl: `data:${mime};base64,${part.inlineData.data}`,
        modelUsed: model,
      };
    }
  }
  return null;
}

async function tryImagenFallback(
  ai: GoogleGenAI,
  prompt: string,
  aspectRatio: string
): Promise<{ imageUrl: string; modelUsed: string } | null> {
  const imgResp = await withTimeout(
    () =>
      ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio || '16:9',
        },
      }),
    45000
  );

  const bytes = imgResp.generatedImages?.[0]?.image?.imageBytes;
  if (bytes) {
    return {
      imageUrl: `data:image/png;base64,${bytes}`,
      modelUsed: 'imagen-3.0-generate-002',
    };
  }
  return null;
}

app.post('/api/generate-image', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      aspectRatio = '16:9',
    } = req.body as {
      prompt?: string;
      aspectRatio?: string;
    };

    if (!prompt || prompt.trim().length < 10) {
      res.status(400).json({ error: 'وصف الصورة المطلوب غير مكتمل.' });
      return;
    }

    const ai = getAiClient();
    const cleanPrompt = prompt.trim();

    const result = await scheduleImageRequest(async () => {
      let lastErr: unknown = null;

      // 1. Primary native Gemini image generation model
      try {
        const primary = await tryGeminiFlashImage(
          ai,
          'gemini-2.5-flash-image',
          cleanPrompt,
          aspectRatio
        );
        if (primary) return primary;
      } catch (primaryErr) {
        lastErr = primaryErr;
        const msg =
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        console.error('[Image Primary gemini-2.5-flash-image]', msg.slice(0, 260));
        if (msg.includes('GEMINI_API_KEY_MISSING') || msg.includes('API_KEY_INVALID')) {
          throw primaryErr;
        }
      }

      // 2. Automatic fallback to imagen-3.0-generate-002
      try {
        const imagenRes = await tryImagenFallback(ai, cleanPrompt, aspectRatio);
        if (imagenRes) return imagenRes;
      } catch (imagenErr) {
        lastErr = imagenErr;
        const msg =
          imagenErr instanceof Error ? imagenErr.message : String(imagenErr);
        console.error('[Image Fallback imagen-3.0-generate-002]', msg.slice(0, 260));
      }

      // 3. Secondary Gemini native image alias fallback
      try {
        const liteRes = await tryGeminiFlashImage(
          ai,
          'gemini-3.1-flash-lite-image',
          cleanPrompt,
          aspectRatio
        );
        if (liteRes) return liteRes;
      } catch (liteErr) {
        lastErr = liteErr;
        const msg = liteErr instanceof Error ? liteErr.message : String(liteErr);
        console.error('[Image Fallback gemini-3.1-flash-lite-image]', msg.slice(0, 260));
      }

      if (lastErr) throw lastErr;
      throw new Error('IMAGE_MODEL_EMPTY_OUTPUT');
    });

    res.json(result);
  } catch (error) {
    const mapped = mapGeminiError(error);
    res.status(mapped.status).json({
      error: mapped.message,
      retryAfterSeconds: mapped.retryAfterSeconds,
      quotaExceeded: mapped.quotaExceeded,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Study Guide Studio running on http://localhost:${PORT}`);
  });
}

startServer();
