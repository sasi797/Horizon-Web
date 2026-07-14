import type { HawbJob } from '@/services/hawbApi';

export const UPDATE_FIELD_LABELS: Record<string, string> = {
  shipper: 'Shipper',
  consignee: 'Consignee',
  collection_at: 'Collection',
  delivery_at: 'Delivery',
  package_qty: 'Package Qty',
  weight_kg: 'Weight (kg)',
  dangerous_goods: 'Dangerous Goods',
  dangerous_goods_notes: 'DG Notes',
  client_account: 'Client Account',
  package_sequence: 'Package Sequence',
  shipper_contact: 'Shipper Contact',
  shipper_phone: 'Shipper Phone',
  shipper_reference: 'Shipper Reference',
  consignee_contact: 'Consignee Contact',
  consignee_phone: 'Consignee Phone',
  consignee_reference: 'Consignee Reference',
  temperature_range: 'Temperature',
  dimensions: 'Dimensions',
  volumetric_weight_kg: 'Vol. Weight (kg)',
  declared_value: 'Declared Value',
  declared_value_currency: 'Currency',
  direction: 'Direction',
  special_handling: 'Special Handling',
};

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function computeFieldDiff(job: HawbJob, proposed: Record<string, unknown>) {
  const diffs: { field: string; label: string; oldValue: string; newValue: string }[] = [];
  for (const [field, label] of Object.entries(UPDATE_FIELD_LABELS)) {
    const oldStr = formatFieldValue((job as unknown as Record<string, unknown>)[field]);
    const newStr = formatFieldValue(proposed[field]);
    if (oldStr !== newStr) diffs.push({ field, label, oldValue: oldStr, newValue: newStr });
  }
  return diffs;
}
