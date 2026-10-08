/**
 * The knowledge base on the homepage: supplements only, and how each one can move a blood test result.
 * Plain data, so it can be read, tested and corrected in one place. Nothing here is a score or a verdict:
 * an entry says which result can move, in which direction, and why.
 */

/** up and down are the usual direction. varies means it depends on the test or on the product. */
export type Direction = 'up' | 'down' | 'varies';

export interface MarkerEffect {
  marker: string;
  direction: Direction;
}

export interface KnowledgeEntry {
  id: string;
  name: string;
  /** other names people look it up by */
  also: readonly string[];
  changes: readonly MarkerEffect[];
  why: string;
  worthKnowing: string;
}

export const KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    id: 'creatine',
    name: 'Creatine',
    also: ['creatine monohydrate'],
    changes: [
      { marker: 'Creatinine', direction: 'up' },
      { marker: 'eGFR worked out from creatinine', direction: 'down' },
    ],
    why: 'Creatinine is what muscle makes from creatine. More creatine in the body means more creatinine in the blood, whether or not the kidneys are working any differently.',
    worthKnowing: 'A creatinine that is a little high on creatine is a common finding. Cystatin C, a kidney marker that does not come from muscle, is not affected this way, so it is a useful second check. Say that you take creatine when the result is read.',
  },
  {
    id: 'biotin',
    name: 'Biotin (vitamin B7)',
    also: ['b7', 'hair skin and nails', 'hair skin nails'],
    changes: [
      { marker: 'TSH', direction: 'down' },
      { marker: 'Free T4', direction: 'up' },
      { marker: 'Free T3', direction: 'up' },
      { marker: 'Troponin', direction: 'down' },
      { marker: 'Other hormone tests', direction: 'varies' },
    ],
    why: 'Many lab tests use a biotin link in their method. Extra biotin in the blood sample gets in the way, so some results read falsely high and others falsely low, depending on how the test is built.',
    worthKnowing: 'The pattern can look like an overactive thyroid when the thyroid is fine. The doses that matter are the ones in hair, skin and nail products (often 5 to 10 mg), not the small amounts in a typical multivitamin. The FDA has warned about this, and many labs ask you to stop for a few days before a blood draw. Ask yours.',
  },
  {
    id: 'vitamin-d',
    name: 'Vitamin D',
    also: ['d3', 'cholecalciferol'],
    changes: [
      { marker: '25-hydroxy vitamin D', direction: 'up' },
      { marker: 'Calcium', direction: 'up' },
    ],
    why: 'The 25-hydroxy vitamin D test measures the vitamin D in your blood, including what a supplement adds. High doses can also raise calcium in blood and urine.',
    worthKnowing: 'The level takes weeks to settle, so a test soon after starting shows only part of the change. A rise in calcium is mostly a high-dose or long-term matter, and if you also take calcium, the result reflects both.',
  },
  {
    id: 'omega-3',
    name: 'Omega-3 (fish oil)',
    also: ['fish oil', 'epa', 'dha', 'krill oil'],
    changes: [
      { marker: 'Triglycerides', direction: 'down' },
      { marker: 'LDL cholesterol', direction: 'varies' },
    ],
    why: 'Omega-3 fats lower the triglycerides the liver releases. Some fish oils that are rich in DHA can raise LDL cholesterol a little.',
    worthKnowing: 'Triglycerides also move with what you ate recently, so the same fasting state before each draw makes a before and after comparison fairer.',
  },
  {
    id: 'iron',
    name: 'Iron',
    also: ['ferrous sulfate', 'ferrous bisglycinate'],
    changes: [
      { marker: 'Serum iron', direction: 'up' },
      { marker: 'Transferrin saturation', direction: 'up' },
      { marker: 'Ferritin', direction: 'up' },
    ],
    why: 'Iron taken by mouth raises the iron in your blood within hours, and over weeks the stored iron that ferritin reflects.',
    worthKnowing: 'A dose the day before a test can make serum iron read high, so many labs ask you to skip it for a day or two first. Ferritin also rises with inflammation, so a high ferritin does not always mean full iron stores.',
  },
  {
    id: 'vitamin-b12',
    name: 'Vitamin B12',
    also: ['cobalamin', 'methylcobalamin', 'cyanocobalamin'],
    changes: [{ marker: 'Vitamin B12', direction: 'up' }],
    why: 'The B12 test measures the vitamin in your blood, which includes what a supplement just added.',
    worthKnowing: 'A high result while taking B12 is expected. A test soon after a dose mostly shows the dose, so say that you take it when the result is read.',
  },
  {
    id: 'zinc',
    name: 'Zinc',
    also: ['zinc picolinate', 'zinc gluconate'],
    changes: [
      { marker: 'Serum zinc', direction: 'up' },
      { marker: 'Serum copper', direction: 'down' },
      { marker: 'Ceruloplasmin', direction: 'down' },
    ],
    why: 'Zinc and copper compete to be absorbed. Months of high zinc intake can leave copper low.',
    worthKnowing: 'The adult upper limit is 40 mg a day from supplements and food together. Low copper can show up as anaemia or a low white cell count on a full blood count.',
  },
  {
    id: 'niacin',
    name: 'Niacin (vitamin B3, nicotinic acid)',
    also: ['b3', 'nicotinic acid'],
    changes: [
      { marker: 'LDL cholesterol', direction: 'down' },
      { marker: 'Triglycerides', direction: 'down' },
      { marker: 'HDL cholesterol', direction: 'up' },
      { marker: 'ALT and AST', direction: 'up' },
      { marker: 'Uric acid', direction: 'up' },
      { marker: 'Fasting glucose', direction: 'up' },
    ],
    why: 'At the high doses used to change cholesterol, niacin acts on fat metabolism and also puts extra work on the liver and on sugar handling.',
    worthKnowing: 'This is about doses of around a gram a day or more, not the amount in food or in a multivitamin.',
  },
  {
    id: 'protein-powder',
    name: 'Protein powder',
    also: ['whey', 'casein', 'plant protein', 'high protein'],
    changes: [{ marker: 'Urea (BUN)', direction: 'up' }],
    why: 'The body clears the nitrogen in protein as urea, so a high protein intake raises urea in the blood.',
    worthKnowing: 'A high urea on its own, in someone eating a lot of protein, is common. Kidney markers are read together, so say how much protein you eat when the result is read.',
  },
];

const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function haystack(entry: KnowledgeEntry): string[] {
  return words([entry.name, ...entry.also, ...entry.changes.map((c) => c.marker), entry.why, entry.worthKnowing].join(' '));
}

/**
 * Entries that match every word typed, where a word matches when it is the start of any word in the entry
 * (so "thyro" finds biotin through its note about the thyroid, and "ferr" finds iron through ferritin).
 * An empty search returns everything, in the order given.
 */
export function searchKnowledge(entries: readonly KnowledgeEntry[], query: string): KnowledgeEntry[] {
  const tokens = words(query);
  if (tokens.length === 0) return [...entries];
  return entries.filter((entry) => {
    const text = haystack(entry);
    return tokens.every((token) => text.some((word) => word.startsWith(token)));
  });
}
