/*
 * What each marker is, for the popover on the Bloodwork screen. Plain data, reviewed in pull requests like the
 * knowledge base (src/features/knowledge/knowledge.ts).
 *
 * Rules for the wording (INT-74):
 *   - plain language, at the level of public health references; "common reasons", never a diagnosis
 *   - no drug names, no doses, no supplement amounts
 *   - lifestyle notes stay with diet, sleep, exercise, alcohol, smoking and hydration
 *   - every entry links to MedlinePlus (US National Library of Medicine) through MedlinePlus Connect, which looks the
 *     test up by its LOINC code and opens the matching page, so the link cannot drift to the wrong article
 *
 * The range a popover shows is the one the result was read against (printed on the report, or the usual range when it
 * applies to the person), never a number written here.
 */

export interface MarkerInfo {
  /** what the test measures and why it is done */
  what: string;
  /** common reasons a result is above the range */
  high: string;
  /** common reasons a result is below the range; omitted where low is rarely meaningful */
  low?: string;
  /** general habits that affect it */
  habits: string;
  /** LOINC code of the usual test, for the MedlinePlus link */
  loinc: string;
}

export const MEDLINEPLUS_REVIEW_NOTE = 'Written by Intus from public references. Read the full page on MedlinePlus.';

/** The MedlinePlus Connect address for a LOINC code: it opens the MedlinePlus page for that test. */
export function medlinePlusUrl(loinc: string): string {
  const q = new URLSearchParams({
    'mainSearchCriteria.v.cs': '2.16.840.1.113883.6.1',
    'mainSearchCriteria.v.c': loinc,
    'informationRecipient.languageCode.c': 'en',
  });
  return `https://connect.medlineplus.gov/application?${q.toString()}`;
}

export const MARKER_INFO: Readonly<Record<string, MarkerInfo>> = {
  alt: {
    what: 'An enzyme found mostly in the liver. It leaks into the blood when liver cells are irritated or damaged, so it is one of the main liver checks.',
    high: 'Common reasons include fatty liver, alcohol, some medicines, hepatitis, and hard exercise in the days before the test.',
    habits: 'Limiting alcohol, keeping a healthy weight and staying active help the liver. Avoid heavy training for a couple of days before a retest.',
    loinc: '1742-6',
  },
  ast: {
    what: 'An enzyme in the liver, heart and muscles. It is read together with ALT to look at the liver.',
    high: 'Common reasons include liver irritation, alcohol, muscle strain or hard exercise, and some medicines.',
    habits: 'The same as for ALT: less alcohol, a healthy weight, and no hard training just before the test.',
    loinc: '1920-8',
  },
  ggt: {
    what: 'A liver enzyme that rises early with bile duct problems and with alcohol.',
    high: 'Common reasons include alcohol, fatty liver, bile duct problems and some medicines.',
    habits: 'Cutting down on alcohol often brings it down over a few weeks.',
    loinc: '2324-2',
  },
  albumin: {
    what: 'The main protein in blood, made by the liver. It keeps fluid in the blood vessels and carries other substances.',
    high: 'Usually from dehydration.',
    low: 'Common reasons include liver or kidney problems, inflammation and poor nutrition.',
    habits: 'Enough protein in the diet and enough fluid.',
    loinc: '1751-7',
  },
  creatinine: {
    what: 'A waste product from muscle, cleared by the kidneys. It is the usual first check of kidney function.',
    high: 'Common reasons include reduced kidney function, dehydration, a lot of muscle mass, a high-meat meal before the test, and creatine supplements.',
    low: 'Often simply low muscle mass.',
    habits: 'Drink enough water and avoid a large meat meal and hard exercise the day before the test.',
    loinc: '2160-0',
  },
  egfr: {
    what: 'An estimate of how well the kidneys filter, worked out from creatinine, age and sex.',
    high: 'A high eGFR is usually not a concern.',
    low: 'A low eGFR can mean reduced kidney function, but it also falls with dehydration and with anything that raises creatinine.',
    habits: 'Staying hydrated, keeping blood pressure and blood sugar in check, and not smoking protect the kidneys.',
    loinc: '33914-3',
  },
  blood_urea: {
    what: 'A waste product from breaking down protein, cleared by the kidneys.',
    high: 'Common reasons include dehydration, a high-protein diet and reduced kidney function.',
    low: 'Can follow a low-protein diet or liver problems.',
    habits: 'Enough fluid, and a steady protein intake around the test.',
    loinc: '3094-0',
  },
  uric_acid: {
    what: 'A waste product from breaking down purines, found in many foods. High levels can form crystals in joints (gout) or kidney stones.',
    high: 'Common reasons include diets rich in red meat, organ meats, seafood and sugary drinks, alcohol (beer especially), dehydration and reduced kidney function.',
    habits: 'Less alcohol and sugary drinks, more water, and a healthy weight.',
    loinc: '3084-1',
  },
  hemoglobin: {
    what: 'The protein in red blood cells that carries oxygen. It is the main check for anaemia.',
    high: 'Common reasons include dehydration, smoking, living at altitude and some lung conditions.',
    low: 'Common reasons include low iron, B12 or folate, blood loss (including heavy periods) and long-term illness.',
    habits: 'A diet with iron-rich foods (meat, beans, lentils, leafy greens) and vitamin C alongside them; not smoking.',
    loinc: '718-7',
  },
  ferritin: {
    what: 'A protein that stores iron. It is the best single blood measure of the body\'s iron stores.',
    high: 'Common reasons include inflammation or infection, liver problems, alcohol and iron overload. It rises with inflammation even when iron stores are normal.',
    low: 'Usually means low iron stores, often from diet or blood loss.',
    habits: 'Iron-rich foods with vitamin C; tea and coffee with meals lower iron absorption.',
    loinc: '2276-4',
  },
  serum_iron: {
    what: 'The iron circulating in the blood. It changes through the day and with recent meals, so it is read with ferritin and transferrin saturation.',
    high: 'Common reasons include a recent iron-rich meal or supplement, and iron overload.',
    low: 'Common reasons include low iron stores and inflammation.',
    habits: 'Take the test in the morning, fasting, so results compare from one test to the next.',
    loinc: '2498-4',
  },
  transferrin_sat: {
    what: 'How much of the blood\'s iron-carrying protein is loaded with iron, as a percentage.',
    high: 'Can point to iron overload, and is one of the first checks for it.',
    low: 'Usually low iron available to the body.',
    habits: 'As for iron: a morning, fasting test, and iron-rich foods in the diet.',
    loinc: '2502-3',
  },
  vitamin_b12: {
    what: 'A vitamin needed for red blood cells and nerves. It comes from animal foods and fortified foods.',
    high: 'Often from supplements or fortified foods; occasionally from liver problems.',
    low: 'Common reasons include a vegan or vegetarian diet without fortified foods, lower absorption with age, and some stomach and gut conditions.',
    habits: 'Animal foods, dairy, eggs, or fortified foods for those who do not eat them.',
    loinc: '2132-9',
  },
  vitamin_d: {
    what: 'The 25-hydroxy vitamin D level, the usual measure of the body\'s vitamin D. It helps the body take up calcium for bones and muscles.',
    high: 'Almost always from taking a lot of vitamin D over time.',
    low: 'Common reasons include little sun on the skin, darker skin, covering clothes, winter, and a higher body weight.',
    habits: 'Some sun exposure where safe, oily fish, eggs and fortified foods.',
    loinc: '1989-3',
  },
  calcium: {
    what: 'The calcium in blood, kept in a tight range by the parathyroid glands, vitamin D and the kidneys.',
    high: 'Common reasons include overactive parathyroid glands and a lot of vitamin D or calcium supplements.',
    low: 'Common reasons include low vitamin D, low albumin and kidney problems.',
    habits: 'Dairy, leafy greens, tofu set with calcium, and enough vitamin D.',
    loinc: '17861-6',
  },
  tsh: {
    what: 'The hormone the brain uses to tell the thyroid how hard to work. It is the first test of thyroid function.',
    high: 'Usually means the thyroid is underactive and the brain is pushing it harder.',
    low: 'Usually means the thyroid is overactive, or thyroid hormone intake is more than the body needs.',
    habits: 'Biotin supplements can upset some thyroid tests; stopping them a few days before the test avoids that.',
    loinc: '3016-3',
  },
  t3_free: {
    what: 'The active thyroid hormone that is not bound to proteins.',
    high: 'Can point to an overactive thyroid.',
    low: 'Can point to an underactive thyroid, and also falls during illness and very low-calorie diets.',
    habits: 'Read with TSH and free T4, not on its own.',
    loinc: '3051-0',
  },
  t4_free: {
    what: 'The main hormone the thyroid makes, the part not bound to proteins.',
    high: 'Can point to an overactive thyroid.',
    low: 'Can point to an underactive thyroid.',
    habits: 'As for TSH: biotin can upset the test.',
    loinc: '3024-7',
  },
  t4_total: {
    what: 'All the T4 in blood, bound and free. Changes in binding proteins (pregnancy, some contraceptives) move it without any thyroid problem.',
    high: 'Can point to an overactive thyroid, or to more binding protein.',
    low: 'Can point to an underactive thyroid, or to less binding protein.',
    habits: 'Read with TSH and free T4.',
    loinc: '3026-2',
  },
  testosterone: {
    what: 'The main male sex hormone, also made in smaller amounts in women. It peaks in the morning.',
    high: 'In women, polycystic ovary syndrome is a common reason; in anyone, taking testosterone or related products.',
    low: 'Common reasons include poor sleep, a high body weight, heavy drinking, hard training without enough food, and age.',
    habits: 'Enough sleep, a healthy weight, strength training and enough food. Test in the morning so results compare.',
    loinc: '2986-8',
  },
  cortisol: {
    what: 'The main stress hormone. It is highest in the morning and lowest at night, so the time of the test matters.',
    high: 'Common reasons include stress, poor sleep, illness, and some medicines.',
    low: 'Can point to the adrenal glands not making enough.',
    habits: 'Regular sleep and stress management. Test at the same time of day each time.',
    loinc: '2143-6',
  },
  glucose: {
    what: 'Blood sugar after an overnight fast. It is a check for diabetes and prediabetes.',
    high: 'Common reasons include prediabetes or diabetes, not fasting before the test, stress, illness and poor sleep.',
    low: 'Can follow a long fast or hard exercise.',
    habits: 'Regular activity, fibre-rich foods, fewer sugary drinks and refined carbs, and enough sleep.',
    loinc: '1558-6',
  },
  hba1c: {
    what: 'The share of haemoglobin with sugar attached. It reflects average blood sugar over about the last three months.',
    high: 'Usually means blood sugar has been running high: prediabetes or diabetes. Some anaemias and haemoglobin variants also move it.',
    habits: 'Regular activity, a healthy weight, fewer sugary drinks and refined carbs, and enough sleep.',
    loinc: '4548-4',
  },
  ldl: {
    what: 'The cholesterol carried by low-density lipoprotein. Over time it builds up in artery walls, so lower is generally better.',
    high: 'Common reasons include diet high in saturated fat, family history, a higher body weight and low activity.',
    habits: 'Less saturated fat (fatty meat, butter, pastries), more fibre (oats, beans, vegetables), regular exercise, and not smoking.',
    loinc: '13457-7',
  },
  hdl: {
    what: 'The cholesterol carried by high-density lipoprotein, which takes cholesterol back to the liver.',
    high: 'A high HDL is not usually a concern.',
    low: 'Common reasons include low activity, smoking, a higher body weight and diets high in refined carbs.',
    habits: 'Regular aerobic exercise, not smoking, and a healthy weight.',
    loinc: '2085-9',
  },
  total_cholesterol: {
    what: 'All the cholesterol in blood. It is read with LDL, HDL and triglycerides rather than alone.',
    high: 'Usually from a high LDL; diet, family history and weight all play a part.',
    habits: 'As for LDL: less saturated fat, more fibre, regular exercise.',
    loinc: '2093-3',
  },
  triglycerides: {
    what: 'The main fat in blood, from food and made by the liver from extra calories.',
    high: 'Common reasons include not fasting before the test, alcohol, sugary foods and drinks, a higher body weight and high blood sugar.',
    habits: 'Less alcohol and sugar, regular exercise, and oily fish. Fast before the test so results compare.',
    loinc: '2571-8',
  },
  crp: {
    what: 'High-sensitivity C-reactive protein, a marker of inflammation in the body.',
    high: 'Common reasons include a recent infection or injury, a higher body weight, smoking and long-term inflammatory conditions. A cold can raise it for weeks.',
    habits: 'Regular exercise, a healthy weight and not smoking. Retest when well, not during or just after an infection.',
    loinc: '30522-7',
  },
  nt_probnp: {
    what: 'A substance the heart releases when its walls are stretched. It is used to check for heart strain.',
    high: 'Common reasons include heart strain or failure, kidney problems and age.',
    habits: 'Results outside the range are worth discussing with a doctor.',
    loinc: '33762-6',
  },
  wbc_tlc: {
    what: 'The number of white blood cells, which fight infection.',
    high: 'Common reasons include infection, inflammation, stress, smoking and hard exercise.',
    low: 'Common reasons include viral infections and some medicines; some healthy people run low.',
    habits: 'Read alongside how you felt at the time of the test.',
    loinc: '6690-2',
  },
  platelets: {
    what: 'The number of platelets, the cells that help blood clot.',
    high: 'Common reasons include inflammation, infection, low iron and recovery from blood loss.',
    low: 'Common reasons include viral infections, alcohol and some medicines.',
    habits: 'Limiting alcohol helps keep counts steady.',
    loinc: '777-3',
  },
  potassium: {
    what: 'A mineral that nerves and muscles, including the heart, rely on. The kidneys keep it in a narrow range.',
    high: 'Common reasons include a sample that was handled roughly (a false high), kidney problems and some medicines.',
    low: 'Common reasons include vomiting, diarrhoea, sweating heavily and some medicines.',
    habits: 'Fruit, vegetables, beans and potatoes are good sources.',
    loinc: '2823-3',
  },
  sodium: {
    what: 'The main salt in blood. It mostly reflects the balance of water in the body.',
    high: 'Usually from not drinking enough water.',
    low: 'Common reasons include drinking a great deal of water (in long endurance events especially), vomiting or diarrhoea, and some medicines.',
    habits: 'Drink to thirst, and use electrolyte drinks in long, sweaty exercise.',
    loinc: '2951-2',
  },
};
