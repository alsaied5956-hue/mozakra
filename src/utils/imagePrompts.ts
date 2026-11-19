import { IllustrationSpec, IllustrationStyle } from '../types/studyGuide';

function resolveArtStyleDirective(illustrationStyle?: IllustrationStyle | string): string {
  if (illustrationStyle === 'رسوم توضيحية تخيلية مفصلة') {
    return 'Detailed conceptual educational book illustration, clean rich composition, crisp vector-inspired digital painting, clear visual storytelling, warm balanced studio lighting, high clarity for students';
  }
  return 'Playful colorful 2D editorial cartoon educational illustration, expressive friendly characters, clean bold outlines, vibrant harmonious palette, modern children and teen textbook illustration style';
}

function resolveDomainVisualCue(subjectText: string, topicText: string): string {
  const combined = `${subjectText} ${topicText}`.toLowerCase();

  if (/(حرب|معرك|غزو|فتح|جيش|أسطول|معاهد|صلح|ثورة|قائد|حطين|عين جالوت)/.test(combined)) {
    return 'Vivid historical educational scene depicting period-accurate medieval architecture, horses, banners, maps, strategists and landscape setting, respectful student-friendly storytelling without graphic violence';
  }
  if (/(تاريخ|حضار|خلافة|دولة|فرعون|عصر|مملكة|سلطان|تراث)/.test(combined)) {
    return 'Rich historical civilization illustration showing authentic period architecture, parchment scrolls, brass astrolabe or compass, scholars or explorers in historical setting';
  }
  if (/(برمج|بايثون|جافا|حاسب|خوارزم|شرط|حلقة|كود|متغير|code|python|programming)/.test(combined)) {
    return 'Creative visual metaphor of computer programming and algorithms: friendly curious student developer, glowing modular logic blocks, branching pathways, gears and flow nodes in a sleek modern workspace';
  }
  if (/(ضوء|منشور|طيف|مرآ|عدس|انكسار|انعكاس|فيزياء|كهرباء|قوة|حركة|طاقة)/.test(combined)) {
    return 'Vivid physics discovery scene with glass prism splitting rainbow spectrum light rays, mirrors, lenses or clean physics apparatus in a bright imaginative lab';
  }
  if (/(خلي|نواة|أحياء|نبات|تمثيل ضوئ|قلب|دم|جهاز|ميتوكوندريا|dna)/.test(combined)) {
    return 'Imaginative biology illustration showing vibrant cutaway plant or animal cell organelles, glowing nucleus, chloroplasts or microscopic nature ecosystem as a friendly mini-world';
  }
  if (/(كيمياء|تفاعل|ذرة|عنصر|مركب|حمض|قاعدة)/.test(combined)) {
    return 'Lively chemistry laboratory educational scene with colorful glass flasks, bubbling reaction, glowing molecular spheres and an enthusiastic young scientist';
  }
  if (/(رياضيات|كسر|كسور|نسبة|مثلث|زاوية|هندسة|جبر|معادلة)/.test(combined)) {
    return 'Concrete visual math metaphor using tangible everyday objects like colorful geometric shapes, fractional pie slices, measuring scales and architectural blocks';
  }
  if (/(نحو|عرب|أدب|بلاغة|قراءة|لغة|قصيدة)/.test(combined)) {
    return 'Warm expressive Arabic literary and grammar visual metaphor with open illuminated storybook, calligraphy feather quill, wooden bookshelf and imaginative storytelling scene';
  }
  if (/(جغرافيا|خريطة|مناخ|تضاريس|نهر|محيط|دراسات|قارة)/.test(combined)) {
    return 'Expansive educational geography diorama showing layered mountains, rivers, oceans, weather clouds, compass rose and topographic landscape';
  }
  return 'Engaging student-friendly conceptual educational scene with expressive visual metaphors, props and clear narrative composition';
}

export function buildCoverImagePrompt(params: {
  guideTitle?: string;
  subject?: string;
  gradeLevel?: string;
  lessonTopics?: string[];
  teachingStyle?: string;
  illustrationStyle?: IllustrationStyle | string;
  customNote?: string;
}): string {
  const {
    guideTitle = '',
    subject = '',
    gradeLevel = '',
    lessonTopics = [],
    illustrationStyle,
    customNote = '',
  } = params;

  const artStyle = resolveArtStyleDirective(illustrationStyle);
  const domainCue = resolveDomainVisualCue(
    subject,
    `${guideTitle} ${lessonTopics.join(' ')} ${customNote}`
  );
  const topicsContext =
    lessonTopics.length > 0
      ? `Key book topics represented visually: ${lessonTopics.slice(0, 4).join(', ')}.`
      : '';
  const customDirective = customNote.trim()
    ? `Teacher custom art direction: ${customNote.trim()}.`
    : '';

  return [
    `${artStyle}.`,
    `Bespoke educational study-guide book cover centerpiece illustration for the subject "${subject || 'General Education'}"${gradeLevel ? ` (${gradeLevel})` : ''}, inspired by the book theme "${guideTitle || subject || 'Smart Study Guide'}".`,
    `${domainCue}.`,
    topicsContext,
    customDirective,
    'Clean wide 16:9 composition with focal storytelling elements in the center, rich clean background, student-friendly, high resolution. CRITICAL: Pure illustration only — absolutely NO text, NO Arabic or English words, NO letters, NO numbers, NO watermarks inside the image.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildPageImagePrompt(params: {
  subject?: string;
  lessonTitle: string;
  explanationSummary?: string;
  analogyText?: string;
  illustrationSpec?: IllustrationSpec;
  illustrationStyle?: IllustrationStyle | string;
  customNote?: string;
}): string {
  const {
    subject = '',
    lessonTitle,
    explanationSummary = '',
    analogyText = '',
    illustrationSpec,
    illustrationStyle,
    customNote = '',
  } = params;

  const artStyle = resolveArtStyleDirective(illustrationStyle);
  const specSummary = illustrationSpec
    ? [
        illustrationSpec.sceneDescription,
        illustrationSpec.charactersOrActors?.length
          ? `Characters/Elements: ${illustrationSpec.charactersOrActors.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('. ')
    : '';

  const domainCue = resolveDomainVisualCue(
    subject,
    `${lessonTitle} ${specSummary} ${analogyText} ${explanationSummary}`
  );

  const analogyCue = analogyText.trim()
    ? `Visual metaphor inspiration: ${analogyText.trim().slice(0, 220)}.`
    : '';

  const customDirective = customNote.trim()
    ? `Custom teacher scene instruction: ${customNote.trim()}.`
    : '';

  return [
    `${artStyle}.`,
    `Single clear educational illustration explaining the lesson "${lessonTitle}"${subject ? ` in ${subject}` : ''}.`,
    `${domainCue}.`,
    specSummary ? `Scene action: ${specSummary}.` : '',
    analogyCue,
    explanationSummary.trim()
      ? `Educational context: ${explanationSummary.trim().slice(0, 260)}.`
      : '',
    customDirective,
    'Clean 16:9 horizontal framing, clear foreground subject, bright readable colors, student-friendly editorial quality. CRITICAL: Pure visual illustration with ZERO garbled text — do NOT render any words, labels, letters, numbers, or speech-bubble text inside the image.',
  ]
    .filter(Boolean)
    .join(' ');
}
