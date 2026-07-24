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
