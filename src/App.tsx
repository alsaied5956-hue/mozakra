import React, { useRef, useState } from 'react';
import { AlertCircle, Printer, Sparkles, X } from 'lucide-react';
import {
  DEMO_OUTLINE,
  DEMO_STUDY_GUIDE,
  SAMPLE_CURRICULA,
  SampleCurriculum,
} from './data/samples';
import {
  CoverVisualSpec,
  DetailLevel,
  GenerationProgressState,
  OutlineLesson,
  StudyGuideDocument,
  StudyPage,
  TeacherProfile,
} from './types/studyGuide';
import {
  DEFAULT_TEACHER_PROFILE,
  THEME_PALETTES,
  formatSubjectGrade,
  inferSceneCategoryFromSubjectAndText,
  inferSubjectIcon,
} from './utils/themes';
import {
  addLessonToOutline,
  moveLessonInOutline,
  removeLessonFromOutline,
  renumberStudyPages,
  resequenceOutline,
} from './utils/outlineHelpers';
import {
  attachSourceContentToLessons,
  buildLessonBatches,
  computeTargetPageBudget,
  rebalanceOutlineEstimatedPages,
  splitSourceIntoSequentialChunks,
} from './utils/chunking';
import {
  buildExportHtml,
  buildExportMarkdown,
  downloadTextFile,
} from './utils/exportDocument';
import { TeacherBrandPanel } from './components/TeacherBrandPanel';
import { SourceOutlinePanel } from './components/SourceOutlinePanel';
import { PagesExportPanel } from './components/PagesExportPanel';
import { StudioCanvas } from './components/StudioCanvas';
import { useImageQueue } from './hooks/useImageQueue';

type RailTab = 'brand' | 'source' | 'export';

const INITIAL_GENERATION_STATE: GenerationProgressState = {
  status: 'idle',
  currentBatchIndex: 0,
  totalBatches: 0,
  completedLessonsCount: 0,
  totalLessonsCount: 0,
  generatedPagesCount: 0,
  failedBatchIndex: null,
  errorMessage: null,
  autoContinue: true,
};

export default function App() {
  const [profile, setProfile] = useState<TeacherProfile>(DEFAULT_TEACHER_PROFILE);
  const [activeTab, setActiveTab] = useState<RailTab>('brand');
  const [rawText, setRawText] = useState<string>('');
  const [sourcePageCount, setSourcePageCount] = useState<number | null>(null);
  const [outline, setOutline] = useState<OutlineLesson[]>([]);
  const [outlineSummary, setOutlineSummary] = useState<string>('');
  const [document, setDocument] = useState<StudyGuideDocument | null>(null);
  const [coverVisualSpec, setCoverVisualSpec] = useState<CoverVisualSpec | undefined>(
    undefined
  );

  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    currentChunk: number;
    totalChunks: number;
    label: string;
  } | null>(null);
  const [generationState, setGenerationState] = useState<GenerationProgressState>(
    INITIAL_GENERATION_STATE
  );
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Refs for clean async batch loop control without stale closures
  const activeBatchesRef = useRef<OutlineLesson[][]>([]);
  const pauseRequestedRef = useRef<boolean>(false);
  const runTokenRef = useRef<number>(0);

  const palette = THEME_PALETTES[profile.themeId];

  const {
    autoGenerateImages,
    coverImageUrl,
    coverImageStatus,
    coverImageError,
    isRegeneratingCover,
    regeneratingPageId,
    imageQueueSummary,
    handleGenerateCoverImage,
    handleGeneratePageImage,
    handleStartAllPendingImages,
    handlePauseImageQueue,
    handleResumeImageQueue,
    handleRetryFailedImages,
    handleToggleAutoImages,
    resetImageQueue,
  } = useImageQueue({
    document,
    setDocument,
    profile,
    outline,
    coverVisualSpec,
  });

  const handleProfileChange = (updated: Partial<TeacherProfile>) => {
    setProfile((prev) => {
      const next: TeacherProfile = { ...prev, ...updated };
      if (updated.subject !== undefined || updated.gradeLevel !== undefined) {
        next.subjectGrade = formatSubjectGrade(next.subject, next.gradeLevel);
      }
      return next;
    });

    if (updated.subject !== undefined && updated.subject !== profile.subject) {
      // Refresh dynamic cover motif immediately when user switches subject
      setCoverVisualSpec(undefined);
    }

    if (updated.guideTitle !== undefined && document) {
      setDocument((prev) =>
        prev ? { ...prev, guideTitle: updated.guideTitle ?? '' } : prev
      );
    }
  };

  const handleDetailLevelChange = (level: DetailLevel) => {
    setProfile((prev) => ({ ...prev, detailLevel: level }));
    if (outline.length > 0 && rawText.trim()) {
      const budget = computeTargetPageBudget(rawText, level, sourcePageCount);
      setOutline((prev) => rebalanceOutlineEstimatedPages(prev, budget, level));
    }
  };

  const handleRawTextChange = (text: string, pageCount?: number | null) => {
    setRawText(text);
    if (pageCount !== undefined) {
      setSourcePageCount(pageCount);
    }
  };

  const handleApplySample = (sample: SampleCurriculum) => {
    // Strictly preserve Teacher Name if user already entered it, and apply sample curriculum cleanly
    setProfile((prev) => {
      const nextSubject = sample.subject;
      const nextGrade = prev.gradeLevel.trim() ? prev.gradeLevel : sample.gradeLevel;
      return {
        ...prev,
        subject: nextSubject,
        gradeLevel: nextGrade,
        subjectGrade: formatSubjectGrade(nextSubject, nextGrade),
        guideTitle: sample.guideTitle,
        subjectIcon: sample.subjectIcon || inferSubjectIcon(nextSubject),
        teachingStyle: sample.teachingStyle,
      };
    });
    setRawText(sample.rawText);
    setSourcePageCount(null);
    setOutline([]);
    setOutlineSummary('');
    setCoverVisualSpec(undefined);
    setGenerationState(INITIAL_GENERATION_STATE);
    activeBatchesRef.current = [];
    setErrorBanner(null);
  };

  const handleQuickDemoStart = () => {
    handleApplySample(SAMPLE_CURRICULA[0]);
    setActiveTab('source');
  };

  const handleInstantDemoPreview = () => {
    resetImageQueue();
    setProfile((prev) => ({
      ...prev,
      subject: prev.subject.trim() || 'العلوم',
      gradeLevel: prev.gradeLevel.trim() || 'الصف السادس الابتدائي',
      subjectGrade: formatSubjectGrade(
        prev.subject.trim() || 'العلوم',
        prev.gradeLevel.trim() || 'الصف السادس الابتدائي'
      ),
      guideTitle: prev.guideTitle.trim() || DEMO_STUDY_GUIDE.guideTitle,
      subjectIcon: prev.subject.trim() ? inferSubjectIcon(prev.subject) : 'atom',
    }));
    setOutline(DEMO_OUTLINE);
    setOutlineSummary(DEMO_STUDY_GUIDE.outlineSummary);
    setCoverVisualSpec(DEMO_STUDY_GUIDE.coverVisualSpec);
    setDocument({
      ...DEMO_STUDY_GUIDE,
      guideTitle: profile.guideTitle.trim() || DEMO_STUDY_GUIDE.guideTitle,
      pages: DEMO_STUDY_GUIDE.pages.map((p) => ({
        ...p,
        illustrationStatus: 'idle',
        illustrationImageUrl: undefined,
        illustrationError: undefined,
      })),
    });
    setGenerationState(INITIAL_GENERATION_STATE);
    setActivePageIndex(1);
    setActiveTab('export');
  };

  const handleAnalyzeOutline = async () => {
    setErrorBanner(null);
    if (rawText.trim().length < 20) {
      setErrorBanner('يرجى إدخال نص دراسي كافٍ قبل تحليل المحتوى.');
      return;
    }

    const chunks = splitSourceIntoSequentialChunks(
      rawText,
      16000,
      profile.detailLevel,
      sourcePageCount
    );
    if (chunks.length === 0) {
      setErrorBanner('لم يتم العثور على نص صالح للتحليل.');
      return;
    }

    const budget = computeTargetPageBudget(rawText, profile.detailLevel, sourcePageCount);

    setIsAnalyzing(true);
    setGenerationState(INITIAL_GENERATION_STATE);
    activeBatchesRef.current = [];

    const accumulatedLessons: OutlineLesson[] = [];
    const summaries: string[] = [];
    let suggestedTitle = '';

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let data: {
          lessons?: OutlineLesson[];
          suggestedTitle?: string;
          summary?: string;
          error?: string;
          retryAfterSeconds?: number;
        } | null = null;

        for (let cooldownTry = 0; cooldownTry <= 2; cooldownTry++) {
          setAnalysisProgress({
            currentChunk: i + 1,
            totalChunks: chunks.length,
            label: chunk.pageRangeLabel,
          });

          const response = await fetch('/api/analyze-outline-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chunkText: chunk.text,
              chunkIndex: chunk.index,
              totalChunks: chunk.totalChunks,
              pageRangeLabel: chunk.pageRangeLabel,
              subject: profile.subject,
              subjectGrade:
                formatSubjectGrade(profile.subject, profile.gradeLevel) ||
                profile.subjectGrade,
              teacherName: profile.teacherName,
              detailLevel: profile.detailLevel,
              chunkTargetLessons: chunk.targetLessonCount,
            }),
          });

          data = await response.json();
          if (response.ok) {
            setErrorBanner(null);
            break;
          }

          if (response.status === 429 && cooldownTry < 2) {
            const waitSec = Math.min(60, Math.max(5, Number(data?.retryAfterSeconds) || 45));
            for (let rem = waitSec; rem > 0; rem--) {
              setAnalysisProgress({
                currentChunk: i + 1,
                totalChunks: chunks.length,
                label: `الحد المؤقت للطلبات — استئناف تلقائي خلال ${rem} ث...`,
              });
              await new Promise((r) => setTimeout(r, 1000));
            }
            continue;
          }

          throw new Error(data?.error || `تعذر تحليل ${chunk.pageRangeLabel}.`);
        }

        if (!data) {
          throw new Error(`تعذر تحليل ${chunk.pageRangeLabel}.`);
        }

        const chunkLessons = attachSourceContentToLessons(
          data.lessons || [],
          chunk.text,
          chunk.pageRangeLabel
        );
        accumulatedLessons.push(...chunkLessons);

        if (i === 0 && data.suggestedTitle) {
          suggestedTitle = String(data.suggestedTitle).trim();
        }
        if (data.summary) {
          summaries.push(String(data.summary).trim());
        }

        // Update outline live as chunks finish so user sees immediate progress
        setOutline(
          rebalanceOutlineEstimatedPages(
            resequenceOutline(accumulatedLessons),
            budget,
            profile.detailLevel
          )
        );
      }

      const finalOutline = rebalanceOutlineEstimatedPages(
        resequenceOutline(accumulatedLessons),
        budget,
        profile.detailLevel
      );
      const combinedSummary =
        summaries.slice(0, 2).join(' ') ||
        'مذكرة تعليمية شاملة تغطي جميع دروس المادة بنفس تسلسلها الأصلي.';
      setOutline(finalOutline);
      setOutlineSummary(combinedSummary);

      const effectiveTitle = profile.guideTitle.trim() || suggestedTitle;
      if (suggestedTitle && !profile.guideTitle.trim()) {
        setProfile((prev) => ({
          ...prev,
          guideTitle: prev.guideTitle.trim() ? prev.guideTitle : suggestedTitle,
        }));
      }

      // Auto-seed a dynamic CoverVisualSpec tailored to extracted book topics & subject
      const topicTitles = finalOutline.slice(0, 3).map((l) => l.title);
      setCoverVisualSpec({
        headlineMotif: effectiveTitle || (profile.subject ? `إتقان ${profile.subject}` : 'دليل التفوق الدراسي'),
        sceneCategory: inferSceneCategoryFromSubjectAndText(
          profile.subject,
          `${effectiveTitle} ${topicTitles.join(' ')}`
        ),
        visualElements: topicTitles,
        subtitleTag: profile.subject || undefined,
        seed: 1,
      });
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'حدث خطأ أثناء تحليل المحتوى.'
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const runBatchesFromIndex = async (params: {
    batches: OutlineLesson[][];
    startBatchIndex: number;
    autoContinue: boolean;
    initialPages: StudyPage[];
    initialCompletedLessons: number;
    guideTitleToUse: string;
  }) => {
    const {
      batches,
      startBatchIndex,
      autoContinue,
      initialPages,
      initialCompletedLessons,
      guideTitleToUse,
    } = params;

    const myToken = ++runTokenRef.current;
    pauseRequestedRef.current = false;

    const totalLessonsCount = batches.reduce((sum, b) => sum + b.length, 0);
    let accumulatedPages = [...initialPages];
    let completedLessonsCount = initialCompletedLessons;

    setGenerationState({
      status: 'running',
      currentBatchIndex: startBatchIndex,
      totalBatches: batches.length,
      completedLessonsCount,
      totalLessonsCount,
      generatedPagesCount: accumulatedPages.length,
      failedBatchIndex: null,
      errorMessage: null,
      autoContinue,
    });

    for (let bIdx = startBatchIndex; bIdx < batches.length; bIdx++) {
      if (runTokenRef.current !== myToken) return;

      const batchLessons = batches[bIdx];
      setGenerationState((prev) => ({
        ...prev,
        status: 'running',
        currentBatchIndex: bIdx,
        failedBatchIndex: null,
        errorMessage: null,
      }));

      try {
        let data: {
          pages?: StudyPage[];
          error?: string;
          retryAfterSeconds?: number;
        } | null = null;

        for (let cooldownTry = 0; cooldownTry <= 2; cooldownTry++) {
          if (runTokenRef.current !== myToken) return;

          const response = await fetch('/api/generate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lessons: batchLessons,
              teacherProfile: {
                ...profile,
                subjectGrade:
                  formatSubjectGrade(profile.subject, profile.gradeLevel) ||
                  profile.subjectGrade,
                guideTitle: guideTitleToUse,
              },
              palette,
              detailLevel: profile.detailLevel,
            }),
          });

          data = await response.json();
          if (response.ok) {
            setErrorBanner(null);
            break;
          }

          if (response.status === 429 && cooldownTry < 2) {
            const waitSec = Math.min(60, Math.max(5, Number(data?.retryAfterSeconds) || 45));
            for (let rem = waitSec; rem > 0; rem--) {
              if (runTokenRef.current !== myToken) return;
              if (pauseRequestedRef.current) {
                setErrorBanner(null);
                setGenerationState({
                  status: 'paused',
                  currentBatchIndex: bIdx,
                  totalBatches: batches.length,
                  completedLessonsCount,
                  totalLessonsCount,
                  generatedPagesCount: accumulatedPages.length,
                  failedBatchIndex: null,
                  errorMessage: null,
                  autoContinue: false,
                });
                return;
              }
              setErrorBanner(
                `تم بلوغ حد الطلبات المؤقت (١٥ طلباً/دقيقة). سيتم استئناف توليد الدفعة ${bIdx + 1} تلقائياً خلال ${rem} ثانية...`
              );
              await new Promise((r) => setTimeout(r, 1000));
            }
            setErrorBanner(null);
            continue;
          }

          throw new Error(
            data?.error || `تعذر توليد الدفعة ${bIdx + 1} من ${batches.length}.`
          );
        }

        if (runTokenRef.current !== myToken) return;
        if (!data) {
          throw new Error(`تعذر توليد الدفعة ${bIdx + 1} من ${batches.length}.`);
        }

        const batchPages: StudyPage[] = Array.isArray(data.pages) ? data.pages : [];
        accumulatedPages = renumberStudyPages([...accumulatedPages, ...batchPages]);
        completedLessonsCount += batchLessons.length;

        setDocument((prev) => {
          const existingById = new Map((prev?.pages ?? []).map((p) => [p.id, p]));
          const mergedPages = renumberStudyPages(
            accumulatedPages.map((p) => {
              const live = existingById.get(p.id);
              return live
                ? {
                    ...p,
                    illustrationImageUrl:
                      live.illustrationImageUrl ?? p.illustrationImageUrl,
                    illustrationStatus:
                      live.illustrationStatus ?? p.illustrationStatus ?? 'idle',
                    illustrationError: live.illustrationError ?? p.illustrationError,
                    illustrationPrompt: live.illustrationPrompt ?? p.illustrationPrompt,
                  }
                : { ...p, illustrationStatus: p.illustrationStatus ?? 'idle' };
            })
          );
          return {
            guideTitle: guideTitleToUse,
            outlineSummary,
            pages: mergedPages,
            coverVisualSpec,
            coverImageUrl: prev?.coverImageUrl,
            coverImageStatus: prev?.coverImageStatus,
            coverImageError: prev?.coverImageError,
            generatedAt: new Date().toISOString(),
          };
        });

        if (bIdx === 0 && accumulatedPages.length > 0) {
          setActivePageIndex(1);
        }

        const nextBatchIndex = bIdx + 1;
        const isLastBatch = nextBatchIndex >= batches.length;

        if (isLastBatch) {
          setGenerationState({
            status: 'completed',
            currentBatchIndex: batches.length,
            totalBatches: batches.length,
            completedLessonsCount,
            totalLessonsCount,
            generatedPagesCount: accumulatedPages.length,
            failedBatchIndex: null,
            errorMessage: null,
            autoContinue,
          });
          setActiveTab('export');
          return;
        }

        if (!autoContinue || pauseRequestedRef.current) {
          setGenerationState({
            status: 'paused',
            currentBatchIndex: nextBatchIndex,
            totalBatches: batches.length,
            completedLessonsCount,
            totalLessonsCount,
            generatedPagesCount: accumulatedPages.length,
            failedBatchIndex: null,
            errorMessage: null,
            autoContinue: false,
          });
          return;
        }
      } catch (err) {
        if (runTokenRef.current !== myToken) return;
        const message =
          err instanceof Error
            ? err.message
            : `حدث خطأ أثناء توليد الدفعة ${bIdx + 1}.`;
        setErrorBanner(message);
        setGenerationState({
          status: 'error',
          currentBatchIndex: bIdx,
          totalBatches: batches.length,
          completedLessonsCount,
          totalLessonsCount,
          generatedPagesCount: accumulatedPages.length,
          failedBatchIndex: bIdx,
          errorMessage: message,
          autoContinue,
        });
        return;
      }
    }
  };

  const handleStartGeneration = async (autoContinue: boolean) => {
    setErrorBanner(null);
    if (outline.length === 0) {
      setErrorBanner('يرجى استخراج فهرس الدروس أولاً قبل التوليد.');
      return;
    }

    const batches = buildLessonBatches(outline, 4, 11000);
    activeBatchesRef.current = batches;
    const guideTitleToUse =
      profile.guideTitle.trim() ||
      (profile.subject.trim()
        ? `مذكرة ${profile.subject.trim()}`
        : 'المذكرة الدراسية الذكية');

    setDocument(null);
    resetImageQueue();
    setActivePageIndex(0);

    await runBatchesFromIndex({
      batches,
      startBatchIndex: 0,
      autoContinue,
      initialPages: [],
      initialCompletedLessons: 0,
      guideTitleToUse,
    });
  };

  const handlePauseGeneration = () => {
    pauseRequestedRef.current = true;
  };

  const handleResumeGeneration = async (autoContinue: boolean) => {
    setErrorBanner(null);
    const batches = activeBatchesRef.current;
    if (batches.length === 0) {
      await handleStartGeneration(autoContinue);
      return;
    }

    const startIdx = generationState.currentBatchIndex;
    const guideTitleToUse =
      document?.guideTitle ||
      profile.guideTitle.trim() ||
      'المذكرة الدراسية الذكية';

    await runBatchesFromIndex({
      batches,
      startBatchIndex: startIdx,
      autoContinue,
      initialPages: document?.pages ?? [],
      initialCompletedLessons: generationState.completedLessonsCount,
      guideTitleToUse,
    });
  };

  const handleRetryFailedBatch = async (autoContinue: boolean) => {
    setErrorBanner(null);
    const batches = activeBatchesRef.current;
    if (batches.length === 0) {
      await handleStartGeneration(autoContinue);
      return;
    }

    const retryIdx =
      generationState.failedBatchIndex ?? generationState.currentBatchIndex;
    const guideTitleToUse =
      document?.guideTitle ||
      profile.guideTitle.trim() ||
      'المذكرة الدراسية الذكية';

    await runBatchesFromIndex({
      batches,
      startBatchIndex: retryIdx,
      autoContinue,
      initialPages: document?.pages ?? [],
      initialCompletedLessons: generationState.completedLessonsCount,
      guideTitleToUse,
    });
  };

  const handleRegenerateIllustration = (pageId: string, customNote?: string) => {
    setErrorBanner(null);
    handleGeneratePageImage(pageId, customNote);
  };

  const handleRegenerateCover = (customNote?: string) => {
    setErrorBanner(null);
    handleGenerateCoverImage(customNote);
  };

  const handleUpdatePage = (pageId: string, updated: Partial<StudyPage>) => {
    setDocument((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) => (p.id === pageId ? { ...p, ...updated } : p)),
      };
    });
  };

  const handleUpdateDocumentMeta = (title: string, summary: string) => {
    setProfile((prev) => ({ ...prev, guideTitle: title }));
    setOutlineSummary(summary);
    setDocument((prev) =>
      prev ? { ...prev, guideTitle: title, outlineSummary: summary } : prev
    );
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleExportHtml = () => {
    if (!document) return;
    const html = buildExportHtml(document, profile, palette);
    const slug = (document.guideTitle || 'study-guide').replace(/\s+/g, '-');
    downloadTextFile(`${slug}.html`, html, 'text/html');
  };

  const handleExportMarkdown = () => {
    if (!document) return;
    const md = buildExportMarkdown(document, profile);
    const slug = (document.guideTitle || 'study-guide').replace(/\s+/g, '-');
    downloadTextFile(`${slug}.md`, md, 'text/markdown');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
          <a
            href="#studio-top"
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            مُعدّ المذكرات الذكي
          </a>

          <nav
            aria-label="أقسام الاستوديو"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setActiveTab('brand')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'brand' ? 'text-slate-900 font-bold underline underline-offset-8' : ''
              }`}
            >
              هوية المعلم
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('source')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'source' ? 'text-slate-900 font-bold underline underline-offset-8' : ''
              }`}
            >
              المحتوى والفهرس
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('single');
                if (document) setActivePageIndex(1);
                globalThis.document
                  ?.getElementById('a4-canvas-stage')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              معاينة المذكرة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'export' ? 'text-slate-900 font-bold underline underline-offset-8' : ''
              }`}
            >
              التصدير والطباعة
            </button>
          </nav>

          <div className="shrink-0">
            {document ? (
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة / حفظ PDF</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickDemoStart}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تحميل نموذج تجريبي</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Split Studio Workspace */}
      <main
        id="studio-top"
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6"
      >
        {errorBanner && (
          <div
            role="alert"
            className="no-print mb-5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-3 text-rose-900"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-700" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              aria-label="إغلاق رسالة التنبيه"
              className="p-1 text-rose-700 hover:text-rose-900 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Rail (in RTL): Setup, Source & Outline, Export */}
          <aside className="no-print lg:col-span-4 xl:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 lg:sticky lg:top-20">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('brand')}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'brand'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ١. الهوية
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('source')}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'source'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ٢. المحتوى
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'export'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ٣. التصدير
              </button>
            </div>

            {activeTab === 'brand' && (
              <TeacherBrandPanel
                profile={profile}
                onChange={handleProfileChange}
                onNextStep={() => setActiveTab('source')}
              />
            )}

            {activeTab === 'source' && (
              <SourceOutlinePanel
                rawText={rawText}
                sourcePageCount={sourcePageCount}
                detailLevel={profile.detailLevel}
                onDetailLevelChange={handleDetailLevelChange}
                onRawTextChange={handleRawTextChange}
                onApplySample={handleApplySample}
                outline={outline}
                outlineSummary={outlineSummary}
                isAnalyzing={isAnalyzing}
                analysisProgress={analysisProgress}
                generationState={generationState}
                onAnalyzeOutline={handleAnalyzeOutline}
                onMoveLesson={(idx, dir) =>
                  setOutline((prev) => moveLessonInOutline(prev, idx, dir))
                }
                onRemoveLesson={(id) =>
                  setOutline((prev) => removeLessonFromOutline(prev, id))
                }
                onAddLesson={(title, subtopics) =>
                  setOutline((prev) => addLessonToOutline(prev, title, subtopics))
                }
                onStartGeneration={handleStartGeneration}
                onPauseGeneration={handlePauseGeneration}
                onResumeGeneration={handleResumeGeneration}
                onRetryFailedBatch={handleRetryFailedBatch}
              />
            )}

            {activeTab === 'export' && (
              <PagesExportPanel
                profile={profile}
                document={document}
                activePageIndex={activePageIndex}
                isRegeneratingCover={isRegeneratingCover}
                autoGenerateImages={autoGenerateImages}
                imageQueueSummary={imageQueueSummary}
                onToggleAutoImages={handleToggleAutoImages}
                onStartImageQueue={handleStartAllPendingImages}
                onPauseImageQueue={handlePauseImageQueue}
                onResumeImageQueue={handleResumeImageQueue}
                onSelectPage={(idx) => {
                  setViewMode('single');
                  setActivePageIndex(idx);
                }}
                onProfileChange={handleProfileChange}
                onRegenerateCover={handleRegenerateCover}
                onPrintPdf={handlePrintPdf}
                onExportHtml={handleExportHtml}
                onExportMarkdown={handleExportMarkdown}
              />
            )}
          </aside>

          {/* Left Stage (in RTL): A4 Live Canvas */}
          <section className="lg:col-span-8 xl:col-span-8 min-w-0">
            <StudioCanvas
              profile={profile}
              palette={palette}
              document={document}
              outlineLessonTitles={outline.map((l) => l.title)}
              coverVisualSpec={coverVisualSpec}
              coverImageUrl={coverImageUrl}
              coverImageStatus={coverImageStatus}
              coverImageError={coverImageError}
              activePageIndex={activePageIndex}
              viewMode={viewMode}
              isEditing={isEditing}
              isRegeneratingCover={isRegeneratingCover}
              generationState={generationState}
              regeneratingPageId={regeneratingPageId}
              autoGenerateImages={autoGenerateImages}
              imageQueueSummary={imageQueueSummary}
              onToggleAutoImages={handleToggleAutoImages}
              onStartImageQueue={handleStartAllPendingImages}
              onPauseImageQueue={handlePauseImageQueue}
              onResumeImageQueue={handleResumeImageQueue}
              onRetryFailedImages={handleRetryFailedImages}
              onSelectPage={setActivePageIndex}
              onViewModeChange={setViewMode}
              onToggleEditing={() => setIsEditing((prev) => !prev)}
              onUpdateDocumentMeta={handleUpdateDocumentMeta}
              onUpdatePage={handleUpdatePage}
              onRegenerateIllustration={handleRegenerateIllustration}
              onRegenerateCover={handleRegenerateCover}
              onQuickDemoStart={handleQuickDemoStart}
              onInstantDemoPreview={handleInstantDemoPreview}
              onPauseGeneration={handlePauseGeneration}
              onResumeGeneration={handleResumeGeneration}
              onRetryFailedBatch={handleRetryFailedBatch}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
