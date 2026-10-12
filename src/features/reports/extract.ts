// Reading the text out of a lab report PDF, in the browser. Nothing leaves the device: pdf.js reads text PDFs, and a
// scanned page (an image with no text in it) is read by Tesseract running locally. Both are loaded only when a report
// is opened. Tesseract's engine and English data (about 15 MB) are served by Intus itself and fetched only when a
// scanned page is met.
import { linesFromPieces, type TextPiece } from './lines.ts';

/** A page with fewer characters of text than this is treated as a scan and read with OCR. */
const SCANNED_BELOW = 40;
/** Large enough to read small print, small enough to stay quick on a phone. */
const OCR_SCALE = 2.5;
export const MAX_PAGES = 12;
export const MAX_BYTES = 15 * 1024 * 1024;

export interface Extracted {
  lines: string[];
  pages: number;
  /** pages that had to be read with OCR, which makes more mistakes than reading the text */
  ocrPages: number;
}

export async function extractLines(file: File, onProgress?: (message: string) => void): Promise<Extracted> {
  if (file.size > MAX_BYTES) throw new Error('That file is over 15 MB. Lab reports are usually far smaller; check it is the right file.');
  // the legacy build carries polyfills for the newest JavaScript the modern build relies on, which many phones and
  // older browsers do not have yet
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const pages = Math.min(doc.numPages, MAX_PAGES);
    const lines: string[] = [];
    let ocrPages = 0;
    let ocr: Awaited<ReturnType<typeof import('tesseract.js').createWorker>> | null = null;
    try {
      for (let n = 1; n <= pages; n++) {
        onProgress?.(`Reading page ${n} of ${pages}`);
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        const pieces: TextPiece[] = [];
        for (const item of content.items) {
          if (!('str' in item)) continue;
          pieces.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height || Math.abs(item.transform[3]) });
        }
        const text = pieces.reduce((n, p) => n + p.str.trim().length, 0);
        if (text >= SCANNED_BELOW) {
          lines.push(...linesFromPieces(pieces));
          continue;
        }
        onProgress?.(`Page ${n} is a scan. Reading it on this device; the first scan loads the reader, about 15 MB`);
        const viewport = page.getViewport({ scale: OCR_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        if (!ocr) {
          const { createWorker } = await import('tesseract.js');
          // everything is served from Intus (scripts/copy-ocr.mjs), so nothing is fetched from a third party
          ocr = await createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/', langPath: '/ocr/', gzip: true });
        }
        const { data } = await ocr.recognize(canvas);
        lines.push(...data.text.split('\n').map((l) => l.trim()).filter(Boolean));
        ocrPages++;
        canvas.width = canvas.height = 0;
      }
    } finally {
      await ocr?.terminate();
    }
    return { lines, pages, ocrPages };
  } finally {
    await doc.loadingTask.destroy();
  }
}
