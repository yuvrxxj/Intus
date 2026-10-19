// Everything the site says about price, in one place, so it is easy to replace once the pricing decision is made (INT-38).
// Until then it says only what is true today: it is free in early access, no prices are set, and the price will be
// published before anything is charged. No amount, no plan name and no "subscription" belongs here until a person decides.

/** The card in the Pricing section of the homepage. */
export const PRICING = {
  headline: 'Free during early access.',
  points: [
    'Everything in the app today: the daily log, goals and habits, sleep, bloodwork, supplements and progress.',
    'No card needed. Make an account and start.',
    'Paid plans arrive with the phone apps. The price will be published before anything is charged.',
  ],
} as const;

export interface PricingSection {
  heading: string;
  paragraphs: string[];
  items?: string[];
}

/** The /pricing page. */
export const PRICING_PAGE: { title: string; lead: string; sections: PricingSection[]; questions: [string, string][] } = {
  title: 'Pricing',
  lead: 'Intus is in early access, and it is free.',
  sections: [
    {
      heading: 'Free during early access',
      paragraphs: ['Everything in the app is free while Intus is in early access. You do not need a card. Make an account and start.'],
      items: [
        'The daily log: weight, food, steps and the habits you set, with progress charts and streaks.',
        'Bloodwork: type results in or upload a lab report PDF. Each result is set against the range printed on its own report, and critical limits are called out.',
        'Sleep: log nights by hand or import them from Apple Health.',
        'Supplements: record what you take and see the days before set against the days after.',
        'Photo check-ins, strength training and, for women, a cycle log.',
      ],
    },
    {
      heading: 'After early access',
      paragraphs: [
        'Paid plans arrive with the phone apps. We have not set the prices yet.',
        'The price will be published on this page before anything is charged, and nobody is charged without choosing to pay. Intus holds no payment details today.',
      ],
    },
    {
      heading: 'Your data',
      paragraphs: ['You can download everything you have logged as one file, print your latest results for your doctor, or delete your account and everything in it. All three are on the Account and Bloodwork pages today.'],
    },
  ],
  questions: [
    ['Is it really free?', 'Yes, during early access.'],
    ['Do I need a card?', 'No.'],
    ['Can I use it on my phone?', 'Not yet. Intus runs in the browser on laptops, desktops and tablets, and the phone apps are coming. A phone browser shows the homepage for now.'],
    ['Where will prices appear?', 'On this page first.'],
  ],
};
