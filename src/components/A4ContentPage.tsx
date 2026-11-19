import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  ImageGenerationStatus,
  StudyPage,
  TeacherProfile,
  ThemePalette,
} from '../types/studyGuide';
import { formatSubjectGrade } from '../utils/themes';
import { TeacherLogoMark } from './TeacherLogoMark';

interface A4ContentPageProps {
  page: StudyPage;
  totalPages: number;
  profile: TeacherProfile;
  palette: ThemePalette;
  guideTitle?: string;
  isEditing: boolean;
  isRegeneratingIllustration: boolean;
  isPrintClone?: boolean;
  onUpdatePage: (pageId: string, updated: Partial<StudyPage>) => void;
  onRegenerateIllustration: (pageId: string, customNote?: string) => void;
}

export const A4ContentPage: React.FC<A4ContentPageProps> = ({
  page,
  totalPages,
  profile,
  palette,
  guideTitle,
  isEditing,
  isRegeneratingIllustration,
  isPrintClone = false,
  onUpdatePage,
  onRegenerateIllustration,
}) => {
  const [customNote, setCustomNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const teacherDisplay = profile.teacherName.trim();
  const subjectDisplay =
    formatSubjectGrade(profile.subject, profile.gradeLevel) ||
    profile.subjectGrade.trim();
  const effectiveGuideTitle = (guideTitle || profile.guideTitle || 'المذكرة الدراسية').trim();

  const effectiveImageStatus: ImageGenerationStatus = isRegeneratingIllustration
    ? 'generating'
    : page.illustrationStatus || (page.illustrationImageUrl ? 'completed' : 'idle');

  const handleBlockChange = (
    blockIdx: number,
    field: 'heading' | 'body',
    value: string
  ) => {
    const nextBlocks = page.explanationBlocks.map((b, i) =>
      i === blockIdx ? { ...b, [field]: value } : b
    );
    onUpdatePage(page.id, { explanationBlocks: nextBlocks });
  };

  const handleRecapChange = (recapIdx: number, value: string) => {
    const nextRecap = page.quickRecap.map((item, i) =>
      i === recapIdx ? value : item
    );
    onUpdatePage(page.id, { quickRecap: nextRecap });
  };

  return (
    <article
      className="a4-sheet mx-auto rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between bg-white"
      data-testid={isPrintClone ? undefined : `a4-content-page-${page.pageNumber}`}
    >
      <div
        className="h-2 w-full shrink-0"
        style={{ backgroundColor: palette.primary }}
      />

      <div className="flex-1 flex flex-col justify-between p-8 sm:p-10">
        {/* Page Header with Page Number paired right next to Teacher Logo */}
        <header
          className="flex items-start justify-between gap-4 pb-4 border-b"
          style={{ borderColor: palette.softBorder }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500">
              الدرس <span className="tabular-nums">{page.lessonOrder}</span>
              {subjectDisplay ? ` · ${subjectDisplay}` : ''}
            </div>
            {isEditing ? (
              <div className="space-y-1.5 mt-1">
                <input
                  type="text"
                  value={page.lessonTitle}
                  onChange={(e) =>
                    onUpdatePage(page.id, { lessonTitle: e.target.value })
                  }
                  aria-label="تعديل عنوان الدرس"
                  className="w-full font-display text-xl font-bold px-2.5 py-1 border border-slate-300 rounded-md"
                  style={{ color: palette.primaryDark }}
                />
                <input
                  type="text"
                  value={page.pageSubtitle}
                  onChange={(e) =>
                    onUpdatePage(page.id, { pageSubtitle: e.target.value })
                  }
                  aria-label="تعديل العنوان الفرعي للدرس"
                  className="w-full text-xs text-slate-600 px-2.5 py-1 border border-slate-300 rounded-md"
                />
              </div>
            ) : (
              <>
                <h2
                  className="font-display text-xl sm:text-2xl font-extrabold mt-0.5 leading-snug"
                  style={{ color: palette.primaryDark, textWrap: 'balance' }}
                >
                  {page.lessonTitle}
                </h2>
                {page.pageSubtitle && (
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    {page.pageSubtitle}
                  </p>
                )}
              </>
            )}
          </div>

          <div
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border shrink-0"
            style={{
              backgroundColor: palette.softSurface,
              borderColor: palette.softBorder,
            }}
            data-testid={isPrintClone ? undefined : `page-logo-badge-${page.pageNumber}`}
          >
            <div className="text-left">
              <div
                className="font-display text-xs font-extrabold tabular-nums"
                style={{ color: palette.primaryDark }}
              >
                صفحة {page.pageNumber}
              </div>
              <div className="text-[10px] text-slate-600 truncate max-w-[115px]">
                {teacherDisplay || 'المعلم'}
              </div>
            </div>
            <TeacherLogoMark profile={profile} palette={palette} size="sm" />
          </div>
        </header>

        {/* Main Pedagogical Body */}
        <div className="flex-1 py-4 space-y-4">
          {/* Native AI Educational Illustration Matching This Page */}
          <div
            className="rounded-xl border p-3"
            style={{
              backgroundColor: palette.softSurface,
              borderColor: palette.softBorder,
            }}
          >
            {!isPrintClone && (
              <div className="no-print mb-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-600">
                  مشهد تعليمي بالذكاء الاصطناعي
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-bold ${
                    effectiveImageStatus === 'generating'
                      ? 'text-sky-700'
                      : effectiveImageStatus === 'queued'
                      ? 'text-amber-700'
                      : effectiveImageStatus === 'error'
                      ? 'text-rose-700'
                      : page.illustrationImageUrl || effectiveImageStatus === 'completed'
                      ? 'text-emerald-700'
                      : 'text-slate-500'
                  }`}
                  data-testid={`page-image-status-${page.pageNumber}`}
                >
                  {effectiveImageStatus === 'generating' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري رسم المشهد بالذكاء الاصطناعي...</span>
                    </>
                  )}
                  {effectiveImageStatus === 'queued' && (
                    <>
                      <Clock className="w-3 h-3" />
                      <span>في انتظار الدور...</span>
                    </>
                  )}
                  {effectiveImageStatus === 'error' && (
                    <>
                      <AlertCircle className="w-3 h-3" />
                      <span>تعذر التوليد</span>
                    </>
                  )}
                  {(effectiveImageStatus === 'completed' ||
                    (effectiveImageStatus === 'idle' && page.illustrationImageUrl)) && (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>تم التوليد</span>
                    </>
                  )}
                  {effectiveImageStatus === 'idle' && !page.illustrationImageUrl && (
                    <span>بانتظار التوليد</span>
                  )}
                </span>
              </div>
            )}

            <div
              className="relative w-full max-w-[480px] mx-auto aspect-[16/9] rounded-lg overflow-hidden flex items-center justify-center bg-white border"
              style={{ borderColor: palette.softBorder }}
            >
              {page.illustrationImageUrl ? (
                <>
                  <img
                    src={page.illustrationImageUrl}
                    alt={page.illustrationCaption || page.lessonTitle}
                    className="w-full h-full object-cover"
                    data-testid={
                      isPrintClone ? undefined : `page-ai-image-${page.pageNumber}`
                    }
                  />
                  {effectiveImageStatus === 'generating' && (
                    <div className="no-print absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-4 text-center">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-xs font-bold">
                        جاري رسم المشهد الجديد بالذكاء الاصطناعي...
                      </span>
                    </div>
                  )}
                </>
              ) : effectiveImageStatus === 'generating' ? (
                <div className="flex flex-col items-center gap-2 text-slate-700 px-5 text-center">
                  <Loader2
                    className="w-6 h-6 animate-spin"
                    style={{ color: palette.primary }}
                  />
                  <span className="text-xs font-bold">
                    جاري رسم المشهد بالذكاء الاصطناعي...
                  </span>
                  <span className="text-[11px] text-slate-500 line-clamp-2">
                    {page.illustrationSpec?.sceneDescription || page.illustrationCaption}
                  </span>
                </div>
              ) : effectiveImageStatus === 'queued' ? (
                <div className="flex flex-col items-center gap-2 text-slate-600 px-5 text-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                  <span className="text-xs font-bold">في انتظار الدور...</span>
                  <span className="text-[11px] text-slate-500 line-clamp-2">
                    {page.illustrationSpec?.sceneTitle || page.lessonTitle}
                  </span>
                </div>
              ) : effectiveImageStatus === 'error' ? (
                <div className="flex flex-col items-center gap-2 text-rose-800 px-5 text-center">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                  <span className="text-xs font-bold">
                    {page.illustrationError || 'تعذر توليد الصورة بالذكاء الاصطناعي.'}
                  </span>
                  {!isPrintClone && (
                    <button
                      type="button"
                      onClick={() =>
                        onRegenerateIllustration(page.id, customNote.trim() || undefined)
                      }
                      className="no-print mt-1 px-3 py-1.5 text-[11px] font-bold bg-rose-700 text-white rounded-md hover:bg-rose-800 inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>إعادة المحاولة</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-600 px-5 text-center">
                  <Sparkles className="w-6 h-6" style={{ color: palette.primary }} />
                  <span className="text-xs font-bold text-slate-800">
                    {page.illustrationSpec?.sceneTitle || page.lessonTitle}
                  </span>
                  <span className="text-[11px] text-slate-500 line-clamp-2">
                    {page.illustrationSpec?.sceneDescription || page.illustrationCaption}
                  </span>
                  {!isPrintClone && (
                    <button
                      type="button"
                      onClick={() =>
                        onRegenerateIllustration(page.id, customNote.trim() || undefined)
                      }
                      className="no-print mt-1 px-3 py-1.5 text-[11px] font-bold text-white rounded-md inline-flex items-center gap-1"
                      style={{ backgroundColor: palette.primary }}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>توليد الصورة الآن</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {isEditing ? (
                <input
                  type="text"
                  value={page.illustrationCaption}
                  onChange={(e) =>
                    onUpdatePage(page.id, { illustrationCaption: e.target.value })
                  }
                  aria-label="تعديل تعليق الرسم التوضيحي"
                  className="flex-1 text-xs text-slate-700 px-2 py-1 bg-white border border-slate-300 rounded"
                />
              ) : (
                <p className="text-xs text-slate-600 font-medium">
                  {page.illustrationSpec?.sceneDescription || page.illustrationCaption}
                </p>
              )}

              {!isPrintClone && (
                <div className="no-print flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowNoteInput((prev) => !prev)}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md transition-colors"
                  >
                    توجيه المشهد
                  </button>
                  <button
                    type="button"
                    disabled={effectiveImageStatus === 'generating'}
                    onClick={() => {
                      onRegenerateIllustration(page.id, customNote.trim() || undefined);
                      setShowNoteInput(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-white rounded-md transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                    style={{ backgroundColor: palette.primary }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      {page.illustrationImageUrl ? 'إعادة توليد الصورة' : 'توليد الصورة'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {showNoteInput && (
              <div className="no-print mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="أضف فكرة للمشهد (مثال: ركّز على خطة الالتفاف في المعركة أو خطوات حلقة التكرار)..."
                  aria-label="فكرة مخصصة للمشهد التوضيحي"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateIllustration(page.id, customNote.trim() || undefined);
                    setShowNoteInput(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-md"
                >
                  تطبيق
                </button>
              </div>
            )}
          </div>

          {/* Fresh Explanation Blocks */}
          <div className="space-y-3">
            {page.explanationBlocks.map((block, idx) => (
              <div key={idx} className="space-y-1">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={block.heading}
                      onChange={(e) =>
                        handleBlockChange(idx, 'heading', e.target.value)
                      }
                      aria-label={`عنوان الفقرة ${idx + 1}`}
                      className="w-full font-display text-sm font-bold px-2.5 py-1 border border-slate-300 rounded-md"
                      style={{ color: palette.primaryDark }}
                    />
                    <textarea
                      rows={3}
                      value={block.body}
                      onChange={(e) =>
                        handleBlockChange(idx, 'body', e.target.value)
                      }
                      aria-label={`نص الفقرة ${idx + 1}`}
                      className="w-full text-xs leading-relaxed text-slate-800 px-2.5 py-1.5 border border-slate-300 rounded-md"
                    />
                  </>
                ) : (
                  <>
                    <h3
                      className="font-display text-sm sm:text-base font-bold"
                      style={{ color: palette.primaryDark }}
                    >
                      {block.heading}
                    </h3>
                    <p className="text-xs sm:text-[13.5px] leading-relaxed text-slate-800">
                      {block.body}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Optional Programming / Formula Code Block */}
          {(isEditing || (page.codeSnippet && page.codeSnippet.trim().length > 0)) && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-100 p-3">
              <div className="text-[10px] font-bold text-sky-300 mb-1.5">
                مثال تطبيقي / شيفرة برمجية
              </div>
              {isEditing ? (
                <textarea
                  dir="ltr"
                  rows={3}
                  value={page.codeSnippet || ''}
                  onChange={(e) =>
                    onUpdatePage(page.id, { codeSnippet: e.target.value })
                  }
                  placeholder="أضف كوداً برمجياً أو معادلة توضيحية..."
                  aria-label="تعديل الشيفرة البرمجية"
                  className="w-full bg-slate-950 text-slate-100 font-mono text-xs p-2 rounded border border-slate-700"
                />
              ) : (
                <pre
                  dir="ltr"
                  className="font-mono text-xs leading-relaxed overflow-x-auto text-emerald-200"
                >
                  <code>{page.codeSnippet}</code>
                </pre>
              )}
            </div>
          )}

          {/* Mental Analogy & Common Student Pitfall */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className="rounded-xl border p-3.5"
              style={{
                backgroundColor: palette.softSurface,
                borderColor: palette.softBorder,
              }}
            >
              <div
                className="font-display text-[11px] font-bold mb-1"
                style={{ color: palette.primary }}
              >
                معلومة بصورة / تشبيه تخيلي
              </div>
              {isEditing ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={page.analogyTitle}
                    onChange={(e) =>
                      onUpdatePage(page.id, { analogyTitle: e.target.value })
                    }
                    aria-label="عنوان التشبيه التخيلي"
                    className="w-full text-xs font-bold bg-white border border-slate-300 rounded px-2 py-1"
                  />
                  <textarea
                    rows={3}
                    value={page.analogyText}
                    onChange={(e) =>
                      onUpdatePage(page.id, { analogyText: e.target.value })
                    }
                    aria-label="نص التشبيه التخيلي"
                    className="w-full text-xs bg-white border border-slate-300 rounded px-2 py-1"
                  />
                </div>
              ) : (
                <>
                  <div className="font-display text-xs font-bold text-slate-900 mb-1">
                    {page.analogyTitle}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {page.analogyText}
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
              <div className="font-display text-[11px] font-bold text-amber-800 mb-1">
                تنبيه مهم / فخ بيقع فيه الطلاب
              </div>
              {isEditing ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={page.pitfallTitle}
                    onChange={(e) =>
                      onUpdatePage(page.id, { pitfallTitle: e.target.value })
                    }
                    aria-label="عنوان التنبيه المهم"
                    className="w-full text-xs font-bold bg-white border border-amber-300 rounded px-2 py-1"
                  />
                  <textarea
                    rows={3}
                    value={page.pitfallText}
                    onChange={(e) =>
                      onUpdatePage(page.id, { pitfallText: e.target.value })
                    }
                    aria-label="نص التنبيه المهم"
                    className="w-full text-xs bg-white border border-amber-300 rounded px-2 py-1"
                  />
                </div>
              ) : (
                <>
                  <div className="font-display text-xs font-bold text-slate-900 mb-1">
                    {page.pitfallTitle}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {page.pitfallText}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Quick Recap */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            <div
              className="font-display text-xs font-bold mb-1.5"
              style={{ color: palette.primaryDark }}
            >
              خلاصة سريعة
            </div>
            <ul className="space-y-1 list-disc pr-4 text-xs text-slate-700 leading-relaxed">
              {page.quickRecap.map((item, idx) => (
                <li key={idx}>
                  {isEditing ? (
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleRecapChange(idx, e.target.value)}
                      aria-label={`نقطة خلاصة ${idx + 1}`}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-xs"
                    />
                  ) : (
                    item
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Optional Teacher Note */}
          {(isEditing || page.teacherNote.trim().length > 0) && (
            <div
              className="rounded-lg border border-dashed p-2.5 text-xs text-slate-700"
              style={{ borderColor: palette.softBorder }}
            >
              <span className="font-bold ml-1">ملاحظة المعلم:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={page.teacherNote}
                  onChange={(e) =>
                    onUpdatePage(page.id, { teacherNote: e.target.value })
                  }
                  placeholder="أضف واجباً أو تنبيهاً إضافياً للطلاب في هذه الصفحة..."
                  aria-label="ملاحظة المعلم على الصفحة"
                  className="w-full mt-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                />
              ) : (
                <span>{page.teacherNote}</span>
              )}
            </div>
          )}
        </div>

        {/* Page Footer with Mirrored Page Number & Teacher Mark */}
        <footer className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div>
            {teacherDisplay ? `${teacherDisplay} · ` : ''}
            {effectiveGuideTitle}
          </div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-medium text-slate-700">
              صفحة {page.pageNumber} من {totalPages}
            </span>
            <TeacherLogoMark profile={profile} palette={palette} size="xs" />
          </div>
        </footer>
      </div>
    </article>
  );
};
