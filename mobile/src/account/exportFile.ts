import { buildExport, exportFileName, type ExportInput } from '../../../src/features/export/model.ts';

/** The file the website saves: the shared document, pretty-printed, with the shared name. */
export function exportDocument(input: ExportInput): { name: string; body: string } {
  return {
    name: exportFileName(input.exportedAt),
    body: JSON.stringify(buildExport(input), null, 2),
  };
}
