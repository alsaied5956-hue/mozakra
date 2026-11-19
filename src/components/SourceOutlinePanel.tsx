import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { SAMPLE_CURRICULA, SampleCurriculum } from '../data/samples';
import {
  DetailLevel,
  GenerationProgressState,
  OutlineLesson,
} from '../types/studyGuide';
import { DETAIL_LEVELS } from '../utils/themes';
import { computeTargetPageBudget } from '../utils/chunking';
import { extractTextFromFile } from '../utils/fileExtractor';

interface AnalysisProgress {
  currentChunk: number;
  totalChunks: number;
  label: string;
}

interface SourceOutlinePanelProps {
  rawText: string;
  sourcePageCount: number | null;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
  onRawTextChange: (text: string, pageCount?: number | null) => void;
  onApplySample: (sample: SampleCurriculum) => void;
  outline: OutlineLesson[];
  outlineSummary: string;
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  generationState: GenerationProgressState;
  onAnalyzeOutline: () => void;
  onMoveLesson: (index: number, dir: 'up' | 'down') => void;
  onRemoveLesson: (id: string) => void;
  onAddLesson: (title: string, subtopics: string) => void;
  onStartGeneration: (autoContinue: boolean) => void;
  onPauseGeneration: () => void;
  onResumeGeneration: (autoContinue: boolean) => void;
  onRetryFailedBatch: (autoContinue: boolean) => void;
}

export const SourceOutlinePanel: React.FC<SourceOutlinePanelProps> = ({
  rawText,
  sourcePageCount,
  detailLevel,
  onDetailLevelChange,
  onRawTextChange,
  onApplySample,
  outline,
  outlineSummary,
  isAnalyzing,
  analysisProgress,
  generationState,
  onAnalyzeOutline,
  onMoveLesson,
  onRemoveLesson,
  onAddLesson,
  onStartGeneration,
  onPauseGeneration,
  onResumeGeneration,
  onRetryFailedBatch,
}) => {
  const [fileStatus, setFileStatus] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonSubtopics, setNewLessonSubtopics] = useState('');

  const isRunningGeneration = generationState.status === 'running';

  const pageBudget = useMemo(() => {
    if (!rawText.trim()) return null;
    return computeTargetPageBudget(rawText, detailLevel, sourcePageCount);
  }, [rawText, detailLevel, sourcePageCount]);

  const estimatedOutlinePages = useMemo(
    () => outline.reduce((sum, l) => sum + (l.estimatedPages || 1), 0),
    [outline]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setFileStatus(null);
    setIsExtracting(true);
    setExtractProgress(null);
    try {
      const result = await extractTextFromFile(file, (curr, total) => {
        setExtractProgress(`جاري استخراج النص: صفحة ${curr} من ${total}...`);
      });
      onRawTextChange(result.text, result.pageCount ?? null);
      const pageInfo = result.pageCount ? ` (${result.pageCount} صفحة)` : '';
      setFileStatus(
        result.warning ||
          `تم استخراج محتوى "${file.name}"${pageInfo} بالكامل (${result.text.length} حرف).`
      );
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء قراءة الملف.'
      );
    } finally {
      setIsExtracting(false);
      setExtractProgress(null);
      e.target.value = '';
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim()) return;
    onAddLesson(newLessonTitle, newLessonSubtopics);
    setNewLessonTitle('');
    setNewLessonSubtopics('');
  };

  const progressPct =
    generationState.totalBatches > 0
      ? Math.round(
          ((generationState.status === 'completed'
            ? generationState.totalBatches
            : generationState.currentBatchIndex) /
            generationState.totalBatches) *
            100
        )
      : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="block text-xs font-bold text-slate-700">
          تجربة سريعة بنماذج مواد متنوعة
        </span>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_CURRICULA.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setFileError(null);
                setFileStatus(`تم تحميل نص "${sample.label}" — اضغط تحليل المحتوى للبدء.`);
                onApplySample(sample);
              }}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md transition-colors whitespace-nowrap"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 cursor-pointer transition-colors text-center">
          {isExtracting ? (
            <>
              <Loader2 className="w-5 h-5 text-slate-700 animate-spin" />
              <span className="text-xs font-medium text-slate-700">
                {extractProgress || 'جاري استخراج النص الكامل من الملف...'}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-slate-600" />
              <span className="text-xs font-bold text-slate-800">
                رفع ملف المادة الدراسية (PDF / Word .docx / TXT)
              </span>
              <span className="text-[11px] text-slate-500">
                يدعم المذكرات والكتب الطويلة بحجم صفحات متوازن ومنطقي
              </span>
            </>
          )}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileChange}
            disabled={isExtracting || isAnalyzing || isRunningGeneration}
            className="sr-only"
          />
        </label>

        {fileStatus && (
          <div className="px-3 py-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
            {fileStatus}
          </div>
        )}
        {fileError && (
          <div className="px-3 py-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
            {fileError}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="source-text-area"
            className="text-xs font-bold text-slate-700"
          >
            نص المادة الدراسية أو المذكرة الأصلية
          </label>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {rawText.trim().length.toLocaleString('ar-EG')} حرف
          </span>
        </div>
        <textarea
          id="source-text-area"
          rows={6}
          value={rawText}
          onChange={(e) => onRawTextChange(e.target.value, null)}
          placeholder="الصق هنا نص الدروس أو ارفع ملف PDF/Word ليقوم الاستوديو بتحليلها مع الحفاظ على التسلسل الكامل..."
          className="w-full px-3 py-2.5 text-xs leading-relaxed bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 resize-y"
        />
      </div>

      {/* Detail & Length Mode Selector + Balanced Source Scale */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="source-detail-level"
            className="text-xs font-bold text-slate-700 whitespace-nowrap"
          >
            مستوى التفصيل والطول:
          </label>
          <select
            id="source-detail-level"
            value={detailLevel}
            onChange={(e) => onDetailLevelChange(e.target.value as DetailLevel)}
            disabled={isAnalyzing || isRunningGeneration}
            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none"
          >
            {DETAIL_LEVELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {pageBudget && (
          <div
            className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums"
            data-testid="page-budget-summary"
          >
            <span>حجم المصدر: {pageBudget.estimatedSourcePages} صفحة</span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-slate-800">
              النطاق المتوازن المستهدف: {pageBudget.minPages}–{pageBudget.maxPages} صفحة
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAnalyzeOutline}
        disabled={isAnalyzing || isRunningGeneration || rawText.trim().length < 20}
        className="w-full py-2.5 px-4 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {analysisProgress
                ? `جاري تحليل الجزء ${analysisProgress.currentChunk} من ${analysisProgress.totalChunks} (${analysisProgress.label})...`
                : 'جاري تحليل الهيكل واستخراج الفهرس...'}
            </span>
          </>
        ) : (
          <>
            <FileText className="w-4 h-4" />
            <span>تحليل المحتوى الكامل واستخراج الفهرس</span>
          </>
        )}
      </button>

      {outline.length > 0 && (
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900">
                معاينة تسلسل الدروس ({outline.length} درس)
              </h3>
              <span className="text-[11px] text-slate-600 tabular-nums">
                التقدير: {estimatedOutlinePages} صفحة
              </span>
            </div>
            {outlineSummary && (
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {outlineSummary}
              </p>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
            {outline.map((lesson, idx) => (
              <div
                key={lesson.id}
                className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      <span className="tabular-nums text-slate-500 ml-1">
                        {lesson.order}.
                      </span>
                      {lesson.title}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {lesson.subtopics.join(' · ')}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      {lesson.sourceRange && <span>{lesson.sourceRange}</span>}
                      <span>~{lesson.estimatedPages} صفحة</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMoveLesson(idx, 'up')}
                      disabled={idx === 0 || isRunningGeneration}
                      aria-label={`تحريك "${lesson.title}" للأعلى`}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveLesson(idx, 'down')}
                      disabled={idx === outline.length - 1 || isRunningGeneration}
                      aria-label={`تحريك "${lesson.title}" للأسفل`}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveLesson(lesson.id)}
                      disabled={isRunningGeneration}
                      aria-label={`حذف "${lesson.title}"`}
                      className="p-1 text-slate-400 hover:text-rose-700 disabled:opacity-30 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSubmit} className="space-y-1.5 pt-1">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="إضافة عنوان درس جديد..."
                aria-label="إضافة عنوان درس جديد"
                disabled={isRunningGeneration}
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
              <button
                type="submit"
                disabled={isRunningGeneration}
                aria-label="إضافة الدرس للفهرس"
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة</span>
              </button>
            </div>
            {newLessonTitle.trim().length > 0 && (
              <input
                type="text"
                value={newLessonSubtopics}
                onChange={(e) => setNewLessonSubtopics(e.target.value)}
                placeholder="نقاط فرعية مفصولة بفاصلة (اختياري)"
                aria-label="نقاط فرعية للدرس الجديد"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              />
            )}
          </form>

          {/* Incremental Multi-Batch Generation Controls */}
          <div className="border-t border-slate-200 pt-3 space-y-2.5">
            {generationState.status !== 'idle' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>
                    {generationState.status === 'running' &&
                      `جاري توليد الدفعة ${Math.min(
                        generationState.currentBatchIndex + 1,
                        generationState.totalBatches
                      )} من ${generationState.totalBatches}...`}
                    {generationState.status === 'paused' &&
                      `متوقف مؤقتاً عند الدفعة ${generationState.currentBatchIndex + 1} من ${generationState.totalBatches}`}
                    {generationState.status === 'error' &&
                      `تعذرت الدفعة ${(generationState.failedBatchIndex ?? 0) + 1} من ${generationState.totalBatches}`}
                    {generationState.status === 'completed' &&
                      `اكتمل التوليد (${generationState.generatedPagesCount} صفحة فعلياً من أصل ${estimatedOutlinePages} متوقعة)`}
                  </span>
                  <span className="tabular-nums text-[11px] text-slate-500">
                    {progressPct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      generationState.status === 'error'
                        ? 'bg-rose-600'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-600 tabular-nums">
                  تم إنجاز {generationState.completedLessonsCount} من{' '}
                  {generationState.totalLessonsCount} درس ·{' '}
                  {generationState.generatedPagesCount} صفحة دراسية
                </div>
              </div>
            )}

            {generationState.status === 'running' ? (
              <button
                type="button"
                onClick={onPauseGeneration}
                className="w-full py-2.5 px-4 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
              >
                <Pause className="w-4 h-4" />
                <span>إيقاف مؤقت بعد الدفعة الحالية</span>
              </button>
            ) : generationState.status === 'paused' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onResumeGeneration(true)}
                  className="w-full py-2.5 px-4 bg-emerald-700 text-white text-sm font-bold rounded-lg hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>استكمال وتوليد الكل تلقائياً</span>
                </button>
                <button
                  type="button"
                  onClick={() => onResumeGeneration(false)}
                  className="w-full py-2 px-4 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  استكمال التوليد (الدفعة التالية فقط)
                </button>
              </div>
            ) : generationState.status === 'error' ? (
              <div className="space-y-2">
                <div className="px-3 py-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
                  {generationState.errorMessage || 'تعذر توليد الدفعة. يرجى إعادة المحاولة.'}
                </div>
                <button
                  type="button"
                  onClick={() => onRetryFailedBatch(true)}
                  className="w-full py-2.5 px-4 bg-rose-700 text-white text-sm font-bold rounded-lg hover:bg-rose-800 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>إعادة محاولة الدفعة واستكمال التوليد</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartGeneration(true)}
                  className="w-full py-2 px-4 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  إعادة التوليد من البداية
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onStartGeneration(true)}
                  disabled={isAnalyzing}
                  className="w-full py-3 px-4 bg-emerald-700 text-white text-sm font-bold rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>
                    {generationState.status === 'completed'
                      ? 'إعادة توليد المذكرة كاملة تلقائياً'
                      : 'توليد الكل تلقائياً (دفعة بدفعة)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartGeneration(false)}
                  disabled={isAnalyzing}
                  className="w-full py-2 px-3 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  توليد الدفعة الأولى فقط للمعاينة
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
