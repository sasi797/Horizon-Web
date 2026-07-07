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
