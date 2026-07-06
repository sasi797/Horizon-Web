'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetHawbJobQuery, useGetHawbJobsQuery, useUpdateHawbJobMutation, useMarkHawbJobReadyMutation } from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import PdfViewer from '@/components/PdfViewer';

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  ready_to_manifest: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  manifested: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  ready_to_manifest: 'Ready to Manifest',
  manifested: 'Manifested',
};

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 16);
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: job, isLoading, isError, refetch } = useGetHawbJobQuery(id);
  const [updateJob] = useUpdateHawbJobMutation();
  const [markReady, { isLoading: markingReady }] = useMarkHawbJobReadyMutation();

  const { data: siblingsPage } = useGetHawbJobsQuery(
    { document_id: job?.document_id, page_size: 100 },
    { skip: !job }
  );
  const siblings = useMemo(() => {
    const items = siblingsPage?.items ?? [];
    return [...items].sort((a, b) => (a.page_start ?? 999) - (b.page_start ?? 999));
  }, [siblingsPage]);
  const siblingIndex = siblings.findIndex(s => s.id === id);
  const prevSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
  const nextSibling = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;

  const [form, setForm] = useState({
    shipper: '', consignee: '', collection_at: '', delivery_at: '',
    package_qty: '', weight_kg: '', dangerous_goods: false, dangerous_goods_notes: '',
    client_account: '', package_sequence: '',
    shipper_contact: '', shipper_phone: '', shipper_reference: '',
    consignee_contact: '', consignee_phone: '', consignee_reference: '',
    temperature_range: '', dimensions: '', volumetric_weight_kg: '',
    declared_value: '', declared_value_currency: '', direction: '', special_handling: '',
  });

  useEffect(() => {
    if (!job) return;
    setForm({
      shipper: job.shipper ?? '',
      consignee: job.consignee ?? '',
      collection_at: toDatetimeLocal(job.collection_at),
      delivery_at: toDatetimeLocal(job.delivery_at),
      package_qty: job.package_qty?.toString() ?? '',
      weight_kg: job.weight_kg?.toString() ?? '',
      dangerous_goods: job.dangerous_goods,
      dangerous_goods_notes: job.dangerous_goods_notes ?? '',
      client_account: job.client_account ?? '',
      package_sequence: job.package_sequence ?? '',
      shipper_contact: job.shipper_contact ?? '',
      shipper_phone: job.shipper_phone ?? '',
      shipper_reference: job.shipper_reference ?? '',
      consignee_contact: job.consignee_contact ?? '',
      consignee_phone: job.consignee_phone ?? '',
      consignee_reference: job.consignee_reference ?? '',
      temperature_range: job.temperature_range ?? '',
      dimensions: job.dimensions ?? '',
      volumetric_weight_kg: job.volumetric_weight_kg?.toString() ?? '',
      declared_value: job.declared_value?.toString() ?? '',
      declared_value_currency: job.declared_value_currency ?? '',
      direction: job.direction ?? '',
      special_handling: job.special_handling ?? '',
    });
  }, [job]);

  if (isLoading) {
    return <div className="h-[70vh] bg-white rounded-2xl border border-gray-100 animate-pulse" />;
  }
  if (isError || !job) {
    return <ApiErrorState title="Failed to load job" onRetry={refetch} />;
  }

  const locked = job.locked;

  const save = async (field: string, value: unknown) => {
    if (locked) return;
    try {
      await updateJob({ id: job.id, body: { [field]: value } }).unwrap();
    } catch {
      // reverts to server value on next refetch
    }
  };

  const handleReady = async () => {
    try {
      await markReady(job.id).unwrap();
    } catch {
      // no-op — error state left to future toast handling
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4 h-full flex flex-col">
      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push('/dashboard/jobs')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-black text-gray-900 leading-tight font-mono">{job.hawb_number}</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{job.document.filename}</p>
        </div>
        <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[job.status]}`}>
          {STATUS_LABEL[job.status]}
        </span>

        {siblings.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevSibling && router.push(`/dashboard/jobs/${prevSibling.id}`)}
              disabled={!prevSibling}
              className="text-[11px] font-bold text-gray-500 hover:text-amber-700 disabled:opacity-30 disabled:hover:text-gray-500 px-2 py-1 rounded-lg transition-colors"
            >
              ◀ Prev HAWB
            </button>
            <span className="text-[10.5px] text-gray-400 font-medium whitespace-nowrap">
              {siblingIndex + 1} of {siblings.length} in this document
            </span>
            <button
              onClick={() => nextSibling && router.push(`/dashboard/jobs/${nextSibling.id}`)}
              disabled={!nextSibling}
              className="text-[11px] font-bold text-gray-500 hover:text-amber-700 disabled:opacity-30 disabled:hover:text-gray-500 px-2 py-1 rounded-lg transition-colors"
            >
              Next HAWB ▶
            </button>
          </div>
        )}

        {job.status === 'pending_review' && (
          <button
            onClick={handleReady}
            disabled={markingReady}
            className="ml-auto text-[12px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-4 py-2 rounded-xl transition-colors"
          >
            {markingReady ? 'Marking ready…' : 'Ready to Manifest'}
          </button>
        )}
      </motion.div>

      <motion.div variants={staggerItem} className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[600px]">
        {/* PDF pane */}
        <div className="h-[70vh] lg:h-auto">
          <PdfViewer url={job.pdf_url} initialPage={job.page_start ?? 1} packageCount={job.packages.length} />
        </div>

        {/* Fields pane */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 overflow-y-auto">
          {locked && (
            <div className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              This job is locked in a manifest. Remove it from the manifest to edit.
            </div>
          )}

          <Field label="Shipper">
            <textarea
              disabled={locked}
              value={form.shipper}
              onChange={e => setForm(f => ({ ...f, shipper: e.target.value }))}
              onBlur={e => save('shipper', e.target.value || null)}
              rows={4}
              className={inputClass(locked)}
            />
          </Field>

          <Field label="Consignee">
            <textarea
              disabled={locked}
              value={form.consignee}
              onChange={e => setForm(f => ({ ...f, consignee: e.target.value }))}
              onBlur={e => save('consignee', e.target.value || null)}
              rows={4}
              className={inputClass(locked)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Collection">
              <input
                type="datetime-local"
                disabled={locked}
                value={form.collection_at}
                onChange={e => setForm(f => ({ ...f, collection_at: e.target.value }))}
                onBlur={e => save('collection_at', e.target.value ? `${e.target.value}:00` : null)}
                className={inputClass(locked)}
              />
            </Field>
            <Field label="Delivery">
              <input
                type="datetime-local"
                disabled={locked}
                value={form.delivery_at}
                onChange={e => setForm(f => ({ ...f, delivery_at: e.target.value }))}
                onBlur={e => save('delivery_at', e.target.value ? `${e.target.value}:00` : null)}
                className={inputClass(locked)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Package Qty">
              <input
                type="number"
                disabled={locked}
                value={form.package_qty}
                onChange={e => setForm(f => ({ ...f, package_qty: e.target.value }))}
                onBlur={e => save('package_qty', e.target.value ? Number(e.target.value) : null)}
                className={inputClass(locked)}
              />
            </Field>
            <Field label="Weight (kg)">
              <input
                type="number"
                step="0.01"
                disabled={locked}
                value={form.weight_kg}
                onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                onBlur={e => save('weight_kg', e.target.value ? Number(e.target.value) : null)}
                className={inputClass(locked)}
              />
            </Field>
          </div>

          <Field label="Dangerous Goods">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={locked}
                checked={form.dangerous_goods}
                onChange={e => {
                  setForm(f => ({ ...f, dangerous_goods: e.target.checked }));
                  save('dangerous_goods', e.target.checked);
                }}
                className="rounded cursor-pointer"
              />
              <span className="text-[12px] text-gray-600">Flagged as dangerous goods</span>
            </label>
          </Field>

          {form.dangerous_goods && (
            <Field label="DG Notes">
              <textarea
                disabled={locked}
                value={form.dangerous_goods_notes}
                onChange={e => setForm(f => ({ ...f, dangerous_goods_notes: e.target.value }))}
                onBlur={e => save('dangerous_goods_notes', e.target.value || null)}
                rows={2}
                className={inputClass(locked)}
              />
            </Field>
          )}

          <div className="pt-2 border-t border-gray-100">
            <p className="text-[11px] font-black text-gray-500 uppercase tracking-wide mb-3">Additional Details</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client Account">
                  <input disabled={locked} value={form.client_account}
                    onChange={e => setForm(f => ({ ...f, client_account: e.target.value }))}
                    onBlur={e => save('client_account', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
                <Field label="Package Sequence">
                  <input disabled={locked} value={form.package_sequence}
                    onChange={e => setForm(f => ({ ...f, package_sequence: e.target.value }))}
                    onBlur={e => save('package_sequence', e.target.value || null)}
                    placeholder="e.g. 1 of 1"
                    className={inputClass(locked)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Shipper Contact">
                  <input disabled={locked} value={form.shipper_contact}
                    onChange={e => setForm(f => ({ ...f, shipper_contact: e.target.value }))}
                    onBlur={e => save('shipper_contact', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
                <Field label="Shipper Phone">
                  <input disabled={locked} value={form.shipper_phone}
                    onChange={e => setForm(f => ({ ...f, shipper_phone: e.target.value }))}
                    onBlur={e => save('shipper_phone', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
              </div>
              <Field label="Shipper Reference">
                <input disabled={locked} value={form.shipper_reference}
                  onChange={e => setForm(f => ({ ...f, shipper_reference: e.target.value }))}
                  onBlur={e => save('shipper_reference', e.target.value || null)}
                  className={inputClass(locked)} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Consignee Contact">
                  <input disabled={locked} value={form.consignee_contact}
                    onChange={e => setForm(f => ({ ...f, consignee_contact: e.target.value }))}
                    onBlur={e => save('consignee_contact', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
                <Field label="Consignee Phone">
                  <input disabled={locked} value={form.consignee_phone}
                    onChange={e => setForm(f => ({ ...f, consignee_phone: e.target.value }))}
                    onBlur={e => save('consignee_phone', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
              </div>
              <Field label="Consignee Reference">
                <input disabled={locked} value={form.consignee_reference}
                  onChange={e => setForm(f => ({ ...f, consignee_reference: e.target.value }))}
                  onBlur={e => save('consignee_reference', e.target.value || null)}
                  className={inputClass(locked)} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Temperature Range">
                  <input disabled={locked} value={form.temperature_range}
                    onChange={e => setForm(f => ({ ...f, temperature_range: e.target.value }))}
                    onBlur={e => save('temperature_range', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
                <Field label="Dimensions (cm)">
                  <input disabled={locked} value={form.dimensions}
                    onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))}
                    onBlur={e => save('dimensions', e.target.value || null)}
                    className={inputClass(locked)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Volumetric Weight (kg)">
                  <input type="number" step="0.01" disabled={locked} value={form.volumetric_weight_kg}
                    onChange={e => setForm(f => ({ ...f, volumetric_weight_kg: e.target.value }))}
                    onBlur={e => save('volumetric_weight_kg', e.target.value ? Number(e.target.value) : null)}
                    className={inputClass(locked)} />
                </Field>
                <Field label="Direction">
                  <select disabled={locked} value={form.direction}
                    onChange={e => { setForm(f => ({ ...f, direction: e.target.value })); save('direction', e.target.value || null); }}
                    className={inputClass(locked)}>
                    <option value="">—</option>
                    <option value="Inbound">Inbound</option>
                    <option value="Outbound">Outbound</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Declared Value">
                  <input type="number" step="0.01" disabled={locked} value={form.declared_value}
                    onChange={e => setForm(f => ({ ...f, declared_value: e.target.value }))}
                    onBlur={e => save('declared_value', e.target.value ? Number(e.target.value) : null)}
                    className={inputClass(locked)} />
                </Field>
                <Field label="Currency">
                  <input disabled={locked} value={form.declared_value_currency}
                    onChange={e => setForm(f => ({ ...f, declared_value_currency: e.target.value.toUpperCase() }))}
                    onBlur={e => save('declared_value_currency', e.target.value || null)}
                    placeholder="GBP"
                    className={inputClass(locked)} />
                </Field>
              </div>

              <Field label="Special Handling">
                <textarea disabled={locked} value={form.special_handling}
                  onChange={e => setForm(f => ({ ...f, special_handling: e.target.value }))}
                  onBlur={e => save('special_handling', e.target.value || null)}
                  rows={5}
                  className={inputClass(locked)} />
              </Field>

              {job.packages.length > 0 && (
                <Field label="Package Lines">
                  <div className="space-y-1.5">
                    {job.packages.map((p, i) => (
                      <div key={i} className="text-[12px] text-gray-700 bg-gray-50/60 border border-gray-100 rounded-lg px-3 py-2">
                        {[p.supplier, p.package_type, p.weight_kg != null ? `${p.weight_kg} kg` : null, p.content_description]
                          .filter(Boolean).join(' · ')}
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function inputClass(locked: boolean) {
  return `w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/60 text-gray-700 focus:outline-none focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100 transition-all ${
    locked ? 'opacity-60 cursor-not-allowed' : ''
  }`;
}
