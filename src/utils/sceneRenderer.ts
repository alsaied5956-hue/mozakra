import {
  CoverVisualSpec,
  IllustrationSpec,
  IllustrationStyle,
  SceneCategory,
  SubjectIconId,
  ThemePalette,
} from '../types/studyGuide';
import { inferSceneCategoryFromSubjectAndText } from './themes';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(text: string, maxLen: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function renderCartoonCharacter(
  x: number,
  y: number,
  shirtColor: string,
  accentColor: string,
  label: string,
  isCartoon: boolean,
  variant: 'scholar' | 'commander' | 'coder' | 'explorer' = 'scholar'
): string {
  const cleanLabel = escapeXml(truncateText(label, 18));
  const face = isCartoon
    ? `<circle cx="-5" cy="-2" r="2.2" fill="#0F172A" />
       <circle cx="5" cy="-2" r="2.2" fill="#0F172A" />
       <path d="M-4.5 5 Q0 9 4.5 5" fill="none" stroke="#0F172A" stroke-width="1.8" stroke-linecap="round" />`
    : `<circle cx="-4" cy="-2" r="1.7" fill="#0F172A" />
       <circle cx="4" cy="-2" r="1.7" fill="#0F172A" />`;

  const headgear =
    variant === 'commander'
      ? `<path d="M-15 -10 Q0 -26 15 -10 Z" fill="${accentColor}" />
         <rect x="-17" y="-12" width="34" height="5" rx="2.5" fill="${shirtColor}" />`
      : variant === 'coder'
      ? `<rect x="-15" y="-16" width="30" height="8" rx="4" fill="${shirtColor}" />
         <circle cx="15" cy="-4" r="3.5" fill="${accentColor}" />`
      : variant === 'explorer'
      ? `<ellipse cx="0" cy="-12" rx="19" ry="4.5" fill="${accentColor}" />
         <path d="M-11 -12 Q0 -24 11 -12 Z" fill="${shirtColor}" />`
      : `<path d="M-14 -10 Q0 -22 14 -10 Z" fill="${shirtColor}" />`;

  return `
    <g transform="translate(${x}, ${y})">
      <path d="M-18 32 C-18 14, 18 14, 18 32 Z" fill="${shirtColor}" />
      <rect x="-14" y="28" width="28" height="6" rx="3" fill="${accentColor}" opacity="0.85" />
      <circle cx="0" cy="-2" r="14" fill="#FDE68A" stroke="${shirtColor}" stroke-width="2" />
      ${headgear}
      ${face}
      <rect x="-46" y="38" width="92" height="20" rx="6" fill="#ffffff" stroke="${shirtColor}" stroke-width="1.2" />
      <text x="0" y="51" text-anchor="middle" fill="#0F172A" font-family="Cairo, Tajawal, sans-serif" font-size="9.5" font-weight="700">${cleanLabel}</text>
    </g>
  `;
}

function renderStagesStrip(stages: string[], palette: ThemePalette, y = 178): string {
  const safeStages =
    stages.length >= 3
      ? stages.slice(0, 3)
      : [
          stages[0] || '١. البداية والمفهوم',
          stages[1] || '٢. التحليل والتطبيق',
          stages[2] || '٣. النتيجة والخلاصة',
        ];
  const cardWidth = 132;
  const xs = [298, 174, 50]; // RTL right-to-left sequence: stage 1 right, 2 center, 3 left

  return `
    <g>
      <line x1="90" y1="${y + 20}" x2="390" y2="${y + 20}" stroke="${palette.secondary}" stroke-width="2.5" stroke-dasharray="5 4" />
      ${safeStages
        .map((stage, idx) => {
          const x = xs[idx];
          const text = escapeXml(truncateText(stage, 22));
          return `
            <g transform="translate(${x}, ${y})">
              <rect x="0" y="0" width="${cardWidth}" height="40" rx="8" fill="#ffffff" stroke="${idx === 0 ? palette.primary : idx === 1 ? palette.secondary : palette.primaryDark}" stroke-width="1.6" />
              <rect x="${cardWidth - 24}" y="9" width="18" height="22" rx="5" fill="${idx === 1 ? palette.secondary : palette.primary}" />
              <text x="${cardWidth - 15}" y="24" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-size="10.5" font-weight="800">${idx + 1}</text>
              <text x="${(cardWidth - 28) / 2}" y="24" text-anchor="middle" fill="#0F172A" font-family="Cairo, Tajawal, sans-serif" font-size="9.5" font-weight="700">${text}</text>
            </g>
          `;
        })
        .join('')}
    </g>
  `;
}

export function renderSceneIllustrationSvg(params: {
  spec?: IllustrationSpec;
  title: string;
  caption?: string;
  subject?: string;
  subjectIcon: SubjectIconId;
  illustrationStyle: IllustrationStyle;
  palette: ThemePalette;
  variantSeed?: number;
}): string {
  const {
    spec,
    title,
    caption = '',
    subject = '',
    subjectIcon,
    illustrationStyle,
    palette,
    variantSeed = 0,
  } = params;

  const isCartoon = illustrationStyle === 'رسوم كاريكاتيرية مرحة';
  const category: SceneCategory =
    spec?.sceneCategory || inferSceneCategoryFromSubjectAndText(subject, `${title} ${caption}`);

  const actors = spec?.charactersOrActors?.length
    ? spec.charactersOrActors
    : [title, subject || 'المفهوم الرئيسي'];
  const stages = spec?.visualStages?.length ? spec.visualStages : [];
  const badgeNote = spec?.keyEquationOrCode?.trim() || '';
  const sceneTitle = escapeXml(truncateText(spec?.sceneTitle || title || 'مشهد توضيحي', 38));

  let sceneBody = '';

  if (category === 'history-battle') {
    const actor1 = actors[0] || 'القوة الأولى';
    const actor2 = actors[1] || 'القوة المقابلة';
    const landmark = escapeXml(truncateText(badgeNote || 'ميدان الحدث التاريخي', 28));
    sceneBody = `
      <!-- Sky, Sun/Horizon, Fortress & Terrain -->
      <rect x="20" y="20" width="440" height="148" rx="10" fill="#FEF3C7" opacity="0.45" />
      <path d="M20 132 Q140 108 250 128 T460 122 L460 168 L20 168 Z" fill="#E2E8F0" opacity="0.6" />
      <!-- Fortress Wall in center backdrop -->
      <g transform="translate(198, 48)">
        <rect x="0" y="18" width="84" height="62" rx="4" fill="#CBD5E1" stroke="${palette.primaryDark}" stroke-width="2" />
        <rect x="4" y="6" width="16" height="14" fill="#94A3B8" stroke="${palette.primaryDark}" stroke-width="1.5" />
        <rect x="34" y="6" width="16" height="14" fill="#94A3B8" stroke="${palette.primaryDark}" stroke-width="1.5" />
        <rect x="64" y="6" width="16" height="14" fill="#94A3B8" stroke="${palette.primaryDark}" stroke-width="1.5" />
        <path d="M30 80 L30 50 Q42 38 54 50 L54 80 Z" fill="${palette.primaryDark}" />
        <!-- Flag -->
        <line x1="42" y1="6" x2="42" y2="-16" stroke="${palette.primaryDark}" stroke-width="2.5" />
        <polygon points="42,-16 68,-9 42,-2" fill="${palette.secondary}" />
      </g>
      <!-- Opposing Tactical Banners & Characters -->
      ${renderCartoonCharacter(388, 92, palette.primary, palette.secondary, actor1, isCartoon, 'commander')}
      ${renderCartoonCharacter(92, 92, '#7C2D12', '#D97706', actor2, isCartoon, 'commander')}
      <!-- Tactical Arrow & Landmark Pill -->
      <path d="M322 104 Q240 82 158 104" fill="none" stroke="${palette.secondary}" stroke-width="3" stroke-dasharray="6 4" />
      <polygon points="154,104 166,98 164,110" fill="${palette.secondary}" />
      <rect x="165" y="138" width="150" height="24" rx="6" fill="#ffffff" stroke="${palette.softBorder}" stroke-width="1.4" />
      <text x="240" y="154" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">${landmark}</text>
    `;
  } else if (category === 'history-timeline' || category === 'history-civilization') {
    const figure = actors[0] || 'شخصية تاريخية';
    const era = escapeXml(truncateText(badgeNote || 'التسلسل الزمني للأحداث', 30));
    sceneBody = `
      <rect x="20" y="20" width="440" height="148" rx="10" fill="#FFFBEB" opacity="0.7" />
      <!-- Historic Arch & Manuscript Scroll -->
      <g transform="translate(46, 36)">
        <rect x="0" y="10" width="210" height="114" rx="10" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.4" />
        <rect x="-8" y="6" width="16" height="122" rx="8" fill="${palette.secondary}" />
        <rect x="202" y="6" width="16" height="122" rx="8" fill="${palette.secondary}" />
        <text x="105" y="34" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="11.5" font-weight="800">${era}</text>
        <line x1="22" y1="48" x2="188" y2="48" stroke="${palette.softBorder}" stroke-width="2" />
        <rect x="24" y="60" width="162" height="22" rx="6" fill="${palette.softSurface}" />
        <text x="105" y="75" text-anchor="middle" fill="${palette.primary}" font-family="Tajawal, sans-serif" font-size="10" font-weight="700">${escapeXml(truncateText(actors[1] || 'أسباب الحدث وسياقه', 26))}</text>
        <rect x="24" y="90" width="162" height="22" rx="6" fill="${palette.softSurface}" />
        <text x="105" y="105" text-anchor="middle" fill="${palette.accentText}" font-family="Tajawal, sans-serif" font-size="10" font-weight="700">${escapeXml(truncateText(actors[2] || 'النتائج والتحولات الكبرى', 26))}</text>
      </g>
      ${renderCartoonCharacter(365, 92, palette.primary, palette.secondary, figure, isCartoon, 'explorer')}
    `;
  } else if (category === 'programming-code' || category === 'programming-flow') {
    const actor = actors[0] || 'المبرمج / النظام';
    const rawCode = badgeNote || 'if (score >= 50):\n    print("ناجح")';
    const codeLines = rawCode.split(/\r?\n/).slice(0, 3);
    sceneBody = `
      <!-- Clean Dark IDE Code Window + Flow Connections + Cartoon Coder -->
      <g transform="translate(34, 34)">
        <rect x="0" y="0" width="276" height="126" rx="12" fill="#0F172A" stroke="${palette.primary}" stroke-width="2.4" />
        <rect x="0" y="0" width="276" height="26" rx="12" fill="#1E293B" />
        <circle cx="18" cy="13" r="4" fill="#EF4444" />
        <circle cx="32" cy="13" r="4" fill="#F59E0B" />
        <circle cx="46" cy="13" r="4" fill="#10B981" />
        <text x="145" y="17" text-anchor="middle" fill="#CBD5E1" font-family="Cairo, sans-serif" font-size="9.5" font-weight="700">شيفرة وتنفيذ المنطق البرمجي</text>
        ${codeLines
          .map(
            (line, i) => `
          <text x="18" y="${52 + i * 22}" fill="${i === 0 ? '#38BDF8' : i === 1 ? '#A7F3D0' : '#FDE68A'}" font-family="monospace" font-size="11.5" font-weight="600">${escapeXml(truncateText(line, 34))}</text>
        `
          )
          .join('')}
      </g>
      <path d="M314 96 L342 96" stroke="${palette.secondary}" stroke-width="3" />
      <polygon points="346,96 336,90 336,102" fill="${palette.secondary}" />
      ${renderCartoonCharacter(398, 92, palette.primary, palette.secondary, actor, isCartoon, 'coder')}
    `;
  } else if (category === 'science-optics') {
    sceneBody = `
      <g transform="translate(${(variantSeed % 2) * 8}, 0)">
        <line x1="48" y1="108" x2="188" y2="94" stroke="${palette.primaryDark}" stroke-width="6" stroke-linecap="round" />
        ${renderCartoonCharacter(68, 92, palette.secondary, palette.primary, actors[0] || 'الشعاع الضوئي', isCartoon, 'scholar')}
        <polygon points="238,34 176,154 300,154" fill="#E0F2FE" stroke="${palette.primary}" stroke-width="3.5" stroke-linejoin="round" />
        <line x1="268" y1="88" x2="430" y2="54" stroke="#DC2626" stroke-width="4" stroke-linecap="round" />
        <line x1="274" y1="98" x2="430" y2="76" stroke="#EA580C" stroke-width="4" stroke-linecap="round" />
        <line x1="280" y1="108" x2="430" y2="98" stroke="#EAB308" stroke-width="4" stroke-linecap="round" />
        <line x1="286" y1="118" x2="430" y2="120" stroke="#16A34A" stroke-width="4" stroke-linecap="round" />
        <line x1="292" y1="128" x2="430" y2="142" stroke="#0284C7" stroke-width="4" stroke-linecap="round" />
        <text x="372" y="44" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(actors[1] || 'تحليل وانكسار الضوء', 22))}</text>
      </g>
    `;
  } else if (category === 'science-biology') {
    sceneBody = `
      <g>
        <ellipse cx="180" cy="96" rx="122" ry="62" fill="#ECFDF5" stroke="${palette.primary}" stroke-width="4" />
        <ellipse cx="180" cy="96" rx="110" ry="51" fill="none" stroke="${palette.secondary}" stroke-width="2" stroke-dasharray="6 4" />
        <circle cx="176" cy="94" r="24" fill="${palette.primary}" />
        <ellipse cx="106" cy="84" rx="16" ry="9" fill="${palette.secondary}" opacity="0.85" />
        <ellipse cx="250" cy="82" rx="18" ry="10" fill="#16A34A" opacity="0.8" />
        <ellipse cx="242" cy="120" rx="14" ry="8" fill="${palette.primaryDark}" opacity="0.7" />
        <text x="176" y="98" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-size="10" font-weight="700">النواة</text>
        ${renderCartoonCharacter(388, 92, palette.primary, '#16A34A', actors[0] || 'الباحث الحيوي', isCartoon, 'explorer')}
      </g>
    `;
  } else if (category === 'science-chemistry' || category === 'science-physics') {
    sceneBody = `
      <g>
        <!-- Laboratory Bench & Flasks / Apparatus -->
        <rect x="44" y="138" width="248" height="14" rx="5" fill="${palette.primaryDark}" />
        <path d="M98 48 L120 48 L120 82 L146 138 L72 138 L98 82 Z" fill="#DBEAFE" stroke="${palette.primary}" stroke-width="3" stroke-linejoin="round" />
        <path d="M84 114 L134 114 L144 136 L74 136 Z" fill="${palette.secondary}" opacity="0.85" />
        <rect x="184" y="54" width="66" height="84" rx="10" fill="#ffffff" stroke="${palette.primary}" stroke-width="3" />
        <rect x="190" y="98" width="54" height="34" rx="6" fill="${palette.primary}" opacity="0.22" />
        <text x="217" y="84" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(badgeNote || 'تفاعل وطاقة', 16))}</text>
        ${renderCartoonCharacter(378, 92, palette.primary, palette.secondary, actors[0] || 'التجربة العلمية', isCartoon, 'scholar')}
      </g>
    `;
  } else if (category === 'math-visual') {
    sceneBody = `
      <g>
        <!-- Fraction Circle + Equation Board -->
        <g transform="translate(105, 96)">
          <circle cx="0" cy="0" r="52" fill="#ffffff" stroke="${palette.primary}" stroke-width="3.2" />
          <path d="M0 0 L0 -52 A52 52 0 0 1 52 0 Z" fill="${palette.secondary}" opacity="0.9" />
          <line x1="-52" y1="0" x2="52" y2="0" stroke="${palette.primary}" stroke-width="2" />
          <line x1="0" y1="-52" x2="0" y2="52" stroke="${palette.primary}" stroke-width="2" />
        </g>
        <rect x="180" y="42" width="136" height="104" rx="12" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.5" />
        <rect x="194" y="56" width="108" height="32" rx="6" fill="${palette.softSurface}" />
        <text x="248" y="77" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="13" font-weight="800">${escapeXml(truncateText(badgeNote || 'تناسب ومعادلات', 18))}</text>
        <rect x="196" y="100" width="46" height="28" rx="6" fill="${palette.primary}" />
        <rect x="252" y="100" width="48" height="28" rx="6" fill="${palette.secondary}" />
        ${renderCartoonCharacter(392, 92, palette.primary, palette.secondary, actors[0] || 'المسألة الحسابية', isCartoon, 'scholar')}
      </g>
    `;
  } else if (category === 'arabic-grammar') {
    sceneBody = `
      <g>
        <path d="M46 46 C96 32, 148 42, 168 58 C188 42, 240 32, 290 46 L290 148 C240 134, 188 144, 168 160 C148 144, 96 134, 46 148 Z" fill="#ffffff" stroke="${palette.primary}" stroke-width="3" stroke-linejoin="round" />
        <line x1="168" y1="58" x2="168" y2="160" stroke="${palette.primary}" stroke-width="2.5" />
        <rect x="64" y="68" width="88" height="24" rx="6" fill="${palette.softSurface}" stroke="${palette.softBorder}" />
        <text x="108" y="84" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(actors[0] || 'الركن الأول', 14))}</text>
        <rect x="184" y="68" width="88" height="24" rx="6" fill="${palette.softSurface}" stroke="${palette.softBorder}" />
        <text x="228" y="84" text-anchor="middle" fill="${palette.secondary}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(actors[1] || 'الركن الثاني', 14))}</text>
        <text x="168" y="126" text-anchor="middle" fill="${palette.accentText}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(badgeNote || 'القاعدة النحوية', 24))}</text>
        ${renderCartoonCharacter(388, 92, palette.primary, palette.secondary, actors[2] || 'معلّم اللغة', isCartoon, 'scholar')}
      </g>
    `;
  } else if (category === 'geography-map') {
    sceneBody = `
      <g>
        <circle cx="152" cy="96" r="58" fill="#DBEAFE" stroke="${palette.primary}" stroke-width="3.2" />
        <ellipse cx="152" cy="96" rx="28" ry="58" fill="none" stroke="${palette.primary}" stroke-width="1.8" />
        <line x1="94" y1="96" x2="210" y2="96" stroke="${palette.primary}" stroke-width="1.8" />
        <path d="M116 74 Q142 62 162 82 Q178 96 192 78" fill="#16A34A" opacity="0.5" />
        <path d="M122 114 Q148 104 168 122 Q184 130 194 116" fill="#16A34A" opacity="0.5" />
        <rect x="232" y="54" width="90" height="72" rx="10" fill="#ffffff" stroke="${palette.softBorder}" stroke-width="1.8" />
        <text x="277" y="82" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="11" font-weight="800">${escapeXml(truncateText(actors[1] || 'الموقع والمناخ', 14))}</text>
        <text x="277" y="106" text-anchor="middle" fill="${palette.secondary}" font-family="Tajawal, sans-serif" font-size="10" font-weight="700">${escapeXml(truncateText(badgeNote || 'خريطة توضيحية', 14))}</text>
        ${renderCartoonCharacter(396, 92, palette.primary, palette.secondary, actors[0] || 'الرحّالة', isCartoon, 'explorer')}
      </g>
    `;
  } else {
    // Conceptual Storyboard Scene
    sceneBody = `
      <g>
        <rect x="44" y="42" width="234" height="108" rx="14" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.4" />
        <text x="161" y="68" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="12" font-weight="800">${escapeXml(truncateText(badgeNote || title, 28))}</text>
        <rect x="64" y="82" width="194" height="24" rx="6" fill="${palette.softSurface}" />
        <text x="161" y="98" text-anchor="middle" fill="${palette.primary}" font-family="Tajawal, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(actors[0] || 'الفكرة المحورية للدرس', 28))}</text>
        <rect x="64" y="114" width="194" height="24" rx="6" fill="${palette.softSurface}" />
        <text x="161" y="130" text-anchor="middle" fill="${palette.accentText}" font-family="Tajawal, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(actors[1] || 'التطبيق العملي والربط', 28))}</text>
        ${renderCartoonCharacter(376, 92, palette.primary, palette.secondary, actors[0] || 'مرشد التعلم', isCartoon, 'scholar')}
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 260" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <rect x="0" y="0" width="480" height="260" rx="14" fill="${palette.softSurface}" />
    <rect x="10" y="10" width="460" height="240" rx="10" fill="none" stroke="${palette.softBorder}" stroke-width="1.5" />
    ${sceneBody}
    ${renderStagesStrip(stages, palette, 180)}
    <rect x="115" y="14" width="250" height="22" rx="6" fill="#ffffff" stroke="${palette.softBorder}" stroke-width="1.2" />
    <text x="240" y="29" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="800">${sceneTitle}</text>
  </svg>`;
}

export function buildDynamicCoverVisualSvg(params: {
  guideTitle: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  coverSpec?: CoverVisualSpec;
  lessonTopics: string[];
  palette: ThemePalette;
}): string {
  const {
    guideTitle,
    subject,
    gradeLevel,
    coverSpec,
    lessonTopics,
    palette,
  } = params;

  const category: SceneCategory =
    coverSpec?.sceneCategory || inferSceneCategoryFromSubjectAndText(subject, `${guideTitle} ${lessonTopics.join(' ')}`);
  const seed = coverSpec?.seed ?? 0;

  const displayTopics = (
    coverSpec?.visualElements?.length ? coverSpec.visualElements : lessonTopics
  )
    .filter(Boolean)
    .slice(0, 3);

  while (displayTopics.length < 3) {
    displayTopics.push(
      displayTopics.length === 0
        ? subject || 'شرح مبسط ومبتكر'
        : displayTopics.length === 1
        ? gradeLevel || 'تشبيهات وخلاصات سريعة'
        : 'أفكار الامتحان والتدريب'
    );
  }

  const motif = escapeXml(
    truncateText(
      coverSpec?.headlineMotif ||
        (subject ? `رحلة إبداعية في ${subject}` : guideTitle || 'مذكرة تعليمية متكاملة'),
      36
    )
  );

  let emblemBackdrop = '';

  if (category.startsWith('history')) {
    emblemBackdrop = `
      <!-- History Dynamic Cover Illustration: Archway, Compass & Scroll -->
      <rect x="28" y="34" width="186" height="192" rx="14" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.5" />
      <path d="M56 196 L56 102 Q121 48 186 102 L186 196 Z" fill="${palette.softSurface}" stroke="${palette.secondary}" stroke-width="2.5" />
      <rect x="76" y="132" width="90" height="54" rx="6" fill="${palette.primary}" />
      <polygon points="121,64 134,92 108,92" fill="${palette.secondary}" />
      <circle cx="121" cy="112" r="14" fill="#ffffff" stroke="${palette.primary}" stroke-width="2" />
      <line x1="121" y1="100" x2="121" y2="124" stroke="${palette.secondary}" stroke-width="2" />
    `;
  } else if (category.startsWith('programming')) {
    emblemBackdrop = `
      <!-- Programming Dynamic Cover Illustration: Terminal & Flow Architecture -->
      <rect x="28" y="34" width="186" height="192" rx="14" fill="#0F172A" stroke="${palette.primary}" stroke-width="2.5" />
      <rect x="28" y="34" width="186" height="28" rx="14" fill="#1E293B" />
      <circle cx="46" cy="48" r="4" fill="#EF4444" />
      <circle cx="60" cy="48" r="4" fill="#F59E0B" />
      <circle cx="74" cy="48" r="4" fill="#10B981" />
      <text x="48" y="88" fill="#38BDF8" font-family="monospace" font-size="12" font-weight="700">function learn() {</text>
      <text x="60" y="110" fill="#A7F3D0" font-family="monospace" font-size="11.5">  logic = true;</text>
      <text x="60" y="132" fill="#FDE68A" font-family="monospace" font-size="11.5">  return mastery;</text>
      <text x="48" y="154" fill="#38BDF8" font-family="monospace" font-size="12" font-weight="700">}</text>
      <rect x="46" y="174" width="150" height="32" rx="8" fill="${palette.secondary}" />
      <text x="121" y="194" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-size="11" font-weight="700">خوارزمية التفوق</text>
    `;
  } else if (category.startsWith('math')) {
    emblemBackdrop = `
      <!-- Math Dynamic Cover Illustration: Geometry & Precision -->
      <rect x="28" y="34" width="186" height="192" rx="14" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.5" />
      <circle cx="121" cy="112" r="52" fill="${palette.softSurface}" stroke="${palette.primary}" stroke-width="2.5" />
      <polygon points="121,66 164,144 78,144" fill="${palette.secondary}" opacity="0.22" stroke="${palette.secondary}" stroke-width="2.5" />
      <text x="121" y="124" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="18" font-weight="800">π · Σ · ÷</text>
      <rect x="52" y="182" width="138" height="24" rx="6" fill="${palette.primary}" />
      <text x="121" y="198" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">بناء التفكير الرياضي</text>
    `;
  } else if (category === 'arabic-grammar') {
    emblemBackdrop = `
      <!-- Arabic Dynamic Cover Illustration: Open Book & Heritage Arch -->
      <rect x="28" y="34" width="186" height="192" rx="14" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.5" />
      <path d="M50 86 C86 70, 112 78, 121 92 C130 78, 156 70, 192 86 L192 174 C156 158, 130 166, 121 180 C112 166, 86 158, 50 174 Z" fill="${palette.softSurface}" stroke="${palette.primary}" stroke-width="2.5" />
      <line x1="121" y1="92" x2="121" y2="180" stroke="${palette.secondary}" stroke-width="2.5" />
      <text x="121" y="64" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="14" font-weight="800">البيان واللغة</text>
    `;
  } else {
    emblemBackdrop = `
      <!-- Science / General Dynamic Cover Illustration: Structured Discovery Panel -->
      <rect x="28" y="34" width="186" height="192" rx="14" fill="#ffffff" stroke="${palette.primary}" stroke-width="2.5" />
      <ellipse cx="121" cy="112" rx="64" ry="22" transform="rotate(${28 + (seed % 2) * 14} 121 112)" fill="none" stroke="${palette.primary}" stroke-width="2.4" />
      <ellipse cx="121" cy="112" rx="64" ry="22" transform="rotate(${-28 - (seed % 2) * 14} 121 112)" fill="none" stroke="${palette.secondary}" stroke-width="2.4" />
      <circle cx="121" cy="112" r="22" fill="${palette.primary}" />
      <circle cx="121" cy="112" r="9" fill="${palette.secondary}" />
      <rect x="52" y="182" width="138" height="24" rx="6" fill="${palette.softSurface}" stroke="${palette.softBorder}" />
      <text x="121" y="198" text-anchor="middle" fill="${palette.primaryDark}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">الاستكشاف والفهم العميق</text>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 260" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="cov-${palette.id}-${seed}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.softSurface}" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="480" height="260" rx="14" fill="url(#cov-${palette.id}-${seed})" />
    <rect x="10" y="10" width="460" height="240" rx="10" fill="none" stroke="${palette.softBorder}" stroke-width="1.5" />
    ${emblemBackdrop}
    <!-- Dynamic Book Topics & Motif Panel on Right (RTL reading focus) -->
    <g transform="translate(232, 34)">
      <rect x="0" y="0" width="220" height="192" rx="14" fill="#ffffff" stroke="${palette.softBorder}" stroke-width="1.8" />
      <rect x="14" y="14" width="192" height="28" rx="7" fill="${palette.primary}" />
      <text x="110" y="32" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-size="11" font-weight="800">${motif}</text>
      <text x="198" y="64" text-anchor="end" fill="${palette.accentText}" font-family="Cairo, sans-serif" font-size="10.5" font-weight="700">أبرز محاور المحتوى:</text>
      ${displayTopics
        .map(
          (topic, idx) => `
        <g transform="translate(14, ${76 + idx * 36})">
          <rect x="0" y="0" width="192" height="28" rx="6" fill="${palette.softSurface}" stroke="${palette.softBorder}" />
          <rect x="164" y="5" width="20" height="18" rx="4" fill="${idx === 1 ? palette.secondary : palette.primary}" />
          <text x="174" y="17.5" text-anchor="middle" fill="#ffffff" font-family="Cairo, sans-serif" font-size="10" font-weight="800">${idx + 1}</text>
          <text x="156" y="18" text-anchor="end" fill="#0F172A" font-family="Tajawal, sans-serif" font-size="10.5" font-weight="700">${escapeXml(truncateText(topic, 26))}</text>
        </g>
      `
        )
        .join('')}
    </g>
  </svg>`;
}
