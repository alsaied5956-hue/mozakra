import React, { useMemo } from 'react';
import { TeacherProfile, ThemePalette } from '../types/studyGuide';
import { buildTeacherEmblemSvg } from '../utils/themes';

interface TeacherLogoMarkProps {
  profile: TeacherProfile;
  palette: ThemePalette;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-6 h-6',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export const TeacherLogoMark: React.FC<TeacherLogoMarkProps> = ({
  profile,
  palette,
  size = 'md',
}) => {
  const emblemSvg = useMemo(
    () => buildTeacherEmblemSvg(profile.teacherName, profile.subjectIcon, palette),
    [profile.teacherName, profile.subjectIcon, palette]
  );

  const altText = profile.teacherName.trim()
    ? `شعار ${profile.teacherName.trim()}`
    : 'شعار المعلم';

  if (profile.logoMode === 'upload' && profile.uploadedLogoDataUrl) {
    return (
      <div
        className={`${SIZE_CLASSES[size]} rounded-lg overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0`}
      >
        <img
          src={profile.uploadedLogoDataUrl}
          alt={altText}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${SIZE_CLASSES[size]} shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full`}
      dangerouslySetInnerHTML={{ __html: emblemSvg }}
    />
  );
};
