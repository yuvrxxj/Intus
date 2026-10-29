import { ArrowRight } from 'lucide-react';
import { buttonClass } from '@/components/ui/button';
import { CONTACT_EMAIL } from '../../lib/contact.ts';
import { WEB_AUTH_ENABLED } from '../auth/webAuthFlag.ts';
import { Link } from './Link.tsx';
import { PRICING_PAGE } from './pricing.ts';
import { HOME_PATH, PRIVACY_PATH, SIGN_UP_URL, TERMS_PATH } from './route.ts';
import { WAITLIST } from './waitlist.ts';

/** The pricing page: a plain readable page, public on every device, signed in or not. The words are in pricing.ts. */
export function Pricing() {
  return (
    <div className="relative z-10 min-h-dvh bg-paper text-ink">
      <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:py-16">
        <Link to={HOME_PATH} className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Intus</Link>
        <h1 className="mt-4 text-[34px] leading-tight font-semibold tracking-[-0.02em]">{PRICING_PAGE.title}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{PRICING_PAGE.lead}</p>
        {WEB_AUTH_ENABLED ? (
          <Link to={SIGN_UP_URL} className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-6' })}>
            Create account <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <a href="/#waitlist" className={buttonClass({ variant: 'primary', size: 'lg', className: 'mt-6' })}>
            {WAITLIST.button} <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        )}
        {PRICING_PAGE.sections.map((s) => (
          <section key={s.heading} className="mt-10">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.paragraphs.map((p, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-2">{p}</p>)}
            {s.items && (
              <ul className="mt-3 grid gap-2.5">
                {s.items.map((item) => (
                  <li key={item} className="grid grid-cols-[18px_1fr] gap-2 text-[15px] leading-relaxed text-ink-2">
                    <span className="mt-[9px] size-2 rounded-[2px] bg-primary" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section className="mt-10" aria-labelledby="pricing-questions">
          <h2 id="pricing-questions" className="text-lg font-semibold">Questions</h2>
          <dl className="mt-3 grid gap-4">
            {PRICING_PAGE.questions.map(([q, a]) => (
              <div key={q}>
                <dt className="text-[15px] font-semibold">{q}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="mt-10 text-sm text-ink-3">
          Contact: <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          {' · '}
          <Link to={PRIVACY_PATH} className="text-primary underline">Privacy policy</Link>
          {' · '}
          <Link to={TERMS_PATH} className="text-primary underline">Terms of use</Link>
        </p>
      </main>
    </div>
  );
}
