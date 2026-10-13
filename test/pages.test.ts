import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAGE, NAV_PAGES, PAGES, pageFromHash, pageMeta } from '../src/features/dashboard/pages.ts';

test('the top bar lists the dashboard first, then Today, Goals, Bloodwork, Supplements and Progress', () => {
  assert.deepEqual(NAV_PAGES.map((p) => p.short), ['Dashboard', 'Today', 'Goals', 'Bloodwork', 'Supplements', 'Progress']);
  assert.equal(DEFAULT_PAGE, 'dashboard');
});

test('there is no Screening or History page any more', () => {
  const ids = PAGES.map((p) => p.id as string);
  assert.ok(!ids.includes('screening') && !ids.includes('history') && !ids.includes('sleep'));
});

test('an address opens its page, with or without a slash after the #', () => {
  assert.equal(pageFromHash('#bloodwork'), 'bloodwork');
  assert.equal(pageFromHash('#/progress'), 'progress');
  assert.equal(pageFromHash(''), null);
  assert.equal(pageFromHash('#whatever'), null);
});

test('addresses from before the split land on the page that holds the section now', () => {
  assert.equal(pageFromHash('#sleep'), 'today');
  assert.equal(pageFromHash('#history'), 'progress');
  assert.equal(pageFromHash('#screening'), 'dashboard');
  assert.equal(pageFromHash('#overview'), 'dashboard');
});

test('every page has a title, a line on what it is for, and an artwork', () => {
  for (const p of PAGES) {
    assert.ok(p.title.length > 0 && p.blurb.length > 0 && p.art, p.id);
    assert.equal(pageMeta(p.id), p);
  }
});
