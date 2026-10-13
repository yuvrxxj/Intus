import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { Brand } from '@/components/brand';
import { cn } from '@/lib/utils';
import { NAV_PAGES, type PageId } from './pages.ts';

/**
 * The bar across the top of every page: the mark, the pages in order, then Account and Sign out. It stays in view and
 * sits behind frosted glass, so the page scrolls under it and stays faintly visible through it. The page in view is red.
 * On a narrow screen the pages become a row of their own that scrolls sideways.
 */
export function TopNav({ page, onGo, onSignOut, clock }: {
  page: PageId;
  onGo: (id: PageId) => void;
  onSignOut: () => void;
  clock: { date: string; time: string };
}) {
  const link = (id: PageId, label: string, n?: string) => {
    const on = id === page;
    return (
      <a
        key={id}
        href={`#${id}`}
        onClick={(e) => { e.preventDefault(); onGo(id); }}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          on ? 'text-ink' : 'text-ink-3 hover:text-ink',
        )}
      >
        {n && <span className={cn('font-mono text-[11px] tabular-nums', on ? 'text-primary' : 'text-ink-3/70')}>{n}</span>}
        <span className={cn(on && 'font-medium')}>{label}</span>
        {on && <motion.span layoutId="topnav-mark" className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      </a>
    );
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 -mx-5 border-b border-line-strong/70 px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10 2xl:-mx-16 2xl:px-16',
        // frosted glass: a pale veil, a blur of whatever scrolls beneath, a lit top edge and a soft shadow under it
        'bg-paper/60 backdrop-blur-xl backdrop-saturate-150',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_10px_28px_-14px_rgb(31_19_0/0.22)]',
        'pt-[env(safe-area-inset-top)]',
      )}
    >
      <div className="mx-auto flex max-w-[1640px] items-center justify-between gap-4">
        <div className="flex h-14 items-center gap-8">
          <a href="#dashboard" onClick={(e) => { e.preventDefault(); onGo('dashboard'); }} aria-label="Intus, back to the dashboard"><Brand /></a>
          <nav aria-label="Pages" className="hidden items-center gap-0.5 md:flex">
            {NAV_PAGES.map((p) => link(p.id, p.short, p.n))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-3 hidden font-mono text-[11px] leading-tight tracking-[0.06em] text-ink-3 uppercase tabular-nums xl:block">
            {clock.date}<br />{clock.time}
          </span>
          {link('account', 'Account')}
          <button type="button" onClick={onSignOut} className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-3 transition-colors hover:text-ink">
            <LogOut className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
      <nav aria-label="Pages" className="-mx-5 flex overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 md:hidden [&::-webkit-scrollbar]:hidden">
        {NAV_PAGES.map((p) => link(p.id, p.short, p.n))}
      </nav>
    </header>
  );
}

