import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  CoverVisualSpec,
  GenerationProgressState,
  ImageGenerationStatus,
  ImageQueueSummary,
  StudyGuideDocument,
  StudyPage,
  TeacherProfile,
  ThemePalette,
} from '../types/studyGuide';
import { A4CoverPage } from './A4CoverPage';
import { A4ContentPage } from './A4ContentPage';

interface StudioCanvasProps {
  profile: TeacherProfile;
  palette: ThemePalette;
  document: StudyGuideDocument | null;
  outlineLessonTitles: string[];
  coverVisualSpec?: CoverVisualSpec;
  coverImageUrl?: string;
  coverImageStatus: ImageGenerationStatus;
  coverImageError?: string;
  activePageIndex: number; // 0 = cover, 1..N = pages
  viewMode: 'single' | 'all';
  isEditing: boolean;
  isRegeneratingCover: boolean;
  generationState: GenerationProgressState;
  regeneratingPageId: string | null;
  autoGenerateImages: boolean;
  imageQueueSummary: ImageQueueSummary;
  onToggleAutoImages: () => void;
  onStartImageQueue: () => void;
  onPauseImageQueue: () => void;
  onResumeImageQueue: () => void;
  onRetryFailedImages: () => void;
  onSelectPage: (index: number) => void;
  onViewModeChange: (mode: 'single' | 'all') => void;
  onToggleEditing: () => void;
  onUpdateDocumentMeta: (title: string, summary: string) => void;
  onUpdatePage: (pageId: string, updated: Partial<StudyPage>) => void;
  onRegenerateIllustration: (pageId: string, customNote?: string) => void;
  onRegenerateCover: (customNote?: string) => void;
  onQuickDemoStart: () => void;
  onInstantDemoPreview: () => void;
  onPauseGeneration: () => void;
  onResumeGeneration: (autoContinue: boolean) => void;
  onRetryFailedBatch: (autoContinue: boolean) => void;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  profile,
  palette,
  document,
  outlineLessonTitles,
  coverVisualSpec,
  coverImageUrl,
  coverImageStatus,
  coverImageError,
  activePageIndex,
  viewMode,
  isEditing,
  isRegeneratingCover,
  generationState,
  regeneratingPageId,
  autoGenerateImages,
  imageQueueSummary,
  onToggleAutoImages,
  onStartImageQueue,
  onPauseImageQueue,
  onResumeImageQueue,
  onRetryFailedImages,
  onSelectPage,
  onViewModeChange,
  onToggleEditing,
  onUpdateDocumentMeta,
  onUpdatePage,
  onRegenerateIllustration,
  onRegenerateCover,
  onQuickDemoStart,
  onInstantDemoPreview,
  onPauseGeneration,
  onResumeGeneration,
  onRetryFailedBatch,
}) => {
  const totalSheets = document ? document.pages.length + 1 : 1;
  const clampedIndex = Math.max(0, Math.min(activePageIndex, totalSheets - 1));
  const isWaitingForFirstBatch =
    generationState.status === 'running' &&
    (!document || document.pages.length === 0);

  const effectiveTopics =
    document?.pages?.length
      ? document.pages.slice(0, 3).map((p) => p.lessonTitle)
      : outlineLessonTitles.slice(0, 3);

  const effectiveCoverSpec = document?.coverVisualSpec || coverVisualSpec;

  if (isWaitingForFirstBatch) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-slate-800">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
            <span>
              جاري توليد الدفعة {generationState.currentBatchIndex + 1} من{' '}
              {generationState.totalBatches} (صياغة الدروس وإعداد المشاهد التوضيحية)...
            </span>
          </div>
          <button
            type="button"
            onClick={onPauseGeneration}
            className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 whitespace-nowrap"
          >
            إيقاف مؤقت
          </button>
        </div>
        <div className="a4-sheet mx-auto rounded-xl border border-slate-200 bg-white p-10 space-y-6 animate-pulse">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <div className="space-y-2 w-1/2">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-3/4" />
            </div>
            <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          </div>
          <div className="h-48 bg-slate-100 rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 bg-slate-100 rounded-xl" />
            <div className="h-28 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="a4-canvas-stage" className="space-y-4">
      {generationState.status !== 'idle' &&
        generationState.status !== 'completed' && (
          <div
            className="no-print bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            data-testid="canvas-batch-progress"
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-800">
              {generationState.status === 'running' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-700 shrink-0" />
                  <span>
                    جاري توليد الدفعة{' '}
                    {Math.min(
                      generationState.currentBatchIndex + 1,
                      generationState.totalBatches
                    )}{' '}
                    من {generationState.totalBatches} · تم توليد{' '}
                    {generationState.generatedPagesCount} صفحة حتى الآن
                  </span>
                </>
              )}
              {generationState.status === 'paused' && (
                <span>
                  تم توليد {generationState.generatedPagesCount} صفحة (
                  {generationState.completedLessonsCount} من{' '}
                  {generationState.totalLessonsCount} درس)
                </span>
              )}
              {generationState.status === 'error' && (
                <span className="text-rose-800">
                  تعذرت الدفعة {(generationState.failedBatchIndex ?? 0) + 1}:{' '}
                  {generationState.errorMessage}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {generationState.status === 'running' && (
                <button
                  type="button"
                  onClick={onPauseGeneration}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف مؤقت</span>
                </button>
              )}
              {generationState.status === 'paused' && (
                <>
                  <button
                    type="button"
                    onClick={() => onResumeGeneration(false)}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    استكمال الدفعة التالية
                  </button>
                  <button
                    type="button"
                    onClick={() => onResumeGeneration(true)}
                    className="px-3 py-1.5 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>توليد الكل تلقائياً</span>
                  </button>
                </>
              )}
              {generationState.status === 'error' && (
                <button
                  type="button"
                  onClick={() => onRetryFailedBatch(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-rose-700 text-white rounded-lg hover:bg-rose-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة محاولة الدفعة</span>
                </button>
              )}
            </div>
          </div>
        )}

      {/* Studio Workspace Toolbar */}
      <div className="no-print bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!document || clampedIndex <= 0}
            onClick={() => onSelectPage(clampedIndex - 1)}
            aria-label="الصفحة السابقة"
            className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-slate-800 px-2 tabular-nums">
            {document
              ? clampedIndex === 0
                ? `الغلاف · ١ من ${totalSheets}`
                : `صفحة ${clampedIndex} من ${document.pages.length}`
              : 'معاينة الغلاف المبدئية'}
          </span>

          <button
            type="button"
            disabled={!document || clampedIndex >= totalSheets - 1}
            onClick={() => onSelectPage(clampedIndex + 1)}
            aria-label="الصفحة التالية"
            className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {document && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onViewModeChange('single')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'single'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                صفحة واحدة
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>كل الصفحات</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleEditing}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              isEditing
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isEditing ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>إنهاء التعديل</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل مباشر</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sequential AI Image Generation Queue & Auto-Generate Control Bar */}
      {(document || imageQueueSummary.generating > 0 || imageQueueSummary.queued > 0) && (
        <div
          className="no-print bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          data-testid="image-queue-bar"
        >
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              {imageQueueSummary.generating > 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-700 shrink-0" />
              ) : (
                <ImageIcon className="w-4 h-4 text-slate-700 shrink-0" />
              )}
              <span className="tabular-nums">
                صور الذكاء الاصطناعي: تم توليد {imageQueueSummary.completed} من{' '}
                {imageQueueSummary.total}
              </span>
            </div>

            {imageQueueSummary.queued > 0 && (
              <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md tabular-nums">
                في الانتظار: {imageQueueSummary.queued}
              </span>
            )}

            {imageQueueSummary.activeLabel && (
              <span className="text-[11px] text-sky-800 font-medium truncate max-w-[260px]">
                {imageQueueSummary.activeLabel}
              </span>
            )}

            {imageQueueSummary.cooldownSeconds !== null &&
              imageQueueSummary.cooldownSeconds > 0 && (
                <span className="text-[11px] text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md font-bold tabular-nums">
                  تهدئة حماية الحد: استئناف خلال {imageQueueSummary.cooldownSeconds} ث
                </span>
              )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={autoGenerateImages}
                onChange={onToggleAutoImages}
                className="accent-slate-900 w-3.5 h-3.5"
              />
              <span>توليد جميع الصور تلقائياً</span>
            </label>

            {imageQueueSummary.generating > 0 || imageQueueSummary.queued > 0 ? (
              imageQueueSummary.isPaused ? (
                <button
                  type="button"
                  onClick={onResumeImageQueue}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استكمال الصور</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPauseImageQueue}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف الصور مؤقتاً</span>
                </button>
              )
            ) : (
              imageQueueSummary.completed < imageQueueSummary.total && (
                <button
                  type="button"
                  onClick={onStartImageQueue}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>توليد الصور المتبقية</span>
                </button>
              )
            )}

            {imageQueueSummary.failed > 0 && (
              <button
                type="button"
                onClick={onRetryFailedImages}
                className="px-3 py-1.5 text-xs font-bold bg-rose-700 text-white rounded-lg hover:bg-rose-800 inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة محاولة المتعثر ({imageQueueSummary.failed})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Onboarding Helper Banner when no study guide is generated yet */}
      {!document && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">
              معاينة حية للغلاف الديناميكي — يتغير تلقائياً مع المادة والمحتوى
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              تتحدّث هوية الغلاف والشعار والرسوم فوراً مع اختيار المادة (تاريخ، برمجة، علوم، أو أي مادة مخصصة) ورفع الملف.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onQuickDemoStart}
              className="px-3.5 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تحميل مادة تجريبية الآن</span>
            </button>
            <button
              type="button"
              onClick={onInstantDemoPreview}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              معاينة نموذج مكتمل فوراً
            </button>
          </div>
        </div>
      )}

      {/* Interactive Preview Stage */}
      <div className="space-y-6">
        {!document ? (
          <A4CoverPage
            profile={profile}
            palette={palette}
            guideTitle={profile.guideTitle}
            outlineSummary=""
            lessonTopics={effectiveTopics}
            coverVisualSpec={effectiveCoverSpec}
            coverImageUrl={coverImageUrl}
            coverImageStatus={coverImageStatus}
            coverImageError={coverImageError}
            totalPages={0}
            isEditing={isEditing}
            isRegeneratingCover={isRegeneratingCover}
            onUpdateTitle={(title) => onUpdateDocumentMeta(title, '')}
            onUpdateSummary={() => {}}
            onRegenerateCover={onRegenerateCover}
          />
        ) : viewMode === 'all' ? (
          <>
            <A4CoverPage
              profile={profile}
              palette={palette}
              guideTitle={document.guideTitle}
              outlineSummary={document.outlineSummary}
              lessonTopics={effectiveTopics}
              coverVisualSpec={effectiveCoverSpec}
              coverImageUrl={document.coverImageUrl || coverImageUrl}
              coverImageStatus={document.coverImageStatus || coverImageStatus}
              coverImageError={document.coverImageError || coverImageError}
              totalPages={document.pages.length}
              isEditing={isEditing}
              isRegeneratingCover={isRegeneratingCover}
              onUpdateTitle={(title) =>
                onUpdateDocumentMeta(title, document.outlineSummary)
              }
              onUpdateSummary={(summary) =>
                onUpdateDocumentMeta(document.guideTitle, summary)
              }
              onRegenerateCover={onRegenerateCover}
            />
            {document.pages.map((page) => (
              <A4ContentPage
                key={page.id}
                page={page}
                totalPages={document.pages.length}
                profile={profile}
                palette={palette}
                guideTitle={document.guideTitle}
                isEditing={isEditing}
                isRegeneratingIllustration={regeneratingPageId === page.id}
                onUpdatePage={onUpdatePage}
                onRegenerateIllustration={onRegenerateIllustration}
              />
            ))}
          </>
        ) : clampedIndex === 0 ? (
          <A4CoverPage
            profile={profile}
            palette={palette}
            guideTitle={document.guideTitle}
            outlineSummary={document.outlineSummary}
            lessonTopics={effectiveTopics}
            coverVisualSpec={effectiveCoverSpec}
            coverImageUrl={document.coverImageUrl || coverImageUrl}
            coverImageStatus={document.coverImageStatus || coverImageStatus}
            coverImageError={document.coverImageError || coverImageError}
            totalPages={document.pages.length}
            isEditing={isEditing}
            isRegeneratingCover={isRegeneratingCover}
            onUpdateTitle={(title) =>
              onUpdateDocumentMeta(title, document.outlineSummary)
            }
            onUpdateSummary={(summary) =>
              onUpdateDocumentMeta(document.guideTitle, summary)
            }
            onRegenerateCover={onRegenerateCover}
          />
        ) : (
          <A4ContentPage
            page={document.pages[clampedIndex - 1]}
            totalPages={document.pages.length}
            profile={profile}
            palette={palette}
            guideTitle={document.guideTitle}
            isEditing={isEditing}
            isRegeneratingIllustration={
              regeneratingPageId === document.pages[clampedIndex - 1].id
            }
            onUpdatePage={onUpdatePage}
            onRegenerateIllustration={onRegenerateIllustration}
          />
        )}
      </div>

      {/* Hidden Print-All Container when in single-page screen mode */}
      {document && viewMode === 'single' && (
        <div className="hidden print-only-container">
          <A4CoverPage
            profile={profile}
            palette={palette}
            guideTitle={document.guideTitle}
            outlineSummary={document.outlineSummary}
            lessonTopics={effectiveTopics}
            coverVisualSpec={effectiveCoverSpec}
            coverImageUrl={document.coverImageUrl || coverImageUrl}
            coverImageStatus={document.coverImageStatus || coverImageStatus}
            coverImageError={document.coverImageError || coverImageError}
            totalPages={document.pages.length}
            isEditing={false}
            isPrintClone={true}
            onUpdateTitle={() => {}}
            onUpdateSummary={() => {}}
          />
          {document.pages.map((page) => (
            <A4ContentPage
              key={`print-${page.id}`}
              page={page}
              totalPages={document.pages.length}
              profile={profile}
              palette={palette}
              guideTitle={document.guideTitle}
              isEditing={false}
              isRegeneratingIllustration={false}
              isPrintClone={true}
              onUpdatePage={() => {}}
              onRegenerateIllustration={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
};
