import {
  IllustrationSpec,
  IllustrationStyle,
  SubjectIconId,
  ThemePalette,
} from '../types/studyGuide';
import { renderSceneIllustrationSvg } from './sceneRenderer';

const UNSAFE_TAGS_REGEX = /<\s*(script|foreignObject|iframe|object|embed|link|meta|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const UNSAFE_SELF_CLOSING_REGEX = /<\s*(script|foreignObject|iframe|object|embed|link|meta)\b[^>]*\/?>/gi;
const EVENT_HANDLER_REGEX = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URI_REGEX = /(?:href|xlink:href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi;

export function sanitizeIllustrationSvg(rawSvg: string, minPrimitives = 6): string | null {
  if (!rawSvg || typeof rawSvg !== 'string') return null;

  const trimmed = rawSvg
    .replace(/```svg\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const svgMatch = trimmed.match(/<svg[\s\S]*<\/svg>/i);
  if (!svgMatch) return null;

  let cleaned = svgMatch[0]
    .replace(UNSAFE_TAGS_REGEX, '')
    .replace(UNSAFE_SELF_CLOSING_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .replace(JS_URI_REGEX, '');

  if (!/viewBox\s*=/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg\b/i, '<svg viewBox="0 0 480 260"');
  }

  cleaned = cleaned.replace(
    /<svg\b([^>]*)>/i,
    (_full, attrs: string) => {
      const cleanAttrs = attrs
        .replace(/\s+(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
        .trim();
      return `<svg ${cleanAttrs} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
    }
  );

  const primitiveMatches = cleaned.match(/<(path|circle|rect|ellipse|polygon|polyline|line)\b/gi);
  if (!primitiveMatches || primitiveMatches.length < minPrimitives) {
    return null;
  }

  return cleaned;
}

export function buildFallbackIllustrationSvg(params: {
  title: string;
  caption?: string;
  subject?: string;
  spec?: IllustrationSpec;
  subjectIcon: SubjectIconId;
  illustrationStyle: IllustrationStyle;
  palette: ThemePalette;
  variantSeed?: number;
}): string {
  return renderSceneIllustrationSvg({
    spec: params.spec,
    title: params.title,
    caption: params.caption,
    subject: params.subject,
    subjectIcon: params.subjectIcon,
    illustrationStyle: params.illustrationStyle,
    palette: params.palette,
    variantSeed: params.variantSeed,
  });
}
