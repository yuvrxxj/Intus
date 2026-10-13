import { AsciiArt } from '@/components/ui/ascii-art';
import { AsciiScene, type SceneId } from '@/components/ui/ascii-scene';
import { Reveal } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';
import { NAV_PAGES, PAGE_ART_COLS, PAGE_ART_ROWS, type PageMeta } from './pages.ts';

/** How wide each engraved picture is drawn. They differ in proportion, so each gets the width that makes it about as tall as the others. */
const SCENE_WIDTH: Record<SceneId, string> = {
  hourglass: 'w-[175px] xl:w-[215px]',
  archery: 'w-[230px] xl:w-[280px]',
  bloodwork: 'w-[270px] xl:w-[330px]',
  supplements: 'w-[315px] xl:w-[385px]',
  sisyphus: 'w-[325px] xl:w-[395px]',
};

/** The top of a page: its number, its title, one line on what it is for, and its own artwork on the right. */
export function PageHeader({ meta }: { meta: PageMeta }) {
  const numbered = NAV_PAGES.some((p) => p.id === meta.id);
  const art = meta.art;
  return (
    <Reveal>
      <div className="on-dots flex items-end justify-between gap-6 pt-8 pb-10 lg:pt-12">
        <div className="min-w-0">
          {numbered && (
            <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
              <span className="text-primary">{meta.n}</span> / {String(NAV_PAGES.length).padStart(2, '0')}
            </div>
          )}
          <h1 id={`${meta.id}-title`} className={cn('text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[44px]', numbered && 'mt-3')}>{meta.title}</h1>
          <p className="mt-3 max-w-xl text-sm text-ink-2">{meta.blurb}</p>
        </div>
        {'scene' in art ? (
          <AsciiScene id={art.scene} className={cn('hidden shrink-0 md:-my-8 md:block', SCENE_WIDTH[art.scene])} />
        ) : (
          <AsciiArt shape={art.shape} cols={PAGE_ART_COLS} rows={PAGE_ART_ROWS} className="on-dots hidden shrink-0 text-[10px] text-primary md:-my-8 md:block xl:text-[12px]" />
        )}
      </div>
    </Reveal>
  );
}
