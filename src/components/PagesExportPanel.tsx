import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileCode,
  FileText,
  Loader2,
  Pause,
  Play,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  ImageQueueSummary,
  StudyGuideDocument,
  TeacherProfile,
  ThemeId,
} from '../types/studyGuide';
import { THEME_PALETTES } from '../utils/themes';

interface PagesExportPanelProps {
  profile: TeacherProfile;
  document: StudyGuideDocument | null;
  activePageIndex: number; // 0 = Cover, 1..N = Content pages
  isRegeneratingCover: boolean;
  autoGenerateImages: boolean;
  imageQueueSummary: ImageQueueSummary;
  onToggleAutoImages: () => void;
  onStartImageQueue: () => void;
  onPauseImageQueue: () => void;
  onResumeImageQueue: () => void;
  onSelectPage: (index: number) => void;
  onProfileChange: (updated: Partial<TeacherProfile>) => void;
  onRegenerateCover: (customNote?: string) => void;
  onPrintPdf: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
}

export const PagesExportPanel: React.FC<PagesExportPanelProps> = ({
  profile,
  document,
  activePageIndex,
  isRegeneratingCover,
  autoGenerateImages,
  imageQueueSummary,
  onToggleAutoImages,
  onStartImageQueue,
  onPauseImageQueue,
  onResumeImageQueue,
  onSelectPage,
  onProfileChange,
  onRegenerateCover,
  onPrintPdf,
  onExportHtml,
  onExportMarkdown,
}) => {
  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <span className="block text-xs font-bold text-slate-700">
          صور الذكاء الاصطناعي والغلاف
        </span>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          تُولد صور الغلاف وكل صفحة بالذكاء الاصطناعي بالتتابع (صورة واحدة كل مرة) لحماية حد الطلبات وتخزينها محلياً.
        </p>

        <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer">
          <span>توليد جميع الصور تلقائياً</span>
          <input
            type="checkbox"
            checked={autoGenerateImages}
            onChange={onToggleAutoImages}
            className="accent-slate-900 w-4 h-4"
          />
        </label>

        {document && (
          <div className="p-2.5 rounded-lg border border-slate-200 bg-white space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-700 font-medium tabular-nums">
              <span>تقدم الصور:</span>
              <span>
                {imageQueueSummary.completed} / {imageQueueSummary.total} جاهزة
              </span>
            </div>
            {(imageQueueSummary.generating > 0 || imageQueueSummary.queued > 0) ? (
              imageQueueSummary.isPaused ? (
                <button
                  type="button"
                  onClick={onResumeImageQueue}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>استكمال توليد الصور</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPauseImageQueue}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 flex items-center justify-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف طابور الصور مؤقتاً</span>
                </button>
              )
            ) : (
              imageQueueSummary.completed < imageQueueSummary.total && (
                <button
                  type="button"
                  onClick={onStartImageQueue}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>بدء توليد جميع الصور المتبقية</span>
                </button>
              )
            )}
          </div>
        )}

        <button
          type="button"
          disabled={isRegeneratingCover}
          onClick={() => onRegenerateCover()}
          className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {isRegeneratingCover ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>جاري رسم صورة الغلاف...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة توليد صورة الغلاف</span>
            </>
          )}
        </button>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2.5">
        <span className="block text-xs font-bold text-slate-700">
          تبديل لوحة الألوان فوراً
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(THEME_PALETTES) as ThemeId[]).map((id) => {
            const theme = THEME_PALETTES[id];
            const active = profile.themeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onProfileChange({ themeId: id })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-right transition-colors ${
                  active
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span
                  className="w-4 h-4 rounded shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 55%, ${theme.secondary} 55%)`,
                  }}
                />
                <span className="text-xs font-medium text-slate-800 truncate">
                  {theme.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">فهرس صفحات المذكرة</span>
          {document && (
            <span className="text-[11px] text-slate-500 tabular-nums">
              {document.pages.length + 1} صفحات (الغلاف + {document.pages.length})
            </span>
          )}
        </div>

        {document ? (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pl-1">
            <button
              type="button"
              onClick={() => onSelectPage(0)}
              className={`w-full px-3 py-2 rounded-lg border text-right text-xs transition-colors flex items-center justify-between ${
                activePageIndex === 0
                  ? 'border-slate-900 bg-slate-900 text-white font-bold'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>صفحة الغلاف</span>
              <span className="text-[11px] opacity-75">٠</span>
            </button>
            {document.pages.map((page, idx) => (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelectPage(idx + 1)}
                className={`w-full px-3 py-2 rounded-lg border text-right text-xs transition-colors flex items-center justify-between gap-2 ${
                  activePageIndex === idx + 1
                    ? 'border-slate-900 bg-slate-900 text-white font-bold'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{page.lessonTitle}</span>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  {page.illustrationStatus === 'generating' && (
                    <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                  )}
                  {page.illustrationStatus === 'queued' && (
                    <Clock className="w-3 h-3 text-amber-400" />
                  )}
                  {page.illustrationStatus === 'error' && (
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                  )}
                  {(page.illustrationImageUrl ||
                    page.illustrationStatus === 'completed') &&
                    page.illustrationStatus !== 'generating' && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                  <span className="text-[11px] opacity-75 tabular-nums">
                    {page.pageNumber}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            قم بتوليد المذكرة من تبويب "المحتوى والفهرس" لعرض الصفحات والتنقل بينها هنا.
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2">
        <span className="block text-xs font-bold text-slate-700 mb-1">
          التصدير والطباعة
        </span>
        <button
          type="button"
          onClick={onPrintPdf}
          disabled={!document}
          className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة أو حفظ بصيغة PDF</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onExportHtml}
            disabled={!document}
            className="py-2 px-3 bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>تصدير HTML</span>
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            disabled={!document}
            className="py-2 px-3 bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>تصدير Markdown</span>
          </button>
        </div>

        {document && (
          <p className="text-[11px] text-slate-500 leading-relaxed flex items-center gap-1.5 pt-1">
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>عند اختيار طباعة PDF تأكد من تفعيل خيار "رسومات الخلفية" في نافذة الطباعة.</span>
          </p>
        )}
      </div>
    </div>
  );
};
