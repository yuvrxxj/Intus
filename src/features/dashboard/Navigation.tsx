import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Brand } from '@/components/brand';
import { cn } from '@/lib/utils';
import { SECTIONS, type SectionId } from './sections.ts';

/** Desktop: the numbered index down the left. The section in view is red. */
export function SectionRail({ active, onJump, onSignOut, clock }: {
  active: SectionId;
  onJump: (id: SectionId) => void;
  onSignOut: () => void;
  clock: { date: string; time: string };
}) {
  return (
    <aside className="on-dots fixed top-0 left-0 z-20 hidden h-dvh w-[calc(var(--rail-w)-40px)] flex-col justify-between py-8 pl-8 lg:flex">
      <div>
        <Brand />
        <div className="mt-2 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-ink-3 uppercase tabular-nums">
          <div>{clock.date}</div>
          <div>{clock.time}</div>
        </div>
        <nav aria-label="Sections" className="mt-10">
          <ol className="grid gap-0.5">
            {SECTIONS.map((s) => {
              const on = s.id === active;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={(e) => { e.preventDefault(); onJump(s.id); }}
                    aria-current={on ? 'location' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md py-2 pr-2 pl-3 text-sm transition-colors',
                      on ? 'text-ink' : 'text-ink-3 hover:text-ink',
                    )}
                  >
                    {on && <motion.span layoutId="rail-mark" className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <span className={cn('font-mono text-[11px] tabular-nums', on ? 'text-primary' : 'text-ink-3/70')}>{s.n}</span>
                    <span className={cn(on && 'font-medium')}>{s.title}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <div className="grid gap-3">
        <p className="font-mono text-[10px] leading-relaxed tracking-[0.06em] text-ink-3 uppercase">Press 1 to 7 to jump</p>
        <button type="button" onClick={onSignOut} className="flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink">
          <LogOut className="size-3.5" aria-hidden="true" /> Sign out
        </button>
      </div>
    </aside>
  );
}

const TAB_IDS: readonly SectionId[] = ['today', 'progress', 'goals', 'bloodwork'];

/** Phone: a slim top bar, a tab bar with the four most used sections, and an index sheet for everything. */
export function MobileNav({ active, onJump, onSignOut }: {
  active: SectionId;
  onJump: (id: SectionId) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id: SectionId) => {
    setOpen(false);
    onJump(id);
  };

  return (
    <>
      <header className="sticky top-0 z-30 -mx-5 flex items-center justify-between border-b border-line bg-paper/85 px-5 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:-mx-8 sm:px-8 lg:hidden">
        <div className="flex h-14 items-center"><Brand /></div>
        <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
          <span className="text-primary">{current.n}</span> {current.short}
        </span>
      </header>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {TAB_IDS.map((id) => {
            const s = SECTIONS.find((x) => x.id === id)!;
            const on = active === id;
            return (
              <li key={id}>
                <button type="button" onClick={() => go(id)} aria-current={on ? 'location' : undefined}
                  className={cn('flex h-16 w-full flex-col items-center justify-center gap-1', on ? 'text-ink' : 'text-ink-3')}>
                  <span className={cn('font-mono text-[11px] tabular-nums', on ? 'text-primary' : '')}>{s.n}</span>
                  <span className="text-[11px] font-medium">{s.short}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog"
              className={cn('flex h-16 w-full flex-col items-center justify-center gap-1', TAB_IDS.includes(active) ? 'text-ink-3' : 'text-ink')}>
              <Menu className="size-4" aria-hidden="true" />
              <span className="text-[11px] font-medium">Index</span>
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close the index" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="All sections"
              className="absolute inset-x-0 bottom-0 rounded-t-[20px] border-t border-line bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            >
              <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-ink/15" aria-hidden="true" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Index</span>
                <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:text-ink" aria-label="Close">
                  <X className="size-4" />
                </button>
              </div>
              <ol className="mt-2 divide-y divide-line">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => go(s.id)} className="flex w-full items-center gap-4 py-3.5 text-left">
                      <span className={cn('font-mono text-xs tabular-nums', s.id === active ? 'text-primary' : 'text-ink-3')}>{s.n}</span>
                      <span className={cn('text-[15px]', s.id === active ? 'font-medium text-ink' : 'text-ink-2')}>{s.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={onSignOut} className="mt-4 flex items-center gap-2 text-sm text-ink-3">
                <LogOut className="size-4" aria-hidden="true" /> Sign out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
