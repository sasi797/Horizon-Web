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

export type AddressParts = { name: string; address: string; town: string; postcode: string; country: string };

const EMPTY_ADDRESS_PARTS: AddressParts = { name: '', address: '', town: '', postcode: '', country: '' };

// Shipper/consignee is stored as a single newline-separated blob (first line
// company name, last line country). Splits it into editable parts by scanning
// the lines between name and country for a postcode, same heuristic as
// cityAndPostcodeLine — everything else in between becomes "address".
export function parseAddressParts(value: string | null): AddressParts {
  if (!value) return EMPTY_ADDRESS_PARTS;
  const lines = value.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return EMPTY_ADDRESS_PARTS;
  const name = lines[0];
  if (lines.length === 1) return { ...EMPTY_ADDRESS_PARTS, name };
  const country = lines[lines.length - 1];
  const middle = lines.slice(1, lines.length - 1);
  for (let i = middle.length - 1; i >= 0; i--) {
    const line = middle[i];
    const match = line.match(UK_POSTCODE_RE) ?? line.match(EIRCODE_RE) ?? line.match(NUMERIC_POSTCODE_RE);
    if (match && match.index != null) {
      const postcode = match[0].toUpperCase();
      const before = line.slice(0, match.index).trim().replace(/,$/, '').trim();
      const town = before.split(',')[0].trim();
      const address = [...middle.slice(0, i), ...middle.slice(i + 1)].join(', ');
      return { name, address, town, postcode, country };
    }
  }
  return { name, address: middle.join(', '), town: '', postcode: '', country };
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
