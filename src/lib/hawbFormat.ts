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

export function postcodeLine(value: string | null): string {
  if (!value) return '';
  const [, ...rest] = value.split('\n').map(s => s.trim()).filter(Boolean);
  for (const line of rest) {
    const match = line.match(UK_POSTCODE_RE) ?? line.match(EIRCODE_RE) ?? line.match(NUMERIC_POSTCODE_RE);
    if (match) return match[0].toUpperCase();
  }
  return '';
}
