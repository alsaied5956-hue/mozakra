import { DetailLevel, OutlineLesson } from '../types/studyGuide';

export interface SourceChunk {
  index: number;
  totalChunks: number;
  pageRangeLabel: string;
  text: string;
  targetLessonCount: number;
}

export interface PageBudget {
  estimatedSourcePages: number;
  targetPages: number;
  minPages: number;
  maxPages: number;
}

interface PageSegment {
  pageNumber: number | null;
  text: string;
}

export function detectSourcePageCount(rawText: string, explicitPdfPageCount?: number | null): number {
  if (explicitPdfPageCount && explicitPdfPageCount > 0) {
    return explicitPdfPageCount;
  }
  const pageMatches = rawText.match(/(?:^|\n)---\s*صفحة\s*\d+\s*---/g);
  if (pageMatches && pageMatches.length > 0) {
    return pageMatches.length;
  }
  const trimmedLen = rawText.trim().length;
  if (trimmedLen === 0) return 0;
  // ~1,600 Arabic characters per typical study guide page
  return Math.max(1, Math.round(trimmedLen / 1600));
}

export function computeTargetPageBudget(
  rawText: string,
  detailLevel: DetailLevel,
  explicitPdfPageCount?: number | null
): PageBudget {
  const estimatedSourcePages = Math.max(1, detectSourcePageCount(rawText, explicitPdfPageCount));

  if (detailLevel === 'detailed') {
    const targetPages = Math.max(estimatedSourcePages, Math.round(estimatedSourcePages * 1.3));
    return {
      estimatedSourcePages,
      targetPages,
      minPages: estimatedSourcePages,
      maxPages: Math.max(estimatedSourcePages + 2, Math.round(estimatedSourcePages * 1.55)),
    };
  }

  if (detailLevel === 'concise') {
    const minFloor = estimatedSourcePages >= 8 ? Math.round(estimatedSourcePages * 0.55) : Math.min(estimatedSourcePages, 2);
    const targetPages = Math.max(minFloor, Math.round(estimatedSourcePages * 0.72));
    return {
      estimatedSourcePages,
      targetPages,
      minPages: minFloor,
      maxPages: Math.max(targetPages + 1, estimatedSourcePages),
    };
  }

  // 'balanced' (default): keeps guide proportional ~1:1 with source length (e.g., 37-page PDF -> ~30-42 pages, NEVER 95 and NEVER 4)
  const targetPages = estimatedSourcePages;
  return {
    estimatedSourcePages,
    targetPages,
    minPages: Math.max(1, Math.round(estimatedSourcePages * 0.8)),
    maxPages: Math.max(2, Math.round(estimatedSourcePages * 1.2)),
  };
}

function splitLongTextByBoundaries(text: string, maxChars: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/);
  const parts: string[] = [];
  let current = '';

  const flushCurrent = () => {
    if (current.trim()) {
      parts.push(current.trim());
      current = '';
    }
  };

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if (cleanPara.length > maxChars) {
      flushCurrent();
      const lines = cleanPara.split(/\n/);
      let lineBuf = '';
      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine.length > maxChars) {
          if (lineBuf) {
            parts.push(lineBuf.trim());
            lineBuf = '';
          }
          let cursor = 0;
          while (cursor < cleanLine.length) {
            let end = Math.min(cursor + maxChars, cleanLine.length);
            if (end < cleanLine.length) {
              const lastSpace = cleanLine.lastIndexOf(' ', end);
              if (lastSpace > cursor + Math.floor(maxChars * 0.6)) {
                end = lastSpace;
              }
            }
            const slice = cleanLine.slice(cursor, end).trim();
            if (slice) parts.push(slice);
            cursor = end;
          }
        } else if ((lineBuf + '\n' + cleanLine).trim().length > maxChars) {
          if (lineBuf) parts.push(lineBuf.trim());
          lineBuf = cleanLine;
        } else {
          lineBuf = lineBuf ? `${lineBuf}\n${cleanLine}` : cleanLine;
        }
      }
      if (lineBuf.trim()) parts.push(lineBuf.trim());
      continue;
    }

    if ((current ? `${current}\n\n${cleanPara}` : cleanPara).length > maxChars) {
      flushCurrent();
      current = cleanPara;
    } else {
      current = current ? `${current}\n\n${cleanPara}` : cleanPara;
    }
  }

  flushCurrent();
  return parts;
}

function extractPageSegments(rawText: string): PageSegment[] | null {
  const markerRegex = /(?:^|\n)---\s*صفحة\s*(\d+)\s*---\s*\n/g;
  const matches = [...rawText.matchAll(markerRegex)];
  if (matches.length === 0) return null;

  const segments: PageSegment[] = [];
  const prefix = rawText.slice(0, matches[0].index ?? 0).trim();
  if (prefix) {
    segments.push({ pageNumber: null, text: prefix });
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? rawText.length) : rawText.length;
    const pageNum = Number(match[1]);
    const body = rawText.slice(start, end).trim();
    if (body) {
      segments.push({
        pageNumber: Number.isFinite(pageNum) ? pageNum : null,
        text: `--- صفحة ${pageNum} ---\n${body}`,
      });
    }
  }

  return segments.length > 0 ? segments : null;
}

export function splitSourceIntoSequentialChunks(
  rawText: string,
  maxCharsPerChunk = 16000,
  detailLevel: DetailLevel = 'balanced',
  explicitPdfPageCount?: number | null
): SourceChunk[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  const budget = computeTargetPageBudget(trimmed, detailLevel, explicitPdfPageCount);
  const pageSegments = extractPageSegments(trimmed);
  const draftChunks: Array<{ pageRangeLabel: string; text: string; weightPages: number }> = [];

  if (pageSegments) {
    let bufferTexts: string[] = [];
    let bufferPages: number[] = [];
    let bufferLen = 0;

    const flushBuffer = () => {
      if (bufferTexts.length === 0) return;
      const joined = bufferTexts.join('\n\n').trim();
      const firstPage = bufferPages[0];
      const lastPage = bufferPages[bufferPages.length - 1];
      const label =
        firstPage !== undefined && lastPage !== undefined
          ? firstPage === lastPage
            ? `صفحة ${firstPage}`
            : `صفحات ${firstPage}–${lastPage}`
          : `الجزء ${draftChunks.length + 1}`;
      draftChunks.push({
        pageRangeLabel: label,
        text: joined,
        weightPages: Math.max(1, bufferPages.length),
      });
      bufferTexts = [];
      bufferPages = [];
      bufferLen = 0;
    };

    for (const seg of pageSegments) {
      if (seg.text.length > maxCharsPerChunk) {
        flushBuffer();
        const subParts = splitLongTextByBoundaries(seg.text, maxCharsPerChunk);
        subParts.forEach((part, subIdx) => {
          const baseLabel = seg.pageNumber ? `صفحة ${seg.pageNumber}` : `الجزء ${draftChunks.length + 1}`;
          draftChunks.push({
            pageRangeLabel: subParts.length > 1 ? `${baseLabel} (${subIdx + 1}/${subParts.length})` : baseLabel,
            text: part,
            weightPages: Math.max(1, Math.round(part.length / 1600)),
          });
        });
        continue;
      }

      if (bufferLen > 0 && bufferLen + seg.text.length + 2 > maxCharsPerChunk) {
        flushBuffer();
      }

      bufferTexts.push(seg.text);
      if (seg.pageNumber !== null) {
        bufferPages.push(seg.pageNumber);
      }
      bufferLen += seg.text.length + 2;
    }

    flushBuffer();
  } else {
    const parts = splitLongTextByBoundaries(trimmed, maxCharsPerChunk);
    parts.forEach((part, idx) => {
      draftChunks.push({
        pageRangeLabel: parts.length === 1 ? 'النص الكامل' : `الجزء ${idx + 1}`,
        text: part,
        weightPages: Math.max(1, Math.round(part.length / 1600)),
      });
    });
  }

  const totalChars = draftChunks.reduce((sum, c) => sum + c.text.length, 0) || 1;

  return draftChunks.map((chunk, idx) => {
    const proportionalTarget = Math.max(
      1,
      Math.round((chunk.text.length / totalChars) * budget.targetPages)
    );
    return {
      index: idx,
      totalChunks: draftChunks.length,
      pageRangeLabel: chunk.pageRangeLabel,
      text: chunk.text,
      targetLessonCount: Math.min(12, proportionalTarget),
    };
  });
}

export function attachSourceContentToLessons(
  lessonsFromChunk: Array<Omit<OutlineLesson, 'sourceContent'> & { sourceContent?: string }>,
  chunkText: string,
  pageRangeLabel: string
): OutlineLesson[] {
  const cleanChunk = chunkText.trim();
  if (lessonsFromChunk.length === 0) return [];
  if (lessonsFromChunk.length === 1) {
    return [
      {
        ...lessonsFromChunk[0],
        sourceContent: lessonsFromChunk[0].sourceContent?.trim() || cleanChunk,
        sourceRange: lessonsFromChunk[0].sourceRange || pageRangeLabel,
      },
    ];
  }

  const offsets: number[] = [];
  let searchFrom = 0;

  for (let i = 0; i < lessonsFromChunk.length; i++) {
    const lesson = lessonsFromChunk[i];
    const candidates = [
      lesson.title.replace(/^(?:الدرس|الوحدة|الفصل)\s+[^:：-]+[:：-]\s*/, '').trim(),
      lesson.title.trim(),
      ...(lesson.subtopics || []).slice(0, 2).map((s) => s.trim()),
    ].filter((c) => c.length >= 4);

    let foundAt = -1;
    for (const candidate of candidates) {
      const idx = cleanChunk.indexOf(candidate, searchFrom);
      if (idx !== -1) {
        foundAt = idx;
        break;
      }
    }

    if (foundAt !== -1) {
      offsets.push(foundAt);
      searchFrom = foundAt + 4;
    } else {
      offsets.push(-1);
    }
  }

  const allMatchedMonotonic = offsets.every((val, idx) =>
    idx === 0 ? val >= 0 : val > offsets[idx - 1]
  );

  if (allMatchedMonotonic) {
    offsets[0] = 0;
    return lessonsFromChunk.map((lesson, idx) => {
      const start = offsets[idx];
      const end = idx + 1 < offsets.length ? offsets[idx + 1] : cleanChunk.length;
      const slice = cleanChunk.slice(start, end).trim();
      return {
        ...lesson,
        sourceContent: slice || cleanChunk,
        sourceRange: lesson.sourceRange || pageRangeLabel,
      };
    });
  }

  const count = lessonsFromChunk.length;
  const approxChunkLen = Math.ceil(cleanChunk.length / count);
  let cursor = 0;

  return lessonsFromChunk.map((lesson, idx) => {
    if (idx === count - 1) {
      const tail = cleanChunk.slice(cursor).trim();
      return {
        ...lesson,
        sourceContent: tail || cleanChunk,
        sourceRange: lesson.sourceRange || pageRangeLabel,
      };
    }

    let targetEnd = Math.min(cursor + approxChunkLen, cleanChunk.length);
    const newlinePos = cleanChunk.indexOf('\n', targetEnd);
    if (newlinePos !== -1 && newlinePos - targetEnd < 280) {
      targetEnd = newlinePos + 1;
    }
    const slice = cleanChunk.slice(cursor, targetEnd).trim();
    cursor = targetEnd;

    return {
      ...lesson,
      sourceContent: slice || cleanChunk,
      sourceRange: lesson.sourceRange || pageRangeLabel,
    };
  });
}

export function rebalanceOutlineEstimatedPages(
  lessons: OutlineLesson[],
  budget: PageBudget,
  detailLevel: DetailLevel
): OutlineLesson[] {
  if (lessons.length === 0) return [];

  // Prevent inflation: if lesson count already meets or exceeds maxPages, keep each lesson to 1 page
  if (lessons.length >= budget.maxPages || detailLevel === 'concise') {
    return lessons.map((l) => ({ ...l, estimatedPages: 1 }));
  }

  const maxPerLesson = detailLevel === 'detailed' ? 2 : 1;
  return lessons.map((l) => {
    const contentLen = (l.sourceContent || l.sourceExcerpt || '').length;
    const desired =
      detailLevel === 'detailed' && contentLen > 2200
        ? 2
        : Math.min(maxPerLesson, Math.max(1, l.estimatedPages || 1));
    return {
      ...l,
      estimatedPages: desired,
    };
  });
}

export function buildLessonBatches(
  lessons: OutlineLesson[],
  maxLessonsPerBatch = 2,
  maxCharsPerBatch = 5500
): OutlineLesson[][] {
  if (lessons.length === 0) return [];
  const batches: OutlineLesson[][] = [];
  let currentBatch: OutlineLesson[] = [];
  let currentChars = 0;

  for (const lesson of lessons) {
    const lessonChars = (lesson.sourceContent || lesson.sourceExcerpt || lesson.title).length;
    const wouldExceedLessons = currentBatch.length >= maxLessonsPerBatch;
    const wouldExceedChars = currentBatch.length > 0 && currentChars + lessonChars > maxCharsPerBatch;

    if (wouldExceedLessons || wouldExceedChars) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(lesson);
    currentChars += lessonChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
