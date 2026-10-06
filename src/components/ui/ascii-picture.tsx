import { memo, useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// one character cell in viewBox units: JetBrains Mono is 0.6em wide, drawn at 10 units with a line of 10
const CW = 6;
const LH = 10;

/** Turns rows of "start.length" runs into one path, each run a thin rectangle. */
function solidPath(rows: readonly string[], sub: number): string {
  const sw = CW / sub;
  const sh = LH / sub;
  let d = '';
  rows.forEach((row, r) => {
    if (!row) return;
    for (const run of row.split(' ')) {
      const [start, length] = run.split('.').map(Number);
      // a hair taller than the sub-row, so neighbouring rows meet without a seam
      d += `M${(start * sw).toFixed(2)} ${(r * sh).toFixed(2)}h${(length * sw).toFixed(2)}v${(sh + 0.35).toFixed(2)}h${(-length * sw).toFixed(2)}z`;
    }
  });
  return d;
}

/**
 * A still picture made of characters plus a traced solid layer, drawn as SVG so it stays sharp at any size.
 * It fills its box and keeps its proportions, anchored as `align` says.
 */
export const AsciiPicture = memo(function AsciiPicture({ text, solid, cols, rows, sub, align = 'xMinYMax', className, style }: {
  text: readonly string[];
  solid: readonly string[];
  cols: number;
  rows: number;
  sub: number;
  align?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const d = useMemo(() => solidPath(solid, sub), [solid, sub]);
  return (
    <svg
      viewBox={`0 0 ${cols * CW} ${rows * LH}`}
      preserveAspectRatio={`${align} meet`}
      className={cn('fill-primary [text-shadow:none]', className)}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
      <g className="font-mono" fontSize={LH} style={{ whiteSpace: 'pre', fontVariantLigatures: 'none' }}>
        {text.map((line, i) => (line ? <text key={i} x={0} y={i * LH + LH * 0.8} xmlSpace="preserve">{line}</text> : null))}
      </g>
    </svg>
  );
});
