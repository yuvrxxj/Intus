// Taking a person's identity out of a lab report's text, on their device, before any of it is sent for AI reading.
// Pure: no network. Best effort by design, so the app also shows the person exactly what would be sent.
//
// Three things are removed: lines that carry identity (name, age and sex, ID numbers, contact details, doctors),
// identity inside other lines (titled names, the person's own name, emails, links, long ID numbers, phone numbers),
// and paragraphs (long lines of explanation, which cost money and contain no result). The sample date is added back
// as its own line, because the lines that carried it also carried identity.

export interface Redacted {
  /** what would be sent, one line each */
  lines: string[];
  /** lines dropped because they carried identity */
  removedLines: number;
  /** pieces of other lines replaced by a placeholder */
  masked: number;
}

/** Lines longer than this are explanations, not results. The longest real result lines are under 150 characters. */
export const MAX_LINE = 200;
/** A line with no digit in it that is longer than this is a sentence of explanation, not a test name or a heading. */
export const MAX_WORDS_ONLY = 70;

// A label that means the line is about the person or the lab's paperwork, wherever it sits in the line.
const IDENTITY_LABEL =
  /\b(patient\s*(?:name|id|no)|booking\s*id|order\s*id|barcode|sin\s*no|uhid|mrn|lab\s*(?:no|id)|accession|registration\s*(?:no|id)|date\s*of\s*birth|d\.?o\.?b|address|e-?mail|phone|mobile|contact\s*(?:no|number)|referred\s*by|referring\s*doctor|customer\s*since|pin\s*code|pincode)\b/i;
// Labels that are only identity at the start of a line followed by a colon or slash ("Age/Gender : 26Y"), because as
// words they also begin real tests ("Sex hormone binding globulin").
const LEADING_LABEL = /^(?:name|age|gender|sex|age\s*\/\s*gender)\s*[:/]/i;
const DEMOGRAPHICS = [
  /^(?:male|female|other)\b[,\s]+\d{1,3}\s*(?:yrs?|years?)\b/i,
  /\b\d{1,3}\s*y\b.*\b(?:male|female)\b/i,
];
// Signatures and registrations of the doctors who signed the report.
const SIGNATURE = /^dr\.?\s+[A-Za-z]|\b(?:mbbs|md\s+(?:biochemistry|pathology|microbiology)|consultant\s+(?:biochemist|pathologist)|dmc\s*-|reg\.?\s*no)\b/i;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;
const TITLED_NAME = /\b(?:Mr|Mrs|Ms|Miss|Master|Dr|Prof|Shri|Smt)\.?\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3}/g;
// eight or more digits in a row, or letters then six or more digits: booking, order, barcode and phone numbers
const LONG_ID = /\b(?:[A-Za-z]{0,3}\d{8,}|[A-Za-z]{1,3}\d{6,})\b/g;
// "98765 43210", "+91 98765-43210": groups of digits with spaces or hyphens, ten digits or more in all
const SPACED_PHONE = /(?:\+?\d{1,3}[\s-])?\d{3,5}[\s-]\d{3,5}(?:[\s-]\d{2,5})?/g;

const digits = (s: string) => s.replace(/\D/g, '').length;

/** The words of a name worth masking wherever they appear: three or more letters, nothing else in them. */
function nameWords(names: readonly string[]): string[] {
  const words = names.flatMap((n) => n.split(/[\s,._-]+/)).filter((w) => /^[A-Za-z]{3,}$/.test(w));
  return [...new Set(words.map((w) => w.toLowerCase()))];
}

export function redactReport(source: readonly string[], options: { names?: readonly string[]; sampleDate?: string | null } = {}): Redacted {
  const words = nameWords(options.names ?? []);
  const wordPattern = words.length > 0 ? new RegExp(String.raw`\b(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\b`, 'gi') : null;
  const out: string[] = [];
  let removedLines = 0;
  let masked = 0;
  const mask = (line: string, pattern: RegExp, placeholder: string, accept: (match: string) => boolean = () => true) =>
    line.replace(pattern, (m) => {
      if (!accept(m)) return m;
      masked++;
      return placeholder;
    });

  for (const raw of source) {
    let line = raw.replace(/\s+/g, ' ').trim();
    if (line === '') continue;
    if (IDENTITY_LABEL.test(line) || LEADING_LABEL.test(line) || SIGNATURE.test(line) || DEMOGRAPHICS.some((d) => d.test(line))) {
      removedLines++;
      continue;
    }
    line = mask(line, EMAIL, '[email]');
    line = mask(line, LINK, '[link]');
    line = mask(line, TITLED_NAME, '[name]');
    if (wordPattern) line = mask(line, wordPattern, '[name]');
    line = mask(line, LONG_ID, '[id]');
    line = mask(line, SPACED_PHONE, '[phone]', (m) => digits(m) >= 10);
    if (line.length > MAX_LINE || (line.length > MAX_WORDS_ONLY && !/\d/.test(line))) continue;
    if (!/[A-Za-z0-9]/.test(line.replace(/\[(?:name|id|email|link|phone)\]/g, ''))) continue;
    // page headers repeat on every page
    if (out.at(-1) === line) continue;
    out.push(line);
  }
  if (options.sampleDate) out.unshift(`Sample date: ${options.sampleDate}`);
  return { lines: out, removedLines, masked };
}
