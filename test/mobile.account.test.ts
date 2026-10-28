import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIVACY_PATH, TERMS_PATH } from '../src/features/home/route.ts';
import { BUCKET } from '../src/features/photos/model.ts';
import { PERSONAL_TABLES, buildExport, type PersonalTable } from '../src/features/export/model.ts';
import { SUPABASE_URL } from '../mobile/src/env.ts';
import { PHOTOS_BUCKET, REPORTS_BUCKET } from '../mobile/src/account/buckets.ts';
import { PRIVACY_URL, SITE_ORIGIN, TERMS_URL } from '../mobile/src/account/urls.ts';
import { authStorageKeys, keysToClear, pkceVerifierKeys } from '../mobile/src/account/authKeys.ts';
import { clearDevice } from '../mobile/src/account/clearDevice.ts';
import { emptyStorageFolder } from '../mobile/src/account/emptyFolder.ts';
import { exportDocument } from '../mobile/src/account/exportFile.ts';
import { finishDeletion } from '../mobile/src/account/finish.ts';
import { DELETE_ERROR, DOWNLOAD_ERROR, LINK_ERROR, SIGN_OUT_ERROR, isShareDismissal, providerLabel as phoneProviderLabel } from '../mobile/src/account/copy.ts';
import { CONTACT_EMAIL } from '../src/lib/contact.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the phone opens the privacy policy and terms the website already publishes', () => {
  const html = read('../index.html');
  assert.match(html, new RegExp(`content="${SITE_ORIGIN}"`));
  assert.equal(PRIVACY_URL, `${SITE_ORIGIN}${PRIVACY_PATH}`);
  assert.equal(TERMS_URL, `${SITE_ORIGIN}${TERMS_PATH}`);
  assert.equal(PRIVACY_URL, 'https://intus.fit/privacy');
  assert.equal(TERMS_URL, 'https://intus.fit/terms');
});

test('the phone empties the same buckets the website does, then calls the same function', () => {
  assert.equal(PHOTOS_BUCKET, BUCKET);
  assert.match(read('../src/db/labReports.ts'), new RegExp(`export const REPORTS_BUCKET = '${REPORTS_BUCKET}'`));
  const web = read('../src/db/account.ts');
  const phone = read('../mobile/src/account/api.ts');
  assert.match(web, /supabase\.rpc\('delete_my_account'\)/);
  assert.match(phone, /supabase\.rpc\('delete_my_account'\)/);
  assert.match(phone, /scope: 'local'/);
  assert.match(read('../src/db/exportData.ts'), /loadExport\(/);
  assert.match(phone, /loadExport\(/);
  assert.match(read('../src/db/photos.ts'), /You are signed out\. Sign in again to add photos/);
  assert.match(phone, /You are signed out\. Sign in again to add photos/);
  assert.match(read('../src/db/labReports.ts'), /You are signed out\. Sign in again to keep the report/);
  assert.match(phone, /You are signed out\. Sign in again to keep the report/);
});

test('the download file is the shared export, with the shared name', () => {
  const at = new Date('2026-10-28T12:00:00.000Z');
  const tables = {} as Record<PersonalTable, Record<string, unknown>[]>;
  for (const table of PERSONAL_TABLES) tables[table] = [];
  const input = {
    email: 'a@example.test',
    exportedAt: at,
    tables,
    biomarkers: [],
    files: { photos: [], reports: [] },
  };
  const file = exportDocument(input);
  assert.equal(file.name, 'intus-data-2026-10-28.json');
  assert.equal(file.body, JSON.stringify(buildExport(input), null, 2));
});

test('deletion clears the keychain names the Supabase client writes, then async storage and the cache', async () => {
  assert.equal(SUPABASE_URL, 'https://zfyeqfnretrrmtevczrc.supabase.co');
  const base = 'sb-zfyeqfnretrrmtevczrc-auth-token';
  assert.deepEqual(authStorageKeys(SUPABASE_URL), [base, `${base}-user`, `${base}-code-verifier`, `${base}-flows-code-verifier`]);
  assert.deepEqual(pkceVerifierKeys(SUPABASE_URL, JSON.stringify(['abcd1234'])), [`${base}-flow-abcd1234-code-verifier`]);
  assert.deepEqual(pkceVerifierKeys(SUPABASE_URL, 'not json'), []);
  assert.deepEqual(pkceVerifierKeys(SUPABASE_URL, JSON.stringify(['../nope'])), []);

  const store = new Map<string, string>([
    [`${base}-flows-code-verifier`, JSON.stringify(['abcd1234'])],
    [base, 'session'],
    ['intus.lastSync', '{}'],
  ]);
  const deleted: string[] = [];
  let asyncCleared = false;
  let cacheCleared = false;
  await clearDevice({
    secureKeys: keysToClear(SUPABASE_URL, store.get(`${base}-flows-code-verifier`) ?? null, ['intus.lastSync']),
    deleteSecure: async (key) => {
      deleted.push(key);
      if (key === 'intus.lastSync') throw new Error('keychain refused');
      store.delete(key);
    },
    clearAsync: async () => { asyncCleared = true; throw new Error('async storage refused'); },
    clearCache: async () => { cacheCleared = true; },
  });
  assert.equal(store.has(base), false);
  assert.ok(deleted.includes(`${base}-flow-abcd1234-code-verifier`));
  assert.equal(store.has('intus.lastSync'), true, 'a failed delete does not pretend the key is gone, and does not stop the rest');
  assert.equal(asyncCleared, true);
  assert.equal(cacheCleared, true);
});

test('a folder is emptied and proved empty, and a missing reports bucket is not an error', async () => {
  let names = ['a.jpg', 'b.jpg'];
  const removed: string[][] = [];
  await emptyStorageFolder('user-1', {
    list: async () => ({ names: [...names], error: null }),
    remove: async (paths) => {
      removed.push(paths);
      names = [];
      return { error: null };
    },
  });
  assert.deepEqual(removed, [['user-1/a.jpg', 'user-1/b.jpg']]);

  await emptyStorageFolder('user-1', {
    missingBucketIsEmpty: true,
    list: async () => ({ names: [], error: 'Bucket not found' }),
    remove: async () => { throw new Error('should not remove'); },
  });
  await assert.rejects(
    () => emptyStorageFolder('user-1', {
      list: async () => ({ names: [], error: 'Bucket not found' }),
      remove: async () => ({ error: null }),
    }),
    /Bucket not found/,
  );
  await assert.rejects(
    () => emptyStorageFolder('user-1', {
      list: async () => ({ names: ['stuck.jpg'], error: null }),
      remove: async () => ({ error: null }),
    }),
    /could not be removed/,
  );
});

test('deletion follows the website: photos, reports, the account, then the phone, and a failed sign-out still clears the session keys', async () => {
  const order: string[] = [];
  await finishDeletion({
    removePhotos: async () => { order.push('photos'); },
    removeReports: async () => { order.push('reports'); },
    deleteAccount: async () => { order.push('account'); },
    clearDevice: async () => { order.push('device'); },
    signOutLocal: async () => { order.push('sign-out'); throw new Error('already gone'); },
    clearSessionKeys: async () => { order.push('session-keys'); },
  });
  assert.deepEqual(order, ['photos', 'reports', 'account', 'device', 'sign-out', 'session-keys']);

  const stopped: string[] = [];
  await assert.rejects(
    () => finishDeletion({
      removePhotos: async () => { throw new Error('2 of your photos could not be removed'); },
      removeReports: async () => { stopped.push('reports'); },
      deleteAccount: async () => { stopped.push('account'); },
      clearDevice: async () => { stopped.push('device'); },
      signOutLocal: async () => { stopped.push('sign-out'); },
      clearSessionKeys: async () => { stopped.push('session-keys'); },
    }),
    /nothing was deleted/,
  );
  assert.deepEqual(stopped, []);
});

test('account notices are fixed sentences, and a closed share sheet is not one of them', () => {
  assert.equal(SIGN_OUT_ERROR, 'You are still signed in. Try again.');
  assert.equal(DOWNLOAD_ERROR, 'Your data file could not be made. Try again.');
  assert.equal(LINK_ERROR, 'The page could not open.');
  assert.equal(DELETE_ERROR, `Your account was not deleted. Try again, and email ${CONTACT_EMAIL} if it keeps failing. Nothing was deleted.`);
  assert.equal(phoneProviderLabel('apple'), 'Apple');
  assert.equal(phoneProviderLabel('email'), 'email');
  assert.equal(phoneProviderLabel(null), 'email');
  assert.equal(phoneProviderLabel('google'), 'Google');
  assert.equal(isShareDismissal(new Error('The activity was cancelled')), true);
  assert.equal(isShareDismissal(new Error('Sharing is not available on this device')), false);
});
