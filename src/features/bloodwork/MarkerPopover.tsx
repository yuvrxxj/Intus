import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { rangeSourceLabel, type ChosenRange } from '../../lib/ranges.ts';
import { formatRange } from './format.ts';
import { MARKER_INFO, MEDLINEPLUS_REVIEW_NOTE, medlinePlusUrl } from './markerInfo.ts';

/**
 * A small "i" beside a marker's name. It opens on hover (desktop), on tap (phone) and on focus or Enter (keyboard), and
 * closes on Escape or when the pointer or focus leaves. The range it shows is the one the latest result was read against.
 */
export function MarkerPopover({ code, name, unit, range }: { code: string; name: string; unit: string; range: ChosenRange }) {
  const info = MARKER_INFO[code];
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // fixed to the window, so the table's sideways scroll cannot clip it
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = button.current?.getBoundingClientRect();
    if (r) setPlace({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 356)) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    // the card is fixed to the window, so it closes rather than drift when the page scrolls
    const onScroll = () => {
      setOpen(false);
      setPinned(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (!info) return null;

  return (
    <span
      ref={wrap}
      className="mp"
      onMouseEnter={show}
      onMouseLeave={() => !pinned && setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setPinned(false);
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="mp-btn"
        aria-label={`About ${name}`}
        aria-expanded={open}
        aria-controls={id}
        onFocus={show}
        onClick={() => {
          setPinned((p) => !p);
          show();
        }}
      >
        <Info className="size-3" aria-hidden="true" />
      </button>
      {open && (
        <span className="mp-card" id={id} role="dialog" aria-label={`About ${name}`} style={place ?? undefined}>
          <span className="mp-title">{name}</span>
          <span className="mp-p">{info.what}</span>
          <span className="mp-h">When it is high</span>
          <span className="mp-p">{info.high}</span>
          {info.low && (
            <>
              <span className="mp-h">When it is low</span>
              <span className="mp-p">{info.low}</span>
            </>
          )}
          <span className="mp-h">What helps</span>
          <span className="mp-p">{info.habits}</span>
          <span className="mp-range">
            Your range: {range.source === 'none' ? rangeSourceLabel(range) : `${formatRange(range.low, range.high)} ${unit}, ${rangeSourceLabel(range)}`}
          </span>
          <span className="mp-src">
            {MEDLINEPLUS_REVIEW_NOTE}{' '}
            <a href={medlinePlusUrl(info.loinc)} target="_blank" rel="noopener noreferrer">MedlinePlus: {name}</a>
          </span>
        </span>
      )}
    </span>
  );
}
