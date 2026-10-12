// The privacy policy and terms, as plain data. Written to match what the app actually does on the date below. They
// are drafts: someone qualified should review them before Intus opens to the public (INT-66).

export const LEGAL_UPDATED = '12 October 2026';
export const LEGAL_DRAFT_NOTE = 'Draft for review. This text describes how Intus works today and will be reviewed by a qualified person before Intus opens to the public.';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export const PRIVACY: LegalSection[] = [
  {
    heading: 'In short',
    paragraphs: [
      'Intus keeps your health log for you and only you. We do not sell your data, show you ads, or share it with anyone for their own use. You can download everything or delete your account at any time from the Account section.',
    ],
  },
  {
    heading: 'What we store',
    paragraphs: [
      'Your account: your email address, and your password in hashed form (we never see it). If you sign in with Google, we receive your email address and name from Google.',
      'What you enter: your profile (name, sex, age, height, goals), daily logs, habits, bloodwork results and the ranges printed on your reports, supplements, sleep, heart readings, screening history, and photo check-ins.',
      'Files you choose to keep: progress photos, and copies of lab report PDFs if you tick "Keep a private copy" when uploading one.',
      'Heart readings and sleep from Apple Health, only if you install the Intus iPhone app and allow it. The app reads only sleep, heart rate variability and resting heart rate, and never writes to Apple Health.',
    ],
  },
  {
    heading: 'What happens on your device',
    paragraphs: [
      'When you upload a lab report, it is read on your device, including scanned pages. Nothing is sent anywhere until you check the results and press save, and then only the results you ticked (and the PDF, if you chose to keep it).',
      'Photos are resized on your device and their location and camera details are removed before they are uploaded.',
    ],
  },
  {
    heading: 'Who can see it',
    paragraphs: [
      'Only you. Every row and file is tied to your account, and the database refuses requests for anyone else\'s, even from someone who has the app\'s public key.',
      'The people who run Intus have administrative access to the systems that host it, as with any online service. They do not look at personal data except to fix a problem you ask for help with, or where the law requires it.',
    ],
  },
  {
    heading: 'Who else is involved',
    paragraphs: [
      'Supabase stores the database and files and handles sign-in. The data is held in their Singapore region.',
      'Vercel serves the website.',
      'Google, only if you choose to sign in with Google.',
      'An email provider sends sign-up confirmation and password reset emails.',
      'Intus does not use an AI service on your data today. If it ever does, it will ask you first, separately, before any of your data is sent to one.',
      'The site uses no advertising or tracking cookies and no analytics service. It keeps your sign-in session, and a few settings, in your browser.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: [
      'Download: Account, Download my data, gives you everything you have stored as one file.',
      'Delete: Account, Delete account, removes your sign-in, every row and every file straight away. It cannot be undone.',
      'Correct: you can edit or delete what you entered at any time.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: ['Questions about your data: write to the address in the footer.'],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: 'What Intus is',
    paragraphs: [
      'Intus is a personal tracker. It records what you enter or import, shows it back to you, and flags results against the ranges printed on your reports or the usual ranges. It does not diagnose, treat or prevent any condition, it does not recommend medicines or doses, and it is not a medical device.',
      'Talk to a doctor about your results, especially anything outside its range. Never delay or ignore medical advice because of something you saw in Intus. In an emergency, call your local emergency number.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'You need to be 18 or over to use Intus. Keep your password to yourself; you are responsible for what happens under your account.',
      'What you enter is yours. You give Intus permission to store and process it only to provide the service to you.',
    ],
  },
  {
    heading: 'Accuracy',
    paragraphs: [
      'Results read from an uploaded report can be wrong: check every row before saving. Ranges, flags and the notes beside each marker are general information and may not fit your situation.',
    ],
  },
  {
    heading: 'Using Intus fairly',
    paragraphs: [
      'Do not try to reach other people\'s data, overload the service, or use it for anything unlawful.',
    ],
  },
  {
    heading: 'Changes and ending',
    paragraphs: [
      'Intus may change as it grows. If these terms change in a way that matters, you will be told in the app before the change applies. You can stop at any time by deleting your account; Intus may close an account that breaks these terms.',
      'Intus is provided as it is, and is still being built. To the extent the law allows, Intus is not liable for decisions made on the basis of what it shows.',
    ],
  },
];
