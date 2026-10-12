import { CONTACT_EMAIL } from '../../lib/contact.ts';
import { Link } from '../home/Link.tsx';
import { HOME_PATH, PRIVACY_PATH, TERMS_PATH } from '../home/route.ts';
import { LEGAL_UPDATED, PRIVACY, TERMS, type LegalSection } from './content.ts';

/** The privacy policy or the terms, as a plain readable page. Public, on every device, signed in or not. */
export function Legal({ page }: { page: 'privacy' | 'terms' }) {
  const sections: LegalSection[] = page === 'privacy' ? PRIVACY : TERMS;
  return (
    <div className="relative z-10 min-h-dvh bg-paper text-ink">
      <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:py-16">
        <Link to={HOME_PATH} className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Intus</Link>
        <h1 className="mt-4 text-[34px] leading-tight font-semibold tracking-[-0.02em]">{page === 'privacy' ? 'Privacy policy' : 'Terms of use'}</h1>
        <p className="mt-2 font-mono text-xs text-ink-3">Updated {LEGAL_UPDATED}</p>
        {sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            {s.paragraphs.map((p, i) => <p key={i} className="mt-2 text-[15px] leading-relaxed text-ink-2">{p}</p>)}
            {s.items && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
                {s.items.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
        <p className="mt-10 text-sm text-ink-3">
          Contact: <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          {' · '}
          {page === 'privacy' ? <Link to={TERMS_PATH} className="text-primary underline">Terms of use</Link> : <Link to={PRIVACY_PATH} className="text-primary underline">Privacy policy</Link>}
        </p>
      </main>
    </div>
  );
}
