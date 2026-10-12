import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_GOVERNING_LAW, LEGAL_OPERATOR, LEGAL_UPDATED, PRIVACY, TERMS, type LegalSection } from '../src/features/legal/content.ts';

const text = (sections: readonly LegalSection[]) => sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.items ?? [])]).join('\n');

test('every section has a heading and something to say, and no heading repeats', () => {
  for (const sections of [PRIVACY, TERMS]) {
    for (const s of sections) {
      assert.ok(s.heading.trim() !== '' && s.paragraphs.length > 0 && s.paragraphs.every((p) => p.trim() !== ''), s.heading);
      assert.ok((s.items ?? []).every((i) => i.trim() !== ''), s.heading);
    }
    assert.equal(new Set(sections.map((s) => s.heading)).size, sections.length);
  }
});

test('the wording rule: no em or en dashes, and no placeholders left in', () => {
  for (const t of [text(PRIVACY), text(TERMS)]) {
    assert.doesNotMatch(t, /[–—]/);
    assert.doesNotMatch(t, /\[[^\]]*\]|TODO|lorem|xxx/i);
  }
});

test('the policy names who runs Intus, every service that holds data, and the rights it promises', () => {
  const privacy = text(PRIVACY);
  assert.ok(LEGAL_OPERATOR.trim() !== '' && privacy.includes(LEGAL_OPERATOR));
  for (const service of ['Supabase', 'Vercel', 'Google', 'Singapore']) assert.ok(privacy.includes(service), service);
  for (const law of ['Digital Personal Data Protection', 'GDPR', 'Privacy Act']) assert.ok(privacy.includes(law), law);
  for (const promise of ['explicit consent', 'Download my data', 'Delete account', 'grievance', 'aged 18']) assert.ok(privacy.includes(promise), promise);
  // what the app does today: no AI service gets anyone's data, so the policy must say that and not promise otherwise
  assert.match(privacy, /does not send your information to an AI service today/);
});

test('the terms say what Intus is not, who can use it, and what law applies', () => {
  const terms = text(TERMS);
  for (const part of ['not a medical device', 'Not medical advice', '18 or over', 'as is', 'US$100', `laws of ${LEGAL_GOVERNING_LAW}`]) assert.ok(terms.includes(part), part);
  assert.match(LEGAL_UPDATED, /^\d{1,2} [A-Z][a-z]+ \d{4}$/);
});
