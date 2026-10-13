#!/usr/bin/env node
// Turns a lab report PDF into the text that would be sent for AI reading: read the way the app reads it, with the name,
// ID numbers and contact details taken out. For trying models with scripts/ai-eval.ts, without the app.
//
//   node scripts/report-text.ts report.pdf --name FirstName > report.txt
//
// Nothing is sent anywhere. Keep real reports and their text out of this repository.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { linesFromPieces, type TextPiece } from '../src/features/reports/lines.ts';
import { findDate } from '../src/features/reports/parse.ts';
import { redactReport } from '../src/features/reports/redact.ts';

export async function pdfLines(path: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true });
  const doc = await task.promise;
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const pieces: TextPiece[] = [];
    for (const item of content.items) {
      if ('str' in item) pieces.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height || Math.abs(item.transform[3]) });
    }
    lines.push(...linesFromPieces(pieces));
  }
  await task.destroy();
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--name');
  const names = args.flatMap((a, i) => (args[i - 1] === '--name' ? [a] : []));
  if (!file) {
    console.error('usage: node scripts/report-text.ts report.pdf [--name FirstName] > report.txt');
    process.exit(2);
  }
  const lines = await pdfLines(file);
  const { date } = findDate(lines);
  const redacted = redactReport(lines, { names, sampleDate: date });
  process.stdout.write(redacted.lines.join('\n') + '\n');
  console.error(`${lines.length} lines read, ${redacted.lines.length} kept, ${redacted.removedLines} identity lines removed, ${redacted.masked} pieces masked, about ${Math.round(redacted.lines.join('\n').length / 3.5)} tokens. Check the text for anything that still identifies you before using it.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
