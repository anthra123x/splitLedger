import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfParseModule from 'pdf-parse';
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

const execAsync = promisify(exec);

export interface OcrProcessResult {
  text: string;
  previewPath: string | null;
  boundingBoxes: Array<{
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export class OcrService {
  /**
   * Process document with dual-engine: Pure-JS in-memory parser (Vercel Serverless) + Native OS binaries (Local/Docker)
   */
  static async processDocument(filePath: string, mimeType: string): Promise<OcrProcessResult> {
    const isPdf = mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf');
    const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|tiff)$/i.test(filePath);

    let extractedText = '';
    let previewPath: string | null = null;
    let boundingBoxes: any[] = [];

    const fileDir = path.dirname(filePath);
    const fileBase = path.basename(filePath, path.extname(filePath));

    try {
      if (isPdf) {
        // 1. Try pure-JS serverless PDF parsing first (Guaranteed to work on Vercel!)
        try {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          extractedText = pdfData.text || '';
        } catch {
          // Fallback to pdftotext
        }

        // 2. If OS binaries are available (Local development / container), enhance with pdftotext & preview
        try {
          if (!extractedText || extractedText.trim().length === 0) {
            const { stdout: textOut } = await execAsync(`pdftotext -layout "${filePath}" -`, { maxBuffer: 10 * 1024 * 1024 });
            extractedText = textOut || '';
          }

          const previewPrefix = path.join(fileDir, `${fileBase}_preview`);
          await execAsync(`pdftoppm -png -r 150 -f 1 -l 1 "${filePath}" "${previewPrefix}"`).catch(() => null);

          const possiblePreviews = [
            `${previewPrefix}-1.png`,
            `${previewPrefix}-01.png`,
            `${previewPrefix}-001.png`
          ];

          for (const p of possiblePreviews) {
            if (fs.existsSync(p)) {
              previewPath = p;
              break;
            }
          }
        } catch {
          // Binary not present (e.g. running inside Vercel Lambda), continue with in-memory text
        }
      } else if (isImage) {
        previewPath = filePath;
        // On local, try tesseract TSV
        try {
          const tsvOutput = path.join(fileDir, `${fileBase}_ocr`);
          await execAsync(`tesseract "${filePath}" "${tsvOutput}" tsv`).catch(() => null);
          const tsvFile = `${tsvOutput}.tsv`;
          if (fs.existsSync(tsvFile)) {
            const tsvContent = fs.readFileSync(tsvFile, 'utf8');
            const ocrResult = this.parseTesseractTsv(tsvContent);
            extractedText = ocrResult.fullText;
            boundingBoxes = ocrResult.boxes;
          }
        } catch {
          // Tesseract not installed on serverless Lambda
        }
      } else {
        // Text / XML
        extractedText = fs.readFileSync(filePath, 'utf8');
      }
    } catch (error: any) {
      console.error('Error during OCR / PDF processing:', error.message);
    }

    return {
      text: extractedText,
      previewPath,
      boundingBoxes
    };
  }

  static parseTesseractTsv(tsvContent: string) {
    const lines = tsvContent.split('\n');
    const boxes: any[] = [];
    const textTokens: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      if (cols.length >= 12) {
        const conf = parseFloat(cols[10]);
        const text = cols[11]?.trim();
        const left = parseInt(cols[6], 10);
        const top = parseInt(cols[7], 10);
        const width = parseInt(cols[8], 10);
        const height = parseInt(cols[9], 10);

        if (conf > 30 && text) {
          textTokens.push(text);
          boxes.push({
            text,
            confidence: conf,
            x: left,
            y: top,
            width,
            height
          });
        }
      }
    }

    return {
      fullText: textTokens.join(' '),
      boxes
    };
  }
}
