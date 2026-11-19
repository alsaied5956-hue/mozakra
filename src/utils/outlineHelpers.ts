import { OutlineLesson, StudyPage } from '../types/studyGuide';

export function resequenceOutline(lessons: OutlineLesson[]): OutlineLesson[] {
  return lessons.map((lesson, idx) => ({
    ...lesson,
    order: idx + 1,
  }));
}

export function moveLessonInOutline(
  lessons: OutlineLesson[],
  index: number,
  direction: 'up' | 'down'
): OutlineLesson[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= lessons.length || targetIndex < 0 || targetIndex >= lessons.length) {
    return lessons;
  }
  const copy = [...lessons];
  const [moved] = copy.splice(index, 1);
  copy.splice(targetIndex, 0, moved);
  return resequenceOutline(copy);
}

export function removeLessonFromOutline(lessons: OutlineLesson[], id: string): OutlineLesson[] {
  return resequenceOutline(lessons.filter((lesson) => lesson.id !== id));
}

export function addLessonToOutline(
  lessons: OutlineLesson[],
  title: string,
  subtopicsText: string
): OutlineLesson[] {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return lessons;

  const subtopics = subtopicsText
    .split(/[،,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const next: OutlineLesson = {
    id: `lesson-${Date.now()}-${lessons.length + 1}`,
    order: lessons.length + 1,
    title: trimmedTitle,
    subtopics: subtopics.length > 0 ? subtopics : ['الشرح الأساسي للمفهوم'],
    sourceExcerpt: trimmedTitle,
    sourceContent: [trimmedTitle, ...subtopics].join('\n'),
    estimatedPages: 1,
  };

  return resequenceOutline([...lessons, next]);
}

export function renumberStudyPages(pages: StudyPage[]): StudyPage[] {
  return pages.map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));
}

export function splitTextIntoLocalOutlineFallback(rawText: string): OutlineLesson[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headingRegex = /^(?:الدرس|الوحدة|الفصل|الباب|أولاً|ثانياً|ثالثاً|رابعاً|\d+[-.)])\s*[:：-]?\s*/;
  const lessons: OutlineLesson[] = [];
  let currentTitle = '';
  let currentBuffer: string[] = [];

  for (const line of lines) {
    const looksLikeHeading =
      headingRegex.test(line) || (line.length <= 68 && !line.endsWith('.') && !line.endsWith('؟'));

    if (looksLikeHeading && (currentBuffer.length > 0 || !currentTitle)) {
      if (currentTitle) {
        const bodyText = currentBuffer.join('\n');
        lessons.push({
          id: `lesson-${lessons.length + 1}`,
          order: lessons.length + 1,
          title: currentTitle,
          subtopics: currentBuffer.slice(0, 4),
          sourceExcerpt: currentBuffer.join(' ').slice(0, 260),
          sourceContent: `${currentTitle}\n${bodyText}`.trim(),
          estimatedPages: bodyText.length > 1800 ? 2 : 1,
        });
      }
      currentTitle = line.replace(/^#+\s*/, '');
      currentBuffer = [];
    } else {
      currentBuffer.push(line);
    }
  }

  if (currentTitle) {
    const bodyText = currentBuffer.join('\n');
    lessons.push({
      id: `lesson-${lessons.length + 1}`,
      order: lessons.length + 1,
      title: currentTitle,
      subtopics: currentBuffer.slice(0, 4),
      sourceExcerpt: currentBuffer.join(' ').slice(0, 260),
      sourceContent: `${currentTitle}\n${bodyText}`.trim(),
      estimatedPages: bodyText.length > 1800 ? 2 : 1,
    });
  }

  if (lessons.length === 0) {
    return [
      {
        id: 'lesson-1',
        order: 1,
        title: 'الدرس الأول: المفهوم الأساسي',
        subtopics: lines.slice(0, 4),
        sourceExcerpt: lines.join(' ').slice(0, 260),
        sourceContent: lines.join('\n'),
        estimatedPages: rawText.length > 1800 ? 2 : 1,
      },
    ];
  }

  return resequenceOutline(lessons);
}
