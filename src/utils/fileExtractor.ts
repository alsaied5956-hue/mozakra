export interface ExtractionResult {
  text: string;
  pageCount?: number;
  fileType: 'pdf' | 'docx' | 'text';
  warning?: string;
}

export async function extractTextFromFile(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<ExtractionResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || file.type === 'text/plain') {
    const text = (await file.text()).trim();
    if (!text) {
      throw new Error('الملف النصي فارغ ولا يحتوي على نصوص قابلة للتحليل.');
    }
    return { text, fileType: 'text' };
  }

  if (lowerName.endsWith('.docx')) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      if (!text) {
        throw new Error('لم يتم العثور على نص مقروء داخل ملف Word. تأكد أن الملف لا يحتوي على صور فقط.');
      }
      return { text, fileType: 'docx' };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Word')) {
        throw error;
      }
      throw new Error('تعذرت قراءة ملف Word (.docx). يمكنك نسخ النص من المستند ولصقه مباشرة في المحرر.');
    }
  }

  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();

      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;

      const pageTexts: string[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        onProgress?.(pageNum, pdf.numPages);
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const line = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (line) {
          pageTexts.push(`--- صفحة ${pageNum} ---\n${line}`);
        }
      }

      const combined = pageTexts.join('\n\n').trim();
      if (!combined || combined.length < 25) {
        throw new Error(
          'هذا الملف عبارة عن صور ممسوحة ضوئياً (PDF مصوّر) لا يحتوي على نص قابل للاستخراج. يرجى لصق نص الدروس مباشرة أو رفع ملف نصي/Word.'
        );
      }

      return {
        text: combined,
        pageCount: pdf.numPages,
        fileType: 'pdf',
        warning:
          pageTexts.length < pdf.numPages
            ? `تم استخراج النص من ${pageTexts.length} من أصل ${pdf.numPages} صفحة (بعض الصفحات قد تكون مصوّرة).`
            : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('PDF')) {
        throw error;
      }
      throw new Error(
        'تعذر استخراج النص من ملف PDF. تأكد أنه ملف نصي غير محمي بكلمة مرور، أو الصق المحتوى مباشرة.'
      );
    }
  }

  throw new Error('صيغة الملف غير مدعومة. يرجى اختيار ملف PDF أو Word (.docx) أو ملف نصي (.txt).');
}
