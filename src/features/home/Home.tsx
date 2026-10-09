import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Brand } from '@/components/brand';
import statueBust from '@/assets/art/statue-bust.webp';
import { AsciiArt } from '@/components/ui/ascii-art';
import { buttonClass } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { CONTACT_EMAIL } from '../../lib/contact.ts';
import { KnowledgeBase } from './KnowledgeBase.tsx';
import { Link } from './Link.tsx';
import { HOME_PATH, SIGN_IN_PATH, SIGN_UP_URL } from './route.ts';

const NAV = [
  ['about', 'About'],
  ['why', 'Why this'],
  ['pricing', 'Pricing'],
  ['knowledge', 'Knowledge base'],
] as const;

const ABOUT = [
  ['Daily log', 'Weigh in, log calories, steps and the habits you set, in under a minute. Your latest 30 entries are charted, and every day you logged is kept in History.'],
  ['Bloodwork', 'Type in results from your lab report. Each one is flagged against its reference range, critical limits are called out, and an arrow compares it with your previous result.'],
  ['Supplements', 'Record what you take, with start and end dates. Intus sets the days before against the days after, using only days you logged, and says nothing until there is enough to compare.'],
  ['Screening', 'A calendar of the checks that are due for your age and sex, and when you last had each one.'],
] as const;

const WHY = [
  ['01', 'No score you cannot check', 'There is no mystery number. When Intus flags something, the rule is short enough to say out loud: a result is critical when it reaches a stored limit, and a trend needs five results.'],
  ['02', 'Only you can see it', 'Every row in the database answers to your login and nobody else. A second account sees none of your data.'],
  ['03', 'Ranges come first', 'A lab result is set against the stored reference range for that marker, so what is out of range stands out.'],
  ['04', 'Honest about what it cannot show', 'The supplement comparison looks at two periods side by side. It cannot show that a supplement works, and it never colours a change good or bad.'],
] as const;

/** The pricing copy lives here so it is easy to replace once the pricing decision is made. */
const PRICING = {
  headline: 'Free during early access.',
  points: [
    'Everything in the app today: the daily log, goals and habits, bloodwork, supplements, screening and history.',
    'No card needed. Make an account and start.',
    'Paid plans arrive with the phone apps. The price will be published before anything is charged.',
  ],
} as const;

function Section({ id, n, title, intro, children }: { id: string; n: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line-strong py-14 sm:py-16">
      <Reveal>
        <div className="on-dots flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">{n}</span>
          <h2 id={`${id}-title`} className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[34px]">{title}</h2>
        </div>
        {intro && <p className="on-dots mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{intro}</p>}
      </Reveal>
      <Reveal delay={0.05} className="mt-8">{children}</Reveal>
    </section>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line-strong bg-paper">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 lg:px-10">
        <Link to={HOME_PATH} aria-label="Intus, back to the top"><Brand /></Link>
        <nav aria-label="Sections" className="hidden items-center gap-6 md:flex">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="text-sm font-medium text-ink-2 hover:text-ink">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to={SIGN_IN_PATH} className={buttonClass({ variant: 'ghost', size: 'sm' })}>Sign in</Link>
          <Link to={SIGN_UP_URL} className={buttonClass({ variant: 'primary', size: 'sm' })}>Create account</Link>
        </div>
      </div>
    </header>
  );
}

/** The public homepage, shown before login on every device. The app itself is for bigger screens until the phone apps ship. */
export function Home() {
  return (
    <div className="relative z-10 min-h-dvh">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-5 lg:px-10">
        <section aria-labelledby="home-title" className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-20">
          <div className="on-dots order-2 lg:order-1">
            <div className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Early access</div>
            <h1 id="home-title" className="mt-4 max-w-2xl text-[44px] leading-[1.03] font-semibold tracking-[-0.035em] text-ink sm:text-[64px]">
              Your health, in plain numbers.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
              Weight, food, habits, supplements and bloodwork in one place. Every lab result is set against its reference range, and nothing is scored behind your back.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={SIGN_UP_URL} className={buttonClass({ variant: 'primary', size: 'lg' })}>
                Create account <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link to={SIGN_IN_PATH} className={buttonClass({ variant: 'secondary', size: 'lg' })}>Sign in</Link>
            </div>
            <p className="mt-5 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">
              Free in early access. Laptop, desktop and tablet today. Phone apps are coming.
            </p>
          </div>
          <div className="order-1 flex justify-start lg:order-2 lg:justify-center">
            <img
              src={statueBust}
              alt=""
              width={1031}
              height={1349}
              decoding="async"
              className="h-[clamp(200px,40vh,520px)] w-auto animate-[rail-art-in_1.2s_var(--ease-out-quint)_both]"
            />
          </div>
        </section>

        <Section
          id="about"
          n="01"
          title="About"
          intro="Intus keeps the numbers that describe your health in one place and shows them against something you can check. It runs in the browser today, on laptops, desktops and tablets."
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {ABOUT.map(([title, body]) => (
              <li key={title} className="rounded-[14px] border border-line bg-surface p-5 sm:p-6">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="why" n="02" title="Why this" intro="Health apps tend to hand you a score and ask you to trust it. Intus does the opposite: it shows the number, the range and the rule.">
          <ul className="grid gap-x-12 gap-y-7 sm:grid-cols-2">
            {WHY.map(([n, title, body]) => (
              <li key={n} className="on-dots grid grid-cols-[36px_1fr] gap-2">
                <span className="font-mono text-xs text-primary">{n}</span>
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-2">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="pricing" n="03" title="Pricing">
          <div className="grid gap-6 rounded-[14px] border border-line-strong bg-surface p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
            <div>
              <h3 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">{PRICING.headline}</h3>
              <Link to={SIGN_UP_URL} className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-6' })}>
                Create account <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid gap-3">
              {PRICING.points.map((point) => (
                <li key={point} className="grid grid-cols-[18px_1fr] gap-2 text-sm leading-relaxed text-ink-2">
                  <span className="mt-[7px] size-2 rounded-[2px] bg-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section
          id="knowledge"
          n="04"
          title="Knowledge base"
          intro="Supplements can move a blood test without changing your health. Each entry says which results can shift, in which direction and why, so a number does not surprise you."
        >
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_220px] lg:gap-12">
            <KnowledgeBase />
            <div className="sticky top-24 hidden justify-self-end lg:block">
              <AsciiArt shape="capsule" cols={34} rows={34} label="A capsule drawn in characters, turning slowly" className="on-dots text-[9px] text-primary" />
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t border-line-strong bg-paper">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-7 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase lg:px-10">
          <span>Intus</span>
          <span>Not medical advice. Ranges are flagged, never diagnosed.</span>
          <span className="flex flex-wrap gap-x-4 gap-y-2">
            <a href={`mailto:${CONTACT_EMAIL}`} className="normal-case hover:text-ink">{CONTACT_EMAIL}</a>
            <a href="https://x.com/getintus" rel="noopener noreferrer" className="hover:text-ink">@getintus on X</a>
            <a href="https://www.instagram.com/getintus" rel="noopener noreferrer" className="hover:text-ink">Instagram</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
