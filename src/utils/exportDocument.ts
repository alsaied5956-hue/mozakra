import { StudyGuideDocument, TeacherProfile, ThemePalette } from '../types/studyGuide';
import { buildTeacherEmblemSvg, formatSubjectGrade } from './themes';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTeacherDisplay(profile: TeacherProfile): string {
  return profile.teacherName.trim() || 'المعلم';
}

function resolveSubjectDisplay(profile: TeacherProfile): string {
  return (
    formatSubjectGrade(profile.subject, profile.gradeLevel) ||
    profile.subjectGrade.trim()
  );
}

export function buildExportMarkdown(
  doc: StudyGuideDocument,
  profile: TeacherProfile
): string {
  const teacherDisplay = resolveTeacherDisplay(profile);
  const subjectDisplay = resolveSubjectDisplay(profile);
  const lines: string[] = [];
  lines.push(`# ${doc.guideTitle || profile.guideTitle || 'المذكرة الدراسية'}`);
  lines.push('');
  lines.push(`- **المعلم / المعلمة:** ${teacherDisplay}`);
  if (subjectDisplay) {
    lines.push(`- **المادة والصف:** ${subjectDisplay}`);
  }
  lines.push(`- **الأسلوب التربوي:** ${profile.teachingStyle}`);
  lines.push(`- **العام الدراسي:** ${profile.academicYear}`);
  lines.push('');

  if (doc.outlineSummary) {
    lines.push(`> ${doc.outlineSummary}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  for (const page of doc.pages) {
    lines.push(`## صفحة ${page.pageNumber}: ${page.lessonTitle}`);
    if (page.pageSubtitle) {
      lines.push(`*${page.pageSubtitle}*`);
    }
    lines.push('');

    for (const block of page.explanationBlocks) {
      lines.push(`### ${block.heading}`);
      lines.push(block.body);
      lines.push('');
    }

    if (page.codeSnippet?.trim()) {
      lines.push('```');
      lines.push(page.codeSnippet.trim());
      lines.push('```');
      lines.push('');
    }

    lines.push(`> **معلومة بصورة / تشبيه تخيلي — ${page.analogyTitle}:** ${page.analogyText}`);
    lines.push('');
    lines.push(`> **تنبيه مهم / فخ بيقع فيه الطلاب — ${page.pitfallTitle}:** ${page.pitfallText}`);
    lines.push('');

    if (page.quickRecap.length > 0) {
      lines.push('**خلاصة سريعة:**');
      for (const item of page.quickRecap) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (page.teacherNote.trim()) {
      lines.push(`**ملاحظة المعلم:** ${page.teacherNote}`);
      lines.push('');
    }

    lines.push(`*توضيح بصري: ${page.illustrationCaption}*`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function buildExportHtml(
  doc: StudyGuideDocument,
  profile: TeacherProfile,
  palette: ThemePalette
): string {
  const teacherDisplay = resolveTeacherDisplay(profile);
  const subjectDisplay = resolveSubjectDisplay(profile);
  const emblemHtml =
    profile.logoMode === 'upload' && profile.uploadedLogoDataUrl
      ? `<img src="${profile.uploadedLogoDataUrl}" alt="شعار المعلم" style="width:42px;height:42px;object-fit:contain;border-radius:10px;" />`
      : buildTeacherEmblemSvg(profile.teacherName, profile.subjectIcon, palette);

  const coverVisualHtml = doc.coverImageUrl
    ? `<img src="${doc.coverImageUrl}" alt="${escapeHtml(doc.guideTitle || profile.guideTitle || 'غلاف المذكرة')}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;" />`
    : `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;text-align:center;color:${palette.primaryDark};background:${palette.softSurface};border-radius:10px;">
        <div style="font-family:'Cairo',sans-serif;font-weight:700;font-size:16px;">${escapeHtml(doc.coverVisualSpec?.headlineMotif || doc.guideTitle || profile.guideTitle || 'غلاف المذكرة الدراسية')}</div>
        ${subjectDisplay ? `<div style="font-size:12px;color:#475569;margin-top:6px;">${escapeHtml(subjectDisplay)}</div>` : ''}
      </div>`;

  const pagesHtml = doc.pages
    .map((page) => {
      const pageVisualHtml = page.illustrationImageUrl
        ? `<img src="${page.illustrationImageUrl}" alt="${escapeHtml(page.illustrationCaption || page.lessonTitle)}" style="width:100%;height:190px;object-fit:cover;border-radius:8px;display:block;" />`
        : `<div style="height:120px;display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;color:#475569;background:${palette.softSurface};border-radius:8px;font-size:12.5px;">${escapeHtml(page.illustrationSpec?.sceneDescription || page.illustrationCaption || page.lessonTitle)}</div>`;

      const blocksHtml = page.explanationBlocks
        .map(
          (b) => `
          <div style="margin-bottom:14px;">
            <h3 style="margin:0 0 6px;font-family:'Cairo',sans-serif;font-size:15px;color:${palette.primaryDark};">${escapeHtml(b.heading)}</h3>
            <p style="margin:0;font-size:13.5px;line-height:1.8;color:#1e293b;">${escapeHtml(b.body)}</p>
          </div>`
        )
        .join('');

      const codeHtml = page.codeSnippet?.trim()
        ? `<pre dir="ltr" style="margin:12px 0;padding:12px 14px;background:#0f172a;color:#e2e8f0;border-radius:10px;font-family:monospace;font-size:12px;line-height:1.6;overflow:auto;"><code>${escapeHtml(page.codeSnippet.trim())}</code></pre>`
        : '';

      const recapHtml = page.quickRecap
        .map((item) => `<li style="margin-bottom:4px;">${escapeHtml(item)}</li>`)
        .join('');

      return `
      <section class="sheet">
        <header class="sheet-header">
          <div>
            <div style="font-size:11px;color:#64748b;">الدرس ${page.lessonOrder}${subjectDisplay ? ` · ${escapeHtml(subjectDisplay)}` : ''}</div>
            <h2 style="margin:2px 0 0;font-family:'Cairo',sans-serif;font-size:19px;color:${palette.primary};">${escapeHtml(page.lessonTitle)}</h2>
            ${page.pageSubtitle ? `<div style="font-size:12.5px;color:#475569;margin-top:2px;">${escapeHtml(page.pageSubtitle)}</div>` : ''}
          </div>
          <div class="brand-page-badge">
            <div style="text-align:left;">
              <div class="page-num">صفحة ${page.pageNumber}</div>
              <div style="font-size:10px;color:#475569;">${escapeHtml(teacherDisplay)}</div>
            </div>
            <div style="width:36px;height:36px;">${emblemHtml}</div>
          </div>
        </header>

        <div class="sheet-body">
          <div class="illustration-box">
            <div style="width:100%;">${pageVisualHtml}</div>
            <div style="font-size:11.5px;color:#475569;text-align:center;margin-top:6px;">${escapeHtml(page.illustrationCaption)}</div>
          </div>

          <div style="margin-top:16px;">${blocksHtml}</div>
          ${codeHtml}

          <div class="callout-grid">
            <div class="callout" style="background:${palette.softSurface};border-color:${palette.softBorder};">
              <div class="callout-label" style="color:${palette.primary};">معلومة بصورة / تشبيه تخيلي</div>
              <div class="callout-title">${escapeHtml(page.analogyTitle)}</div>
              <p>${escapeHtml(page.analogyText)}</p>
            </div>
            <div class="callout" style="background:#FFF8F1;border-color:#FCD9BD;">
              <div class="callout-label" style="color:#C2410C;">تنبيه مهم / فخ بيقع فيه الطلاب</div>
              <div class="callout-title">${escapeHtml(page.pitfallTitle)}</div>
              <p>${escapeHtml(page.pitfallText)}</p>
            </div>
          </div>

          <div class="recap-box">
            <div style="font-family:'Cairo',sans-serif;font-weight:700;font-size:13px;color:${palette.primaryDark};margin-bottom:6px;">خلاصة سريعة</div>
            <ul style="margin:0;padding-right:18px;font-size:12.5px;color:#334155;line-height:1.7;">${recapHtml}</ul>
          </div>

          ${
            page.teacherNote.trim()
              ? `<div style="margin-top:12px;padding:10px 12px;border:1px dashed ${palette.softBorder};border-radius:8px;font-size:12.5px;color:#334155;"><strong>ملاحظة المعلم:</strong> ${escapeHtml(page.teacherNote)}</div>`
              : ''
          }
        </div>

        <footer class="sheet-footer">
          <span>${escapeHtml(teacherDisplay)} · ${escapeHtml(doc.guideTitle || profile.guideTitle)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span>صفحة ${page.pageNumber} من ${doc.pages.length}</span>
            <div style="width:24px;height:24px;">${emblemHtml}</div>
          </div>
        </footer>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(doc.guideTitle || profile.guideTitle || 'المذكرة الدراسية')}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #e2e8f0; font-family: 'Tajawal', sans-serif; color: #0f172a; }
    .sheet { width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #ffffff; padding: 16mm 16mm 14mm; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 12px 32px rgba(15,23,42,0.12); page-break-after: always; }
    .cover { background: linear-gradient(180deg, ${palette.softSurface} 0%, #ffffff 48%); border-top: 10px solid ${palette.primary}; }
    .sheet-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid ${palette.softBorder}; padding-bottom: 10px; }
    .brand-page-badge { display: flex; align-items: center; gap: 10px; border: 1px solid ${palette.softBorder}; background: ${palette.softSurface}; padding: 6px 10px; border-radius: 10px; }
    .page-num { font-family: 'Cairo', sans-serif; font-weight: 700; font-size: 13px; color: ${palette.primaryDark}; }
    .sheet-body { flex: 1; padding: 14px 0; }
    .illustration-box { border: 1px solid ${palette.softBorder}; background: #f8fafc; border-radius: 12px; padding: 10px; }
    .callout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .callout { border: 1px solid; border-radius: 10px; padding: 11px 13px; }
    .callout-label { font-family: 'Cairo', sans-serif; font-size: 11.5px; font-weight: 700; margin-bottom: 3px; }
    .callout-title { font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .callout p { margin: 0; font-size: 12.5px; line-height: 1.65; color: #334155; }
    .recap-box { margin-top: 14px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 11px 14px; }
    .sheet-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 11.5px; color: #64748b; }
    @media print { body { background: #fff; padding: 0; } .sheet { margin: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <section class="sheet cover">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:56px;height:56px;">${emblemHtml}</div>
        <div>
          <div style="font-family:'Cairo',sans-serif;font-weight:700;font-size:15px;color:${palette.primaryDark};">${escapeHtml(teacherDisplay)}</div>
          ${subjectDisplay ? `<div style="font-size:12.5px;color:#475569;">${escapeHtml(subjectDisplay)}</div>` : ''}
        </div>
      </div>
      <div style="font-size:12px;color:#64748b;">${escapeHtml(profile.academicYear)}</div>
    </div>

    <div style="text-align:center;margin:auto 0;padding:24px 12px;">
      <div style="font-size:13px;color:${palette.accentText};font-family:'Cairo',sans-serif;font-weight:700;margin-bottom:10px;">${escapeHtml(profile.teachingStyle)}</div>
      <h1 style="font-family:'Cairo',sans-serif;font-size:34px;line-height:1.35;color:${palette.primaryDark};margin:0 0 14px;">${escapeHtml(doc.guideTitle || profile.guideTitle)}</h1>
      <p style="font-size:15px;line-height:1.8;color:#475569;max-width:480px;margin:0 auto 24px;">${escapeHtml(doc.outlineSummary)}</p>
      <div style="max-width:480px;height:240px;margin:0 auto;border:1px solid ${palette.softBorder};border-radius:14px;padding:8px;background:#ffffff;">${coverVisualHtml}</div>
    </div>

    <div class="sheet-footer">
      <span>إعداد: ${escapeHtml(teacherDisplay)}</span>
      <span>${doc.pages.length} صفحات دراسية</span>
    </div>
  </section>
  ${pagesHtml}
</body>
</html>`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
