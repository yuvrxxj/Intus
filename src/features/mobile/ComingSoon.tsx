import { ArrowLeft } from 'lucide-react';
import { Brand } from '@/components/brand';
import { AsciiArt } from '@/components/ui/ascii-art';
import { Link } from '../home/Link.tsx';
import { HOME_PATH } from '../home/route.ts';

const PLATFORMS = [
  ['iOS', 'iPhone app'],
  ['Android', 'Phone app'],
] as const;

/** Shown in place of the app on a phone browser, until the iOS and Android apps ship. */
export function ComingSoon() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Brand className="on-dots" />

      <div className="flex flex-1 flex-col justify-center py-10">
        <AsciiArt shape="heart" cols={34} rows={17} label="A heart drawn in characters, turning slowly" className="on-dots text-[9px] text-primary" />

        <div className="on-dots mt-8 font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Coming soon</div>
        <h1 className="on-dots mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.03em] text-ink">
          Coming soon to iOS and Android.
        </h1>
        <p className="on-dots mt-4 text-[15px] leading-relaxed text-ink-2">
          Intus is built for a bigger screen for now. Open it on a laptop or desktop, and the phone apps will follow.
        </p>

        <ul className="mt-8 grid gap-2">
          {PLATFORMS.map(([name, detail]) => (
            <li key={name} className="flex items-center justify-between rounded-[14px] border border-line bg-surface px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-ink">{name}</span>
                <span className="block text-[13px] text-ink-3">{detail}</span>
              </span>
              <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Soon</span>
            </li>
          ))}
        </ul>
      </div>

      <Link to={HOME_PATH} className="on-dots inline-flex items-center gap-2 self-start text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to the homepage
      </Link>
    </main>
  );
}
