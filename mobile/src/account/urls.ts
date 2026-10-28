import { PRIVACY_PATH, TERMS_PATH } from '../../../src/features/home/route.ts';

/** The live site, the same origin the web app publishes (index.html, og:url). */
export const SITE_ORIGIN = 'https://intus.fit';

/** The privacy policy and terms pages the website already serves. */
export const PRIVACY_URL = `${SITE_ORIGIN}${PRIVACY_PATH}`;
export const TERMS_URL = `${SITE_ORIGIN}${TERMS_PATH}`;
