export type ThemeId = 'navy-gold' | 'emerald-slate' | 'cobalt-amber' | 'plum-coral';

export type SubjectIconId =
  | 'atom'
  | 'calculator'
  | 'book'
  | 'globe'
  | 'compass'
  | 'scroll'
  | 'code';

export type TeachingStyle =
  | 'أسلوب قصصي وتخيلي مبتكر'
  | 'تبسيط بصري وربط بالواقع'
  | 'خرائط ذهنية وتدرج ذكي'
  | 'تحدي وأسئلة تفاعلية';

export type IllustrationStyle =
  | 'رسوم كاريكاتيرية مرحة'
  | 'رسوم توضيحية تخيلية مفصلة';

export type DetailLevel = 'balanced' | 'detailed' | 'concise';

export type LogoMode = 'auto' | 'upload';

export type SceneCategory =
  | 'history-battle'
  | 'history-civilization'
  | 'history-timeline'
  | 'programming-flow'
  | 'programming-code'
  | 'science-optics'
  | 'science-biology'
  | 'science-physics'
  | 'science-chemistry'
  | 'math-visual'
  | 'arabic-grammar'
  | 'geography-map'
  | 'conceptual-story';

export interface IllustrationSpec {
  sceneCategory: SceneCategory;
  sceneTitle: string;
  sceneDescription: string;
  charactersOrActors: string[];
  visualStages: string[];
  keyEquationOrCode?: string;
}

export interface CoverVisualSpec {
  headlineMotif: string;
  sceneCategory: SceneCategory;
  visualElements: string[];
  subtitleTag?: string;
  seed: number;
}

export interface ThemePalette {
  id: ThemeId;
  name: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  softSurface: string;
  softBorder: string;
  accentText: string;
}

export interface TeacherProfile {
  teacherName: string;
  subject: string;
  gradeLevel: string;
  subjectGrade: string;
  guideTitle: string;
  academicYear: string;
  logoMode: LogoMode;
  uploadedLogoDataUrl: string | null;
  subjectIcon: SubjectIconId;
  themeId: ThemeId;
  teachingStyle: TeachingStyle;
  illustrationStyle: IllustrationStyle;
  detailLevel: DetailLevel;
}

export interface OutlineLesson {
  id: string;
  order: number;
  title: string;
  subtopics: string[];
  sourceExcerpt: string;
  sourceContent: string;
  sourceRange?: string;
  estimatedPages: number;
}

export interface ExplanationBlock {
  heading: string;
  body: string;
}

export type ImageGenerationStatus = 'idle' | 'queued' | 'generating' | 'completed' | 'error';

export interface StudyPage {
  id: string;
  pageNumber: number;
  lessonOrder: number;
  lessonTitle: string;
  pageSubtitle: string;
  explanationBlocks: ExplanationBlock[];
  codeSnippet?: string;
  analogyTitle: string;
  analogyText: string;
  pitfallTitle: string;
  pitfallText: string;
  quickRecap: string[];
  teacherNote: string;
  illustrationCaption: string;
  illustrationKeywords: string[];
  illustrationSpec?: IllustrationSpec;
  illustrationSvg: string;
  illustrationImageUrl?: string;
  illustrationStatus?: ImageGenerationStatus;
  illustrationError?: string;
  illustrationPrompt?: string;
}

export interface StudyGuideDocument {
  guideTitle: string;
  outlineSummary: string;
  pages: StudyPage[];
  coverVisualSpec?: CoverVisualSpec;
  coverImageUrl?: string;
  coverImageStatus?: ImageGenerationStatus;
  coverImageError?: string;
  generatedAt: string;
}

export interface GenerationProgressState {
  status: 'idle' | 'running' | 'paused' | 'error' | 'completed';
  currentBatchIndex: number;
  totalBatches: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  generatedPagesCount: number;
  failedBatchIndex: number | null;
  errorMessage: string | null;
  autoContinue: boolean;
}

export interface ImageQueueSummary {
  total: number;
  completed: number;
  queued: number;
  generating: number;
  failed: number;
  activeLabel: string | null;
  cooldownSeconds: number | null;
  isPaused: boolean;
}
