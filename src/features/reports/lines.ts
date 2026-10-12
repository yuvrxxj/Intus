// Text pieces from a PDF page to lines, the way a person reads them. Pure, so it can be tested without a PDF.

export interface TextPiece {
  str: string;
  /** left edge and baseline, in PDF units (y grows upwards) */
  x: number;
  y: number;
  width: number;
  /** roughly the font size */
  height: number;
}

/**
 * Pieces whose baselines are within a third of the font size are one line; lines run top to bottom, pieces left to
 * right. A gap wider than about a character becomes a run of spaces, so columns stay apart ("Hb   13.2   g/dL").
 */
export function linesFromPieces(pieces: readonly TextPiece[]): string[] {
  const rows: { y: number; size: number; pieces: TextPiece[] }[] = [];
  for (const p of pieces) {
    if (p.str.trim() === '') continue;
    const size = Math.max(p.height, 1);
    const row = rows.find((r) => Math.abs(r.y - p.y) <= Math.max(r.size, size) / 3);
    if (row) row.pieces.push(p);
    else rows.push({ y: p.y, size, pieces: [p] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row) => {
    const sorted = [...row.pieces].sort((a, b) => a.x - b.x);
    let line = '';
    let end = -Infinity;
    for (const p of sorted) {
      const gap = p.x - end;
      if (line !== '') line += gap > row.size * 0.9 ? '   ' : gap > row.size * 0.15 ? ' ' : '';
      line += p.str;
      end = p.x + p.width;
    }
    return line.trim();
  });
}
