export function splitAddress(value: string | null): { name: string; address: string } {
  if (!value) return { name: '—', address: '' };
  const [first, ...rest] = value.split('\n').map(s => s.trim()).filter(Boolean);
  return { name: first ?? '—', address: rest.join(', ') };
}

export function cityLine(value: string | null): string {
  if (!value) return '—';
  const lines = value.split('\n').map(s => s.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? '—';
}

// Extractors write the country line in whichever form the source document used,
// and constituent nations turn up as often as the union's own name.
const UK_COUNTRY_NAMES = new Set([
  'uk', 'gb', 'united kingdom', 'great britain', 'england', 'scotland', 'wales',
  'northern ireland', 'united kingdom of great britain and northern ireland',
]);

// "UK" vs "United Kingdom" vs "GB" are the same fact written three ways —
// collapse any of them to one token so an identity match isn't defeated by
// which alias a given source document happened to use.
function normalizeCountryToken(s: string): string {
  const cleaned = s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return UK_COUNTRY_NAMES.has(cleaned) ? 'uk' : cleaned;
}

// Words that tell you a company's legal form or that it operates in the UK,
// not which company it is — stripped off the end of a name (possibly several
// at once, e.g. "... NHS Foundation Trust") so that they don't defeat a
// same-company match just because one HAWB's extraction included the suffix
// and another's didn't. Deliberately excludes anything that carries real
// identifying meaning ("Hospital", "Laboratory", "Services", "Institute" —
// two different real places can differ only by one of those).
const TRAILING_NAME_BOILERPLATE = new Set([
  ...UK_COUNTRY_NAMES,
  'nhs foundation trust', 'nhs trust', 'foundation trust', 'trust', 'foundation', 'nhs',
  'ltd', 'limited', 'plc', 'llc', 'inc', 'corp', 'corporation', 'co', 'company',
]);
const TRAILING_NAME_BOILERPLATE_BY_LENGTH = Array.from(TRAILING_NAME_BOILERPLATE).sort((a, b) => b.length - a.length);

// Repeatedly strips a trailing boilerplate word/phrase off the end of an
// already-lowercased/whitespace-collapsed name — "guy's and st thomas nhs
// foundation trust" needs three rounds ("trust", then "foundation", then
// "nhs") to reach the same "guy's and st thomas" another HAWB for the same
// building might extract straight to.
function stripTrailingBoilerplate(name: string): string {
  let current = name;
  for (let round = 0; round < 6; round++) {
    const match = TRAILING_NAME_BOILERPLATE_BY_LENGTH.find(
      token => current !== token && current.endsWith(` ${token}`),
    );
    if (!match) break;
    current = current.slice(0, -(match.length + 1)).trim();
  }
  return current;
}

// Same-location identity for grouping HAWBs onto one driver leg — deliberately
// coarser than an exact string match. Two HAWBs for the same company are often
// OCR'd from different source documents, so the middle address lines (floor,
// suite, minor whitespace/punctuation) can drift even when the company name and
// the site/city line — the two things a driver actually reads off the
// "From"/"To" columns — are identical. Keys on just those two, normalized —
// with punctuation, trailing legal-entity boilerplate ("... NHS Foundation
// Trust" vs "... NHS Foundation" vs plain "..."), and country-alias quirks all
// ironed out first, since none of that is a different place, just a different
// way of writing the same one.
//
// The "site" signal is the tail after the final comma on the last line, not
// the whole line — some source documents get extracted with every line after
// the name comma-joined onto one ("Road, Centre, 10th Floor, North Wing, St
// Thomas' Hospital") instead of split across lines like a well-formed address
// ("Road" / "Centre" / "10th Floor, North Wing" / "St Thomas' Hospital"). In
// both shapes the recognizable site name is whatever sits after the final
// comma, so comparing on that instead of the raw last line matches the two
// shapes the same way.
export function addressIdentityKey(value: string | null): string | null {
  if (!value) return null;
  const normalize = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim();
  const name = stripTrailingBoilerplate(normalize(splitAddress(value).name));
  if (!name || name === '—') return null;
  const lastLine = cityLine(value);
  const segments = lastLine.split(',');
  const last = normalizeCountryToken(segments[segments.length - 1]);
  return `${name}|${last}`;
}

// A collection whose pickup site is the same place as the manifest's End
// point isn't a real extra stop — the vehicle is already headed there as the
// run's last stop, so export skips booking it again as its own destination
// (see Horizon-Api's mytransport_export.is_backhaul_collection, which this
// mirrors exactly).
export function isBackhaulCollection(
  job: { job_service_type: string | null; shipper: string | null },
  endPoint: string | null,
): boolean {
  if (job.job_service_type !== 'collection') return false;
  const identity = addressIdentityKey(job.shipper);
  return identity !== null && identity === addressIdentityKey(endPoint);
}

const UK_POSTCODE_RE = /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const EIRCODE_RE = /[A-Z]\d{2}\s?[A-Z0-9]{4}\b/i;
const NUMERIC_POSTCODE_RE = /\b\d{4,6}\b/;

// The "Town, Postcode" line reliably sits second-to-last, right before the
// country line (e.g. "Valencia, CA 91355" or "London, W12 7FP") — search
// from the end backward, skipping the first line (company/name), so a street
// number earlier in the address (e.g. "28454 Livingston Ave") never gets
// mistaken for the postcode.
export function cityAndPostcodeLine(value: string | null): { town: string; postcode: string } {
  if (!value) return { town: '', postcode: '' };
  const lines = value.split('\n').map(s => s.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 1; i--) {
    const line = lines[i];
    const match = line.match(UK_POSTCODE_RE) ?? line.match(EIRCODE_RE) ?? line.match(NUMERIC_POSTCODE_RE);
    if (match && match.index != null) {
      const postcode = match[0].toUpperCase();
      const before = line.slice(0, match.index).trim().replace(/,$/, '').trim();
      const town = before.split(',')[0].trim();
      return { town, postcode };
    }
  }
  return { town: '', postcode: '' };
}

export function postcodeLine(value: string | null): string {
  return cityAndPostcodeLine(value).postcode;
}

// Whether an address blob sits in the UK, read off its country line. Anything
// unrecognized (including a blinded placeholder) counts as not-UK — callers use
// this to pick a default, so an uncertain answer should decline rather than
// guess.
export function isUkAddress(value: string | null): boolean {
  if (!value) return false;
  const last = cityLine(value);
  if (last === '—') return false;
  const country = last.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (UK_COUNTRY_NAMES.has(country)) return true;
  // No country line at all — the blob ends on its "Town, Postcode" line. A
  // UK-format postcode is then the only signal, and none of the other countries
  // these manifests reach use that format.
  return UK_POSTCODE_RE.test(last);
}

export type AddressParts = { name: string; address: string; town: string; postcode: string; country: string };

const EMPTY_ADDRESS_PARTS: AddressParts = { name: '', address: '', town: '', postcode: '', country: '' };

// Shipper/consignee is stored as a single newline-separated blob: name, then
// address lines, then an optional "Town, Postcode" line, then an optional
// country line. The postcode is the only reliable anchor for where the
// address ends — without one, there's no way to tell a real country line
// from just another address line (e.g. a building/site name), so everything
// after the name stays folded into "address" rather than guessing.
export function parseAddressParts(value: string | null): AddressParts {
  if (!value) return EMPTY_ADDRESS_PARTS;
  const lines = value.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return EMPTY_ADDRESS_PARTS;
  const name = lines[0];
  if (lines.length === 1) return { ...EMPTY_ADDRESS_PARTS, name };
  const rest = lines.slice(1);
  for (let i = rest.length - 1; i >= 0; i--) {
    const line = rest[i];
    const match = line.match(UK_POSTCODE_RE) ?? line.match(EIRCODE_RE) ?? line.match(NUMERIC_POSTCODE_RE);
    if (match && match.index != null) {
      const postcode = match[0].toUpperCase();
      const before = line.slice(0, match.index).trim().replace(/,$/, '').trim();
      const town = before.split(',')[0].trim();
      const address = rest.slice(0, i).join(', ');
      const country = rest.slice(i + 1).join(', ');
      return { name, address, town, postcode, country };
    }
  }
  return { name, address: rest.join(', '), town: '', postcode: '', country: '' };
}

// Inverse of parseAddressParts — rejoins edited parts back into the
// newline-separated blob the backend expects for shipper/consignee.
export function buildAddress(parts: AddressParts): string {
  const lines: string[] = [];
  if (parts.name.trim()) lines.push(parts.name.trim());
  if (parts.address.trim()) lines.push(...parts.address.split('\n').map(s => s.trim()).filter(Boolean));
  const townPostcode = [parts.town.trim(), parts.postcode.trim()].filter(Boolean).join(', ');
  if (townPostcode) lines.push(townPostcode);
  if (parts.country.trim()) lines.push(parts.country.trim());
  return lines.join('\n');
}
