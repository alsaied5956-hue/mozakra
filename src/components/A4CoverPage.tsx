import React, { useState } from 'react';
import { AlertCircle, Clock, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  CoverVisualSpec,
  ImageGenerationStatus,
  TeacherProfile,
  ThemePalette,
} from '../types/studyGuide';
import { formatSubjectGrade } from '../utils/themes';
import { TeacherLogoMark } from './TeacherLogoMark';

interface A4CoverPageProps {
  profile: TeacherProfile;
  palette: ThemePalette;
  guideTitle: string;
  outlineSummary: string;
  lessonTopics: string[];
  coverVisualSpec?: CoverVisualSpec;
  coverImageUrl?: string;
  coverImageStatus?: ImageGenerationStatus;
  coverImageError?: string;
  totalPages: number;
  isEditing: boolean;
  isRegeneratingCover?: boolean;
  isPrintClone?: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateSummary: (summary: string) => void;
  onRegenerateCover?: (customNote?: string) => void;
}

export const A4CoverPage: React.FC<A4CoverPageProps> = ({
  profile,
  palette,
  guideTitle,
  outlineSummary,
  lessonTopics,
  coverVisualSpec,
  coverImageUrl,
  coverImageStatus = 'idle',
  coverImageError,
  totalPages,
  isEditing,
  isRegeneratingCover = false,
  isPrintClone = false,
  onUpdateTitle,
  onUpdateSummary,
  onRegenerateCover,
}) => {
  const [showCoverNote, setShowCoverNote] = useState(false);
  const [coverNote, setCoverNote] = useState('');

  const teacherDisplay = profile.teacherName.trim();
  const subjectDisplay =
    formatSubjectGrade(profile.subject, profile.gradeLevel) ||
    profile.subjectGrade.trim();
  const effectiveTitle = (guideTitle || profile.guideTitle).trim();
  const effectiveStatus: ImageGenerationStatus = isRegeneratingCover
    ? 'generating'
    : coverImageStatus || (coverImageUrl ? 'completed' : 'idle');
  const displayTopics =
    lessonTopics.length > 0
      ? lessonTopics.slice(0, 3)
      : coverVisualSpec?.visualElements?.slice(0, 3) || [];

  return (
    <article
      className="a4-sheet mx-auto rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between relative"
      style={{
        background: `linear-gradient(180deg, ${palette.softSurface} 0%, #ffffff 42%, #ffffff 100%)`,
      }}
      data-testid={isPrintClone ? undefined : 'a4-cover-page'}
    >
      <div
        className="h-3 w-full shrink-0"
        style={{ backgroundColor: palette.primary }}
      />

      <div className="flex-1 flex flex-col justify-between p-10 sm:p-12">
        <header className="flex items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
          <div className="flex items-center gap-3.5">
            <TeacherLogoMark profile={profile} palette={palette} size="lg" />
            <div>
              <div
                className={`font-display text-lg font-bold ${
                  teacherDisplay ? '' : 'text-slate-400'
                }`}
                style={teacherDisplay ? { color: palette.primaryDark } : undefined}
                data-testid={isPrintClone ? undefined : 'cover-teacher-name'}
              >
                {teacherDisplay || 'اسم المعلم (يظهر هنا فور الكتابة)'}
              </div>
              <div
                className={`text-sm mt-0.5 ${
                  subjectDisplay ? 'text-slate-600' : 'text-slate-400'
                }`}
                data-testid={isPrintClone ? undefined : 'cover-subject-grade'}
              >
                {subjectDisplay || 'المادة والصف الدراسي'}
              </div>
            </div>
          </div>
          <div className="text-left text-xs text-slate-500">
            <div>{profile.academicYear}</div>
            {totalPages > 0 && (
              <div className="mt-1 tabular-nums">{totalPages} صفحات دراسية</div>
            )}
          </div>
        </header>

        <div className="my-auto py-8 flex flex-col items-center text-center">
          <div
            className="text-xs font-bold mb-3 tracking-normal"
            style={{ color: palette.accentText }}
          >
            {profile.teachingStyle} · {profile.illustrationStyle}
          </div>

          {isEditing ? (
            <input
              type="text"
              value={guideTitle}
              onChange={(e) => onUpdateTitle(e.target.value)}
              placeholder="أدخل عنوان المذكرة على الغلاف"
              aria-label="تعديل عنوان المذكرة على الغلاف"
              className="w-full max-w-xl text-center font-display text-3xl sm:text-4xl font-extrabold px-4 py-2 border border-slate-300 rounded-lg bg-white/90 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              style={{ color: palette.primaryDark }}
            />
          ) : (
            <h1
              className="font-display text-3xl sm:text-4xl font-extrabold leading-snug max-w-xl"
              style={{ color: palette.primaryDark, textWrap: 'balance' }}
            >
              {effectiveTitle || 'عنوان المذكرة الدراسية'}
            </h1>
          )}

          <div
            className="w-24 h-1 rounded-full my-5"
            style={{ backgroundColor: palette.secondary }}
          />

          {isEditing ? (
            <textarea
              rows={2}
              value={outlineSummary}
              onChange={(e) => onUpdateSummary(e.target.value)}
              aria-label="تعديل وصف المذكرة على الغلاف"
              className="w-full max-w-lg text-center text-sm text-slate-700 leading-relaxed px-3 py-2 border border-slate-300 rounded-lg bg-white/90 focus:outline-none"
            />
          ) : (
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg mb-6">
              {outlineSummary ||
                'مذكرة تعليمية مخصصة تتكيّف تلقائياً مع المادة الدراسية ومحتوى الكتاب المرفوع.'}
            </p>
          )}

          {/* Native AI Subject & Content-Aware Cover Illustration */}
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden border p-3 bg-white"
            style={{ borderColor: palette.softBorder }}
            data-testid={isPrintClone ? undefined : 'dynamic-cover-visual'}
          >
            <div
              className="relative w-full aspect-[16/9] rounded-xl overflow-hidden flex items-center justify-center border"
              style={{
                backgroundColor: palette.softSurface,
                borderColor: palette.softBorder,
              }}
            >
              {coverImageUrl ? (
                <>
                  <img
                    src={coverImageUrl}
                    alt={effectiveTitle || profile.subject || 'صورة غلاف المذكرة'}
                    className="w-full h-full object-cover"
                    data-testid={isPrintClone ? undefined : 'cover-ai-image'}
                  />
                  {effectiveStatus === 'generating' && (
                    <div className="no-print absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-white p-4">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="text-xs font-bold">
                        جاري رسم غلاف جديد بالذكاء الاصطناعي...
                      </span>
                    </div>
                  )}
                </>
              ) : effectiveStatus === 'generating' ? (
                <div className="flex flex-col items-center gap-2.5 text-slate-700 px-6 text-center">
                  <Loader2
                    className="w-7 h-7 animate-spin"
                    style={{ color: palette.primary }}
                  />
                  <span className="text-xs font-bold">
                    جاري رسم غلاف المذكرة بالذكاء الاصطناعي...
                  </span>
                  <span className="text-[11px] text-slate-500">
                    تصميم لوحة فنية مخصصة لمادة {profile.subject.trim() || 'الدرس'}
                  </span>
                </div>
              ) : effectiveStatus === 'queued' ? (
                <div className="flex flex-col items-center gap-2 text-slate-600 px-6 text-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                  <span className="text-xs font-bold">
                    في انتظار الدور لتوليد صورة الغلاف...
                  </span>
                  <span className="text-[11px] text-slate-500">
                    سيتم التوليد تلقائياً لحماية حد الطلبات
                  </span>
                </div>
              ) : effectiveStatus === 'error' ? (
                <div className="flex flex-col items-center gap-2 text-rose-800 px-6 text-center">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                  <span className="text-xs font-bold">
                    {coverImageError || 'تعذر توليد صورة الغلاف بالذكاء الاصطناعي.'}
                  </span>
                  {!isPrintClone && onRegenerateCover && (
                    <button
                      type="button"
                      onClick={() => onRegenerateCover(coverNote.trim() || undefined)}
                      className="no-print mt-1 px-3 py-1.5 text-[11px] font-bold bg-rose-700 text-white rounded-md hover:bg-rose-800 inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>إعادة المحاولة</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2.5 p-6 text-center">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: palette.primary }}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div
                      className="font-display text-sm font-bold"
                      style={{ color: palette.primaryDark }}
                    >
                      {coverVisualSpec?.headlineMotif ||
                        effectiveTitle ||
                        (profile.subject.trim()
                          ? `لوحة غلاف ${profile.subject.trim()}`
                          : 'صورة غلاف مخصصة بالذكاء الاصطناعي')}
                    </div>
                    {displayTopics.length > 0 && (
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                        محاور الكتاب: {displayTopics.join(' · ')}
                      </p>
                    )}
                  </div>
                  {!isPrintClone && onRegenerateCover && (
                    <button
                      type="button"
                      onClick={() => onRegenerateCover(coverNote.trim() || undefined)}
                      className="no-print px-3.5 py-1.5 text-xs font-bold text-white rounded-lg inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity"
                      style={{ backgroundColor: palette.primary }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>توليد صورة الغلاف بالذكاء الاصطناعي</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isPrintClone && onRegenerateCover && (
              <div className="no-print mt-2.5 flex flex-wrap items-center justify-between gap-2 text-right">
                <span
                  className="text-[11px] font-medium"
                  style={{
                    color:
                      effectiveStatus === 'error'
                        ? '#be123c'
                        : effectiveStatus === 'completed' || coverImageUrl
                        ? palette.primaryDark
                        : '#64748b',
                  }}
                >
                  {effectiveStatus === 'generating'
                    ? 'جاري رسم المشهد بالذكاء الاصطناعي...'
                    : effectiveStatus === 'queued'
                    ? 'في انتظار الدور...'
                    : effectiveStatus === 'error'
                    ? 'تعذر التوليد — يمكنك إعادة المحاولة'
                    : coverImageUrl
                    ? `تم التوليد بالذكاء الاصطناعي · غلاف ${profile.subject.trim() || 'المذكرة'}`
                    : `غلاف بالذكاء الاصطناعي لمادة ${profile.subject.trim() || 'الدرس'}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCoverNote((prev) => !prev)}
                    className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md"
                  >
                    تخصيص الغلاف
                  </button>
                  <button
                    type="button"
                    disabled={effectiveStatus === 'generating'}
                    onClick={() => {
                      onRegenerateCover(coverNote.trim() || undefined);
                      setShowCoverNote(false);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-white rounded-md inline-flex items-center gap-1 disabled:opacity-50"
                    style={{ backgroundColor: palette.primary }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{coverImageUrl ? 'إعادة توليد الغلاف' : 'توليد صورة الغلاف'}</span>
                  </button>
                </div>
              </div>
            )}

            {!isPrintClone && showCoverNote && onRegenerateCover && (
              <div className="no-print mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={coverNote}
                  onChange={(e) => setCoverNote(e.target.value)}
                  placeholder="أضف فكرة لتصميم الغلاف (مثال: خريطة تاريخية وأحصنة أو بيئة برمجية حديثة)..."
                  aria-label="فكرة مخصصة لتصميم الغلاف"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    onRegenerateCover(coverNote.trim() || undefined);
                    setShowCoverNote(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-md"
                >
                  تطبيق
                </button>
              </div>
            )}
          </div>
        </div>

        <footer
          className="pt-5 border-t flex items-center justify-between text-xs text-slate-600"
          style={{ borderColor: palette.softBorder }}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold" style={{ color: palette.primaryDark }}>
              إعداد وتقديم: {teacherDisplay || 'لم يُدخل اسم المعلم بعد'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span>صفحة الغلاف</span>
            <TeacherLogoMark profile={profile} palette={palette} size="xs" />
          </div>
        </footer>
      </div>
    </article>
  );
};
