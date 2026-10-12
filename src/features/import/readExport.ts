// Streams Apple's export (the zip, or export.xml on its own) through the scanner without holding it all in memory.
import { ExportScanner, type ScanResult } from './appleHealth.ts';

export async function scanExportFile(file: File, since: Date, onProgress: (message: string) => void): Promise<ScanResult> {
  const scanner = new ExportScanner(since);
  const total = file.size;
  let read = 0;
  const report = () => onProgress(`Reading ${Math.min(100, Math.round((read / Math.max(total, 1)) * 100))}%`);

  if (file.name.toLowerCase().endsWith('.xml')) {
    const decoder = new TextDecoder();
    const reader = file.stream().getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      read += value.byteLength;
      scanner.feed(decoder.decode(value, { stream: true }));
      report();
    }
    scanner.feed(decoder.decode());
    return scanner.end();
  }

  const { Unzip, UnzipInflate } = await import('fflate');
  let found = false;
  let finished!: () => void;
  let failed!: (e: unknown) => void;
  const done = new Promise<void>((resolve, reject) => { finished = resolve; failed = reject; });
  const unzip = new Unzip((entry) => {
    // the main file; export_cda.xml and the workout routes are not needed
    if (!/(^|\/)export\.xml$/.test(entry.name)) return;
    found = true;
    const decoder = new TextDecoder();
    entry.ondata = (err, chunk, final) => {
      if (err) return failed(err);
      scanner.feed(decoder.decode(chunk, { stream: !final }));
      if (final) finished();
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  const reader = file.stream().getReader();
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    read += value.byteLength;
    unzip.push(value);
    report();
  }
  if (!found) throw new Error('No export.xml in that zip. Use the file the Health app makes with Export All Health Data.');
  await done;
  return scanner.end();
}
