// The privacy policy and terms, as plain data. They follow the usual structure of a consumer app's privacy policy and
// terms of use, and every statement in them has to match what the app does on the date below: change the app, change
// this file in the same pull request (test/legal.test.ts checks the parts that are easy to get wrong).
//
// Facts only the operator can change, kept in one place:
export const LEGAL_UPDATED = '12 October 2026';
export const LEGAL_OPERATOR = 'Yuvraaj Singh Rahal';
/** Where disputes go. Change here if Intus is ever run by a company in another country. */
export const LEGAL_GOVERNING_LAW = 'India';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  /** a list shown after the paragraphs */
  items?: string[];
}

export const PRIVACY: LegalSection[] = [
  {
    heading: 'In short',
    paragraphs: [
      'Intus is a personal health tracker. Your information is yours. We use it only to run Intus for you. We do not sell it, show you ads, use it to train AI models, or share it with anyone for their own use.',
      'Health information is sensitive, so we ask for your clear consent before we hold it, and you can download everything or delete your account at any time from the Account section.',
    ],
  },
  {
    heading: 'Who is responsible for your data',
    paragraphs: [
      `Intus is operated by ${LEGAL_OPERATOR} ("we", "us"). We decide how and why your personal data is used, which makes us the "data controller" under European and UK law, the "data fiduciary" under India's Digital Personal Data Protection Act 2023, and the "APP entity" under Australia's Privacy Act 1988.`,
      'Questions, requests and complaints about your data go to the contact address at the bottom of this page. We reply within 7 days and always within 30.',
    ],
  },
  {
    heading: 'What we collect',
    paragraphs: ['Only what you give us, plus the minimum technical data any website needs to run.'],
    items: [
      'Your account: your email address, and your password in hashed form (we never see it). If you sign in with Google, we receive your email address and name from Google.',
      'Health and body information you enter: your profile (name, sex, age, height, goals, activity level), daily weight, food, mood and notes, sleep, habits, workouts, heart readings, supplements, screening history, bloodwork results and the ranges printed on your reports, and, if you choose to add them, cycle days and health conditions.',
      'Files you choose to keep: progress photos, and copies of lab report PDFs if you tick "Keep a private copy" when uploading one.',
      'Sleep, heart rate variability and resting heart rate from Apple Health, only if you install the Intus iPhone app and allow it. The app never writes to Apple Health.',
      'Technical data: your IP address and browser or device type appear in the logs of our hosting providers. We use them only to keep the service running and secure.',
    ],
  },
  {
    heading: 'What we do not collect',
    paragraphs: [
      'We do not collect your precise location, contacts, advertising identifiers or browsing history, and we do not run analytics or advertising trackers.',
    ],
  },
  {
    heading: 'Why we use it, and our basis for doing so',
    paragraphs: [
      'We use your information to provide Intus to you: to store your entries, show them back, flag results against their ranges, and let you download or delete them. Our basis is your consent, and the contract between us when you use the service.',
      'Health information is used only on the basis of your explicit consent, which you give when you create an account and each time you choose to enter, upload or import it. You can withdraw consent at any time by deleting entries or your whole account. Withdrawing does not affect what we did before you withdrew.',
      'We also use technical data to keep Intus secure, prevent abuse and fix problems, which is in our legitimate interest and the interest of everyone who uses it, and we keep or disclose information where the law requires it.',
      'We do not use your information for advertising, profiling, research, selling, or training AI models.',
    ],
  },
  {
    heading: 'Reading lab reports on your device',
    paragraphs: [
      'When you upload a lab report, it is read on your device, including scanned pages. Nothing is sent anywhere until you check the results and press save, and then only the results you ticked, and the PDF if you chose to keep a private copy.',
      'Photos are resized on your device, and their location and camera details are removed before they are uploaded.',
    ],
  },
  {
    heading: 'AI features',
    paragraphs: [
      'Intus does not send your information to an AI service today. Before it ever does, we will update this policy, tell you in the app, name the provider, and ask for your separate permission. It will be your choice, and Intus will keep working without it.',
    ],
  },
  {
    heading: 'Who we share it with',
    paragraphs: [
      'Only the service providers that run Intus, acting on our instructions and only for that purpose:',
    ],
    items: [
      'Supabase stores the database and files and handles sign-in. Your data is held in their Singapore region.',
      'Vercel serves the website and app.',
      'Google, only if you choose to sign in with Google.',
      'An email provider sends sign-up confirmation and password reset emails.',
    ],
  },
  {
    heading: 'When we might disclose it',
    paragraphs: [
      'We do not sell or rent your information. We would disclose it only if the law or a valid legal process requires it, to protect someone\'s safety, or if Intus were transferred to another operator, in which case we would tell you first, your data would stay under this policy, and you could delete it before the transfer.',
      'The people who run Intus have administrative access to the systems that host it, as with any online service. They do not look at your personal data except to fix a problem you ask for help with, or where the law requires it.',
    ],
  },
  {
    heading: 'Where it is stored',
    paragraphs: [
      'Your data is stored in Singapore. Our providers may process technical data in other countries. Where the law requires safeguards for data sent abroad, we rely on our providers\' contractual commitments.',
    ],
  },
  {
    heading: 'How long we keep it',
    paragraphs: [
      'We keep your information until you delete it or your account. Account, Delete account removes your sign-in, every row and every file straight away and cannot be undone.',
      'Routine backups held by our hosting provider may keep copies for a short time after deletion until they are overwritten. They are not used to bring your data back. Hosting logs are kept for short periods set by those providers.',
    ],
  },
  {
    heading: 'How we protect it',
    paragraphs: [
      'Every row and file is tied to your account, and the database refuses requests for anyone else\'s, even from someone who has the app\'s public key. Data is encrypted in transit and stored encrypted by our hosting provider. Passwords are hashed.',
      'No system is perfectly secure. If a breach affects you, we will tell you and the authorities as the law requires.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: [
      'Depending on where you live, you have rights over your information, including under India\'s Digital Personal Data Protection Act, the GDPR and UK GDPR, and Australia\'s Privacy Act. You can:',
    ],
    items: [
      'Access and download it: Account, Download my data, gives you everything you have stored as one file.',
      'Correct it: you can edit or delete anything you entered at any time.',
      'Delete it: Account, Delete account.',
      'Withdraw consent, object to or ask us to restrict how we use it, and, where the law allows, nominate someone to exercise your rights for you.',
      'Complain to a regulator, such as the Data Protection Board of India, your local data protection authority in Europe or the UK, or the Office of the Australian Information Commissioner. We would like the chance to put things right first, so please write to us.',
    ],
  },
  {
    heading: 'Age',
    paragraphs: [
      'Intus is for people aged 18 and over. We do not knowingly collect information from anyone younger. If we learn that we have, we will delete it.',
    ],
  },
  {
    heading: 'Cookies and similar storage',
    paragraphs: [
      'Intus uses no advertising or tracking cookies and no analytics service. It keeps your sign-in session, and a few settings, in your browser, which is needed for the site to work.',
    ],
  },
  {
    heading: 'Changes to this policy',
    paragraphs: [
      'If this policy changes in a way that matters, we will tell you in the app before the change applies. The date at the top shows when it last changed.',
    ],
  },
  {
    heading: 'Contact and complaints',
    paragraphs: [
      'Write to the address at the bottom of this page for any question, request or complaint about your data, including the rights above. This is also our grievance contact for the purposes of Indian law.',
    ],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: 'Agreeing to these terms',
    paragraphs: [
      'By creating an account or using Intus you agree to these terms and to the privacy policy. If you do not agree, do not use Intus.',
    ],
  },
  {
    heading: 'What Intus is',
    paragraphs: [
      'Intus is a personal tracker. It records what you enter or import, shows it back to you, and flags results against the ranges printed on your reports or the usual ranges. It does not diagnose, treat or prevent any condition, it does not recommend medicines or doses, and it is not a medical device.',
    ],
  },
  {
    heading: 'Not medical advice',
    paragraphs: [
      'Nothing in Intus is medical advice, and using it does not create a doctor and patient relationship. Ranges, flags and the notes beside each marker are general information and may not fit your situation.',
      'Talk to a doctor about your results, especially anything outside its range. Never delay or ignore medical advice because of something you saw in Intus. In an emergency, call your local emergency number. Decisions about your health are yours, made with your own health professional.',
    ],
  },
  {
    heading: 'Who can use Intus',
    paragraphs: [
      'You must be 18 or over and able to enter into a binding agreement. Give accurate information when you sign up. One account is for one person.',
    ],
  },
  {
    heading: 'Your account',
    paragraphs: [
      'Keep your password to yourself. You are responsible for what happens under your account, so tell us at once if you think someone else has got into it.',
    ],
  },
  {
    heading: 'Your information',
    paragraphs: [
      'What you enter is yours. You give us permission to store and process it, only to provide Intus to you and as the privacy policy describes. We do not own it and will not use it for anything else.',
      'Only enter or upload your own information. Do not upload someone else\'s health records without their permission.',
    ],
  },
  {
    heading: 'Accuracy of reports and calculations',
    paragraphs: [
      'Results read from an uploaded report, and anything imported from Apple Health or another source, can be wrong or incomplete. Check every row before saving. Intus never converts units for you, and calculated values such as trends depend on what you entered.',
    ],
  },
  {
    heading: 'Using Intus fairly',
    paragraphs: ['Do not:'],
    items: [
      'try to reach other people\'s data or accounts;',
      'probe, scan or test the service for weaknesses without our written permission, or overload it;',
      'copy it by automated means, or reverse engineer it except where the law allows;',
      'upload malicious code, or use Intus unlawfully;',
      'use Intus to offer medical or coaching services to other people, or resell it.',
    ],
  },
  {
    heading: 'Other services',
    paragraphs: [
      'Intus relies on other services, such as hosting, sign-in and Apple Health. Their terms apply to them, and we are not responsible for their outages or changes.',
    ],
  },
  {
    heading: 'Price',
    paragraphs: [
      'Intus is free at the moment. If we introduce paid features, we will tell you in advance, and you will not be charged for anything you have not agreed to.',
    ],
  },
  {
    heading: 'Our rights in Intus',
    paragraphs: [
      'The software, design, brand and written content of Intus belong to us or our licensors. We give you a personal, non-exclusive, non-transferable permission to use it for your own tracking while these terms apply. If you send us feedback, we may use it without owing you anything.',
    ],
  },
  {
    heading: 'Availability and changes',
    paragraphs: [
      'Intus is still being built. It may change, be interrupted or have mistakes. Use Download my data to keep your own copy of what matters to you.',
    ],
  },
  {
    heading: 'Disclaimers',
    paragraphs: [
      'To the fullest extent the law allows, Intus is provided "as is" and "as available", without warranties of any kind, including that it is accurate, error free, uninterrupted, fit for a particular purpose or free of infringement.',
    ],
  },
  {
    heading: 'Limits on our liability',
    paragraphs: [
      'To the fullest extent the law allows, we are not liable for indirect or consequential loss, loss of data, profits or opportunity, or for decisions made on the basis of what Intus shows. Our total liability to you for anything arising from Intus is limited to the greater of what you paid us in the 12 months before the claim and US$100.',
      'Nothing in these terms limits liability that cannot be limited by law, including for fraud, or for death or personal injury caused by negligence, or removes rights you have under consumer protection law where you live.',
    ],
  },
  {
    heading: 'Your responsibility to us',
    paragraphs: [
      'To the extent the law allows, you will cover our reasonable losses from a claim brought by someone else because you broke these terms or used Intus unlawfully.',
    ],
  },
  {
    heading: 'Suspending or ending your use',
    paragraphs: [
      'You can stop at any time by deleting your account, which deletes your data as the privacy policy describes. We may suspend or close an account that breaks these terms, puts the service or other people at risk, or where the law requires it, and we will tell you why where we can.',
      'The parts of these terms that by their nature should continue, such as the disclaimers and limits on liability, continue after your account ends.',
    ],
  },
  {
    heading: 'Changes to these terms',
    paragraphs: [
      'If these terms change in a way that matters, you will be told in the app before the change applies. If you keep using Intus after it applies, you accept the change. If you do not accept it, delete your account before then.',
    ],
  },
  {
    heading: 'Governing law and disputes',
    paragraphs: [
      `These terms are governed by the laws of ${LEGAL_GOVERNING_LAW}, and its courts have exclusive jurisdiction, except that you keep any rights you have under mandatory consumer law where you live. Before starting any proceedings, please write to us at the address below and give us 30 days to put things right.`,
    ],
  },
  {
    heading: 'General',
    paragraphs: [
      'These terms and the privacy policy are the whole agreement between you and us about Intus. If part of them cannot be enforced, the rest still applies. Not enforcing a right is not giving it up. You may not transfer your rights to anyone else; we may transfer ours as part of passing Intus to another operator. We may give you notices by email or in the app.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: ['Questions about these terms: write to the address at the bottom of this page.'],
  },
];
