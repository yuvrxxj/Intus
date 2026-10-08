import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileLine, titleFor } from '../src/features/profile/profileLine.ts';
import { programmeFromProfile } from '../src/lib/programme.ts';

const cut = programmeFromProfile({ start_weight: 82, goal_weight: 75, start_date: '2026-04-05', goal_date: '2026-07-14' });
const gain = programmeFromProfile({ start_weight: 70, goal_weight: 76, start_date: '2026-10-01', goal_date: '2026-12-24' });

test('the line reads the way the header always did when everything is known', () => {
  assert.equal(profileLine({ age: 26, sex: 'M', height_cm: 179, blood_type: 'B+' }, cut), '26M · 179cm · B+ · Cut: 82→75kg');
  assert.equal(profileLine({ age: 31, sex: 'female', height_cm: '165.5' as unknown as number, blood_type: null }, gain), '31F · 165.5cm · Gain: 70→76kg');
});

test('whatever is not known is left out, and a person with nothing gets a prompt', () => {
  assert.equal(profileLine({ age: null, sex: null, height_cm: null, blood_type: null }, cut), 'Cut: 82→75kg');
  assert.equal(profileLine({ age: 40, sex: null, height_cm: null, blood_type: null }, null), '40');
  assert.equal(profileLine(null, null), 'Add your details and goal to get started');
  assert.equal(profileLine({ age: null, sex: 'unsure', height_cm: 0, blood_type: '' }, null), 'Add your details and goal to get started');
});

test('the title uses the person\'s own name, never someone else\'s', () => {
  assert.equal(titleFor({ name: 'Yuvraaj' }), "Yuvraaj's Intus");
  assert.equal(titleFor({ name: 'James' }), "James' Intus");
  assert.equal(titleFor({ name: '  Ana ' }), "Ana's Intus");
  assert.equal(titleFor({ name: null }), 'Intus');
  assert.equal(titleFor({ name: '   ' }), 'Intus');
  assert.equal(titleFor(null), 'Intus');
});
