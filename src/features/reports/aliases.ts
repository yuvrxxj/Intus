/**
 * Other names labs print for each marker in the biomarkers table, keyed by its code. Matching is case-insensitive and
 * on whole words; the marker's own name and its code (underscores as spaces) are always tried too. The longest match
 * on a line wins, so "Free T4" beats "T4" and "T4 Total" beats both.
 */
export const ALIASES: Readonly<Record<string, readonly string[]>> = {
  alt: ['alanine aminotransferase', 'alanine transaminase', 'sgpt', 'alt (sgpt)', 'sgpt (alt)'],
  ast: ['aspartate aminotransferase', 'aspartate transaminase', 'sgot', 'ast (sgot)', 'sgot (ast)'],
  ggt: ['gamma gt', 'gamma glutamyl transferase', 'gamma-glutamyl transferase', 'ggtp', 'gamma glutamyl transpeptidase'],
  albumin: ['serum albumin', 'albumin, serum'],
  creatinine: ['serum creatinine', 'creatinine, serum', 'creat'],
  egfr: ['estimated gfr', 'e-gfr', 'gfr, estimated', 'estimated glomerular filtration rate'],
  blood_urea: ['urea', 'blood urea', 'serum urea'],
  uric_acid: ['serum uric acid', 'uric acid, serum', 'urate'],
  hemoglobin: ['haemoglobin', 'hemoglobin', 'hb', 'hgb', 'haemoglobin (hb)', 'hemoglobin (hb)'],
  ferritin: ['serum ferritin', 'ferritin, serum'],
  serum_iron: ['iron', 'iron, serum', 'serum iron'],
  transferrin_sat: ['transferrin saturation', 'tsat', '% saturation', 'iron saturation'],
  vitamin_b12: ['vitamin b12', 'vit b12', 'b12', 'cobalamin', 'cyanocobalamin'],
  vitamin_d: ['vitamin d', 'vit d', '25-oh vitamin d', '25 oh vitamin d', '25-hydroxy vitamin d', '25(oh)d', 'vitamin d, 25-hydroxy', 'vitamin d3'],
  calcium: ['serum calcium', 'calcium, serum', 'total calcium'],
  tsh: ['thyroid stimulating hormone', 'tsh, ultrasensitive', 'tsh ultrasensitive', 'thyrotropin'],
  t3_free: ['free t3', 'ft3', 'free triiodothyronine', 't3, free'],
  t4_free: ['free t4', 'ft4', 'free thyroxine', 't4, free'],
  t4_total: ['t4', 'total t4', 't4 total', 'thyroxine', 'thyroxine (t4)', 't4, total'],
  testosterone: ['total testosterone', 'testosterone, total', 'testosterone total'],
  cortisol: ['serum cortisol', 'cortisol, serum', 'cortisol (morning)', 'morning cortisol'],
  glucose: ['fasting glucose', 'glucose, fasting', 'fasting blood sugar', 'fbs', 'fasting plasma glucose', 'blood glucose fasting', 'glucose fasting'],
  hba1c: ['hba1c', 'hb a1c', 'glycated haemoglobin', 'glycated hemoglobin', 'glycosylated hemoglobin', 'a1c', 'haemoglobin a1c', 'hemoglobin a1c'],
  ldl: ['ldl cholesterol', 'ldl-c', 'ldl cholesterol, direct', 'ldl direct', 'low density lipoprotein', 'ldl-cholesterol'],
  hdl: ['hdl cholesterol', 'hdl-c', 'high density lipoprotein', 'hdl-cholesterol'],
  total_cholesterol: ['cholesterol', 'total cholesterol', 'cholesterol, total', 'serum cholesterol'],
  triglycerides: ['triglyceride', 'triglycerides', 'tg', 'serum triglycerides'],
  crp: ['hs-crp', 'hscrp', 'high sensitivity crp', 'c-reactive protein, high sensitivity', 'hs crp'],
  nt_probnp: ['nt-probnp', 'nt pro bnp', 'nt-pro bnp', 'nt-pro-bnp', 'n-terminal pro b-type natriuretic peptide'],
  wbc_tlc: ['wbc', 'tlc', 'total leucocyte count', 'total leukocyte count', 'white blood cell count', 'white blood cells', 'wbc count'],
  platelets: ['platelet count', 'platelets', 'plt'],
  potassium: ['serum potassium', 'potassium, serum', 'k+'],
  sodium: ['serum sodium', 'sodium, serum', 'na+'],
  oestradiol: ['estradiol', 'oestradiol (e2)', 'estradiol (e2)', 'e2', 'estradiol, serum'],
  progesterone: ['serum progesterone', 'progesterone, serum'],
  lh: ['luteinizing hormone', 'luteinising hormone', 'lh, serum'],
  fsh: ['follicle stimulating hormone', 'follicle-stimulating hormone', 'fsh, serum'],
  prolactin: ['serum prolactin', 'prolactin, serum', 'prl'],
  shbg: ['sex hormone binding globulin', 'sex hormone-binding globulin'],
};

/**
 * Words that mean a line is a different test that happens to contain a marker's name: a ratio or derived value
 * ("LDL/HDL ratio", "Non-HDL cholesterol"), a red-cell index ("Mean corpuscular haemoglobin"), iron binding capacity,
 * or a glucose that is not fasting ("Glucose, post prandial").
 */
export const NOT_THE_MARKER =
  /\b(ratio|non[\s-]?hdl|vldl|index|corpuscular|mchc?|binding capacity|tibc|uibc|post[\s-]?prandial|pp|random|urine|urinary|average)\b|\/hdl|hdl\//i;

/**
 * Words that make a line a table of what the numbers mean, not a result ("VITAMIN D STATUS", "Category C", "Goal of
 * therapy"), so it is never read as a marker.
 */
export const NOT_A_RESULT = /\b(status|deficien\w*|insufficien\w*|sufficien\w*|category|targets?|goals?|interpretation|reference group)\b/i;

/**
 * Per marker, for names that are the same words as another test. A line has to pass: `not` must not match it, and
 * `only`, when given, must. Free testosterone is not total testosterone, urea nitrogen (BUN) is not urea, and a plain
 * C-reactive protein is a different test from the high-sensitivity one Intus stores.
 */
export const LINE_RULES: Readonly<Record<string, { not?: RegExp; only?: RegExp }>> = {
  testosterone: { not: /\b(free|bioavailable)\b/i },
  blood_urea: { not: /\b(nitrogen|bun)\b/i },
  crp: { only: /\bhs[\s-]?crp\b|high[\s-]?sensitiv/i },
};
