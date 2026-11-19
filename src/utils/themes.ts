import {
  DetailLevel,
  IllustrationStyle,
  SceneCategory,
  SubjectIconId,
  TeacherProfile,
  TeachingStyle,
  ThemeId,
  ThemePalette,
} from '../types/studyGuide';

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  'navy-gold': {
    id: 'navy-gold',
    name: 'الأزرق الملكي والذهبي',
    primary: '#1E3A5F',
    primaryDark: '#102542',
    secondary: '#D97706',
    softSurface: '#F4F7FB',
    softBorder: '#D6E0EC',
    accentText: '#B45309',
  },
  'emerald-slate': {
    id: 'emerald-slate',
    name: 'الزمردي والأردواز',
    primary: '#0F6B56',
    primaryDark: '#094739',
    secondary: '#0284C7',
    softSurface: '#F2FAF7',
    softBorder: '#CCE7DE',
    accentText: '#047857',
  },
  'cobalt-amber': {
    id: 'cobalt-amber',
    name: 'الكوبالت والكهرمان',
    primary: '#1D4ED8',
    primaryDark: '#1E3A8A',
    secondary: '#EA580C',
    softSurface: '#F3F6FD',
    softBorder: '#D5E0FA',
    accentText: '#C2410C',
  },
  'plum-coral': {
    id: 'plum-coral',
    name: 'البرقوقي والمرجاني',
    primary: '#6D2856',
    primaryDark: '#4A183A',
    secondary: '#E11D48',
    softSurface: '#FCF4F9',
    softBorder: '#EED6E6',
    accentText: '#BE123C',
  },
};

export const DETAIL_LEVELS: {
  value: DetailLevel;
  label: string;
  description: string;
}[] = [
  {
    value: 'balanced',
    label: 'متوازن ومنطقي حسب حجم الملف',
    description: 'يحافظ على عدد صفحات متناسب مع حجم المصدر دون تضخم مبالغ فيه أو اختصار مخل',
  },
  {
    value: 'detailed',
    label: 'شرح مفصل موسّع',
    description: 'يتوسع في الأمثلة والتدريبات مع زيادة معتدلة في عدد الصفحات للدروس الكثيفة',
  },
  {
    value: 'concise',
    label: 'مركّز وواضح للطلاب',
    description: 'يلخّص التكرار ويقدّم الجوهر العلمي والأفكار المهمة في صفحات مركزة ومرتبة',
  },
];

export const SUBJECT_PRESETS: {
  id: string;
  label: string;
  icon: SubjectIconId;
}[] = [
  { id: 'التاريخ', label: 'التاريخ', icon: 'scroll' },
  { id: 'البرمجة', label: 'البرمجة', icon: 'code' },
  { id: 'الرياضيات', label: 'الرياضيات', icon: 'calculator' },
  { id: 'العلوم', label: 'العلوم', icon: 'atom' },
  { id: 'الفيزياء', label: 'الفيزياء', icon: 'atom' },
  { id: 'الكيمياء', label: 'الكيمياء', icon: 'atom' },
  { id: 'الأحياء', label: 'الأحياء', icon: 'atom' },
  { id: 'اللغة العربية', label: 'اللغة العربية', icon: 'book' },
  { id: 'اللغة الإنجليزية', label: 'اللغة الإنجليزية', icon: 'book' },
  { id: 'الدراسات الاجتماعية', label: 'الدراسات الاجتماعية والجغرافيا', icon: 'globe' },
  { id: 'الحاسب الآلي', label: 'الحاسب الآلي وتقنية المعلومات', icon: 'code' },
];

export const TEACHING_STYLES: { value: TeachingStyle; description: string }[] = [
  {
    value: 'أسلوب قصصي وتخيلي مبتكر',
    description: 'يحوّل المفاهيم المجردة والأحداث إلى حكاية ومشهد حي في ذهن الطالب',
  },
  {
    value: 'تبسيط بصري وربط بالواقع',
    description: 'يربط كل قاعدة أو ظاهرة أو شيفرة برمجية بأمثلة ملموسة من الواقع',
  },
  {
    value: 'خرائط ذهنية وتدرج ذكي',
    description: 'يبني الفكرة خطوة بخطوة من الأساس إلى الاستنتاج أو الخوارزمية',
  },
  {
    value: 'تحدي وأسئلة تفاعلية',
    description: 'يثير فضول الطالب بأسئلة استكشافية واختبارات سريعة مدمجة',
  },
];

export const ILLUSTRATION_STYLES: { value: IllustrationStyle; description: string }[] = [
  {
    value: 'رسوم كاريكاتيرية مرحة',
    description: 'مشاهد كرتونية بشخصيات معبرة وحوار بصري يقرب الفكرة بوضوح',
  },
  {
    value: 'رسوم توضيحية تخيلية مفصلة',
    description: 'مخططات مفاهيمية ومشاهد تعليمية منظمة بمراحل وتسميات واضحة',
  },
];

export const SUBJECT_ICONS: { id: SubjectIconId; label: string }[] = [
  { id: 'scroll', label: 'التاريخ والتراث' },
  { id: 'code', label: 'البرمجة والحاسب' },
  { id: 'atom', label: 'علوم / فيزياء / كيمياء / أحياء' },
  { id: 'calculator', label: 'رياضيات' },
  { id: 'book', label: 'لغة عربية / لغات / أدب' },
  { id: 'globe', label: 'جغرافيا / دراسات اجتماعية' },
  { id: 'compass', label: 'مواد عامة / مهارات' },
];

export function formatSubjectGrade(subject: string, gradeLevel: string): string {
  return [subject.trim(), gradeLevel.trim()].filter(Boolean).join(' — ');
}

export function inferSubjectIcon(subject: string): SubjectIconId {
  const s = subject.trim().toLowerCase();
  if (!s) return 'compass';
  if (/(تاريخ|حضار|حرب|غزو|دول|خلافة|عصر|history)/.test(s)) return 'scroll';
  if (/(برمج|حاسب|كود|خوارزم|بايثون|جافا|تطوير|تطبيق|تقني|programming|code|cs|computer)/.test(s)) {
    return 'code';
  }
  if (/(رياض|جبر|هندس|تفاضل|تكامل|حساب|إحصاء|math)/.test(s)) return 'calculator';
  if (/(عرب|نحو|أدب|بلاغ|إنجليز|لغ|قراءة|english|arabic)/.test(s)) return 'book';
  if (/(جغراف|دراسات|بيئة|مناخ|خريطة|geography|social)/.test(s)) return 'globe';
  if (/(علوم|فيزياء|كيمياء|أحياء|علم|science|physics|chemistry|biology)/.test(s)) return 'atom';
  return 'compass';
}

export function inferSceneCategoryFromSubjectAndText(
  subject: string,
  text: string
): SceneCategory {
  const combined = `${subject} ${text}`.toLowerCase();

  if (/(حرب|معرك|غزو|فتح|جيش|أسطول|معاهد|صلح|ثورة|انتصار|هزيم|قائد)/.test(combined)) {
    return 'history-battle';
  }
  if (/(تاريخ|خلافة|دولة|فرعون|حضار|عصر|قرن|مملكة|سلطان|ملك|تراث)/.test(combined)) {
    return 'history-timeline';
  }
  if (/(خوارزم|مخطط تدفق|شرط|حلقة|تكرار|دالة|متغير|مصفوف|flowchart|loop|if)/.test(combined)) {
    return 'programming-flow';
  }
  if (/(برمج|بايثون|جافا|كود|شيفرة|حاسب|html|css|python|javascript|c\+\+|programming|code)/.test(combined)) {
    return 'programming-code';
  }
  if (/(منشور|طيف|انكسار|مرآ|مرايا|انعكاس|ضوء|عدس|ظل)/.test(combined)) {
    return 'science-optics';
  }
  if (/(خلي|نواة|نبات|تمثيل ضوئ|تنفس|دم|قلب|أحياء|جهاز|ميتوكوندريا|dna|وراث)/.test(combined)) {
    return 'science-biology';
  }
  if (/(كيمياء|تفاعل|ذرة|عنصر|مركب|حمض|قاعدة|معادلة كيمي|أكسدة)/.test(combined)) {
    return 'science-chemistry';
  }
  if (/(فيزياء|قوة|حركة|سرعة|كهرباء|تيار|مغناطيس|طاقة|جهد|مقاوم)/.test(combined)) {
    return 'science-physics';
  }
  if (/(كسر|كسور|نسبة|مئوية|معادلة|مثلث|زاوية|جبر|هندس|رياضيات|تفاضل)/.test(combined)) {
    return 'math-visual';
  }
  if (/(نحو|مبتدأ|خبر|كان|إعراب|فعل|بلاغة|لغة عربية|قصيدة|أدب)/.test(combined)) {
    return 'arabic-grammar';
  }
  if (/(جغرافيا|خريطة|قارة|مناخ|تضاريس|نهر|محيط|دورة المياه)/.test(combined)) {
    return 'geography-map';
  }
  return 'conceptual-story';
}

export const DEFAULT_TEACHER_PROFILE: TeacherProfile = {
  teacherName: '',
  subject: '',
  gradeLevel: '',
  subjectGrade: '',
  guideTitle: '',
  academicYear: 'العام الدراسي ٢٠٢٦ / ٢٠٢٧',
  logoMode: 'auto',
  uploadedLogoDataUrl: null,
  subjectIcon: 'compass',
  themeId: 'navy-gold',
  teachingStyle: 'أسلوب قصصي وتخيلي مبتكر',
  illustrationStyle: 'رسوم كاريكاتيرية مرحة',
  detailLevel: 'balanced',
};

const HONORIFIC_PREFIXES = new Set([
  'أ',
  'أ.',
  'أستاذ',
  'أستاذة',
  'مستر',
  'ميس',
  'د',
  'د.',
  'دكتور',
  'دكتورة',
  'م',
  'م.',
  'مهندس',
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getTeacherInitials(name: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const meaningful = cleaned.filter(
    (part) => !HONORIFIC_PREFIXES.has(part.replace(/\.$/, '')) && !HONORIFIC_PREFIXES.has(part)
  );
  const tokens = meaningful.length > 0 ? meaningful : cleaned;

  if (tokens.length === 0) return 'م';
  if (tokens.length === 1) return tokens[0].slice(0, 2);
  const firstChar = tokens[0][0] ?? '';
  const secondToken =
    tokens[1].startsWith('ال') && tokens[1].length > 3 ? tokens[1].slice(2) : tokens[1];
  const secondChar = secondToken[0] ?? tokens[1][0] ?? '';
  return `${firstChar}${secondChar}`;
}

function getSubjectGlyphSvg(icon: SubjectIconId, stroke: string): string {
  switch (icon) {
    case 'scroll':
      return `
        <path d="M21 19h19a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V23a4 4 0 0 1 1-4z" fill="none" stroke="${stroke}" stroke-width="2" />
        <line x1="25" y1="25" x2="39" y2="25" stroke="${stroke}" stroke-width="2" stroke-linecap="round" />
        <line x1="25" y1="30.5" x2="39" y2="30.5" stroke="${stroke}" stroke-width="2" stroke-linecap="round" />
        <line x1="25" y1="36" x2="34" y2="36" stroke="${stroke}" stroke-width="2" stroke-linecap="round" />
      `;
    case 'code':
      return `
        <polyline points="26,23 19,30 26,37" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="38,23 45,30 38,37" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="34" y1="21" x2="30" y2="39" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" />
      `;
    case 'atom':
      return `
        <ellipse cx="32" cy="30" rx="14" ry="5.5" transform="rotate(35 32 30)" fill="none" stroke="${stroke}" stroke-width="2" />
        <ellipse cx="32" cy="30" rx="14" ry="5.5" transform="rotate(-35 32 30)" fill="none" stroke="${stroke}" stroke-width="2" />
        <circle cx="32" cy="30" r="3.2" fill="${stroke}" />
      `;
    case 'calculator':
      return `
        <rect x="21" y="17" width="22" height="26" rx="4" fill="none" stroke="${stroke}" stroke-width="2.2" />
        <rect x="24.5" y="20.5" width="15" height="6" rx="1.5" fill="${stroke}" opacity="0.25" />
        <circle cx="26.5" cy="31.5" r="1.6" fill="${stroke}" />
        <circle cx="32" cy="31.5" r="1.6" fill="${stroke}" />
        <circle cx="37.5" cy="31.5" r="1.6" fill="${stroke}" />
        <circle cx="26.5" cy="37" r="1.6" fill="${stroke}" />
        <circle cx="32" cy="37" r="1.6" fill="${stroke}" />
        <circle cx="37.5" cy="37" r="1.6" fill="${stroke}" />
      `;
    case 'book':
      return `
        <path d="M18 20c5 0 11 1.5 14 4.5 3-3 9-4.5 14-4.5v21c-5 0-11 1.5-14 4.5-3-3-9-4.5-14-4.5V20z" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round" />
        <line x1="32" y1="24.5" x2="32" y2="45.5" stroke="${stroke}" stroke-width="2" />
      `;
    case 'globe':
      return `
        <circle cx="32" cy="30" r="13" fill="none" stroke="${stroke}" stroke-width="2.2" />
        <ellipse cx="32" cy="30" rx="6" ry="13" fill="none" stroke="${stroke}" stroke-width="1.8" />
        <line x1="19" y1="30" x2="45" y2="30" stroke="${stroke}" stroke-width="1.8" />
        <line x1="21.5" y1="23.5" x2="42.5" y2="23.5" stroke="${stroke}" stroke-width="1.5" />
        <line x1="21.5" y1="36.5" x2="42.5" y2="36.5" stroke="${stroke}" stroke-width="1.5" />
      `;
    case 'compass':
    default:
      return `
        <circle cx="32" cy="30" r="13" fill="none" stroke="${stroke}" stroke-width="2.2" />
        <polygon points="32,20 35.5,30 32,40 28.5,30" fill="${stroke}" opacity="0.25" stroke="${stroke}" stroke-width="1.8" />
        <circle cx="32" cy="30" r="2" fill="${stroke}" />
      `;
  }
}

export function buildTeacherEmblemSvg(
  teacherName: string,
  subjectIcon: SubjectIconId,
  palette: ThemePalette
): string {
  const initials = escapeXml(getTeacherInitials(teacherName));
  const glyph = getSubjectGlyphSvg(subjectIcon, '#ffffff');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="شعار المعلم">
    <defs>
      <linearGradient id="emb-${palette.id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.primary}" />
        <stop offset="100%" stop-color="${palette.primaryDark}" />
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="58" height="58" rx="16" fill="url(#emb-${palette.id})" />
    <rect x="6.5" y="6.5" width="51" height="51" rx="13" fill="none" stroke="${palette.secondary}" stroke-width="1.6" stroke-opacity="0.85" />
    <g transform="translate(0,-3)" opacity="0.92">${glyph}</g>
    <rect x="14" y="43" width="36" height="14" rx="7" fill="${palette.secondary}" />
    <text x="32" y="53" text-anchor="middle" fill="#ffffff" font-family="Cairo, Tajawal, sans-serif" font-size="9.5" font-weight="700">${initials}</text>
  </svg>`;
}
