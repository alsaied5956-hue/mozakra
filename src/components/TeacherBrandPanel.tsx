import React from 'react';
import { Upload, X } from 'lucide-react';
import {
  DetailLevel,
  IllustrationStyle,
  SubjectIconId,
  TeacherProfile,
  TeachingStyle,
  ThemeId,
} from '../types/studyGuide';
import {
  DETAIL_LEVELS,
  ILLUSTRATION_STYLES,
  SUBJECT_ICONS,
  SUBJECT_PRESETS,
  TEACHING_STYLES,
  THEME_PALETTES,
  formatSubjectGrade,
  inferSubjectIcon,
} from '../utils/themes';
import { TeacherLogoMark } from './TeacherLogoMark';

interface TeacherBrandPanelProps {
  profile: TeacherProfile;
  onChange: (updated: Partial<TeacherProfile>) => void;
  onNextStep: () => void;
}

export const TeacherBrandPanel: React.FC<TeacherBrandPanelProps> = ({
  profile,
  onChange,
  onNextStep,
}) => {
  const palette = THEME_PALETTES[profile.themeId];
  const matchedPreset = SUBJECT_PRESETS.find((p) => p.id === profile.subject.trim());
  const presetValue = matchedPreset ? matchedPreset.id : profile.subject.trim() ? 'custom' : '';

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({ logoMode: 'upload', uploadedLogoDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubjectPresetChange = (value: string) => {
    if (!value) {
      onChange({
        subject: '',
        subjectGrade: formatSubjectGrade('', profile.gradeLevel),
      });
      return;
    }
    if (value === 'custom') {
      if (matchedPreset) {
        onChange({
          subject: '',
          subjectGrade: formatSubjectGrade('', profile.gradeLevel),
          subjectIcon: 'compass',
        });
      }
      return;
    }
    const preset = SUBJECT_PRESETS.find((p) => p.id === value);
    onChange({
      subject: value,
      subjectGrade: formatSubjectGrade(value, profile.gradeLevel),
      subjectIcon: preset?.icon ?? inferSubjectIcon(value),
    });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <label
            htmlFor="teacher-name-input"
            className="block text-xs font-bold text-slate-700 mb-1.5"
          >
            اسم المعلم / المعلمة
          </label>
          <input
            id="teacher-name-input"
            type="text"
            value={profile.teacherName}
            onChange={(e) => onChange({ teacherName: e.target.value })}
            placeholder="أدخل اسمك هنا (مثال: أ. سارة محمود)"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
          />
          {!profile.teacherName.trim() && (
            <p className="text-[11px] text-slate-500 mt-1">
              يظهر اسمك فور الكتابة على الغلاف وبجوار رقم كل صفحة وفي الشعار التلقائي.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="subject-preset-select"
            className="block text-xs font-bold text-slate-700"
          >
            اختيار المادة الدراسية (أو اكتب مادة مخصصة)
          </label>
          <select
            id="subject-preset-select"
            value={presetValue}
            onChange={(e) => handleSubjectPresetChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            <option value="">اختر المادة من القائمة...</option>
            {SUBJECT_PRESETS.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.label}
              </option>
            ))}
            <option value="custom">مادة مخصصة (اكتب اسم المادة بحرية)</option>
          </select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="subject-input"
                className="block text-[11px] font-bold text-slate-600 mb-1"
              >
                اسم المادة (قابل للتعديل الحر)
              </label>
              <input
                id="subject-input"
                type="text"
                value={profile.subject}
                onChange={(e) => {
                  const subject = e.target.value;
                  onChange({
                    subject,
                    subjectGrade: formatSubjectGrade(subject, profile.gradeLevel),
                    subjectIcon: inferSubjectIcon(subject),
                  });
                }}
                placeholder="مثال: التاريخ، البرمجة، الأحياء..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
              />
            </div>
            <div>
              <label
                htmlFor="grade-level-input"
                className="block text-[11px] font-bold text-slate-600 mb-1"
              >
                الصف / المرحلة الدراسية
              </label>
              <input
                id="grade-level-input"
                type="text"
                value={profile.gradeLevel}
                onChange={(e) => {
                  const gradeLevel = e.target.value;
                  onChange({
                    gradeLevel,
                    subjectGrade: formatSubjectGrade(profile.subject, gradeLevel),
                  });
                }}
                placeholder="مثال: الثاني الثانوي"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="guide-title-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              عنوان المذكرة / الكتاب
            </label>
            <input
              id="guide-title-input"
              type="text"
              value={profile.guideTitle}
              onChange={(e) => onChange({ guideTitle: e.target.value })}
              placeholder="عنوان الغلاف (اختياري)"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
          </div>
          <div>
            <label
              htmlFor="academic-year-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              العام الدراسي
            </label>
            <input
              id="academic-year-input"
              type="text"
              value={profile.academicYear}
              onChange={(e) => onChange({ academicYear: e.target.value })}
              placeholder="٢٠٢٦ / ٢٠٢٧"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">شعار المعلم (Logo)</span>
          <TeacherLogoMark profile={profile} palette={palette} size="sm" />
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => onChange({ logoMode: 'auto' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              profile.logoMode === 'auto'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            توليد شعار تلقائي
          </button>
          <button
            type="button"
            onClick={() => onChange({ logoMode: 'upload' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              profile.logoMode === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            رفع شعار جاهز
          </button>
        </div>

        {profile.logoMode === 'auto' ? (
          <div>
            <label
              htmlFor="subject-icon-select"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              أيقونة التخصص داخل الشعار
            </label>
            <select
              id="subject-icon-select"
              value={profile.subjectIcon}
              onChange={(e) => onChange({ subjectIcon: e.target.value as SubjectIconId })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            >
              {SUBJECT_ICONS.map((icon) => (
                <option key={icon.id} value={icon.id}>
                  {icon.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-slate-500" />
              <span>اختر صورة الشعار (PNG / JPG / SVG)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="sr-only"
              />
            </label>
            {profile.uploadedLogoDataUrl && (
              <button
                type="button"
                onClick={() => onChange({ uploadedLogoDataUrl: null, logoMode: 'auto' })}
                className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline"
              >
                <X className="w-3.5 h-3.5" />
                <span>إزالة الشعار المرفوع والعودة للشعار التلقائي</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-2.5">
        <span className="block text-xs font-bold text-slate-700">لوحة الألوان والهوية</span>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(THEME_PALETTES) as ThemeId[]).map((id) => {
            const theme = THEME_PALETTES[id];
            const active = profile.themeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ themeId: id })}
                className={`flex items-center gap-2 p-2 rounded-lg border text-right transition-colors ${
                  active
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span
                  className="w-5 h-5 rounded-md shrink-0 border border-black/10"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 55%, ${theme.secondary} 55%)`,
                  }}
                />
                <span className="text-xs font-medium text-slate-800 truncate">{theme.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-3">
        <div>
          <label
            htmlFor="detail-level-select"
            className="block text-xs font-bold text-slate-700 mb-1.5"
          >
            نسبة التفصيل وطول المذكرة
          </label>
          <select
            id="detail-level-select"
            value={profile.detailLevel}
            onChange={(e) => onChange({ detailLevel: e.target.value as DetailLevel })}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            {DETAIL_LEVELS.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {DETAIL_LEVELS.find((m) => m.value === profile.detailLevel)?.description}
          </p>
        </div>

        <div>
          <label
            htmlFor="teaching-style-select"
            className="block text-xs font-bold text-slate-700 mb-1.5"
          >
            الأسلوب التربوي للشرح
          </label>
          <select
            id="teaching-style-select"
            value={profile.teachingStyle}
            onChange={(e) => onChange({ teachingStyle: e.target.value as TeachingStyle })}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            {TEACHING_STYLES.map((style) => (
              <option key={style.value} value={style.value}>
                {style.value}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {TEACHING_STYLES.find((s) => s.value === profile.teachingStyle)?.description}
          </p>
        </div>

        <div>
          <label
            htmlFor="illustration-style-select"
            className="block text-xs font-bold text-slate-700 mb-1.5"
          >
            نمط الرسوم التوضيحية
          </label>
          <select
            id="illustration-style-select"
            value={profile.illustrationStyle}
            onChange={(e) =>
              onChange({ illustrationStyle: e.target.value as IllustrationStyle })
            }
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15"
          >
            {ILLUSTRATION_STYLES.map((style) => (
              <option key={style.value} value={style.value}>
                {style.value}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">
            {ILLUSTRATION_STYLES.find((s) => s.value === profile.illustrationStyle)?.description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onNextStep}
        className="w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors"
      >
        التالي: رفع المادة واستخراج الفهرس
      </button>
    </div>
  );
};
