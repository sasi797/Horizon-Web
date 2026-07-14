'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Package, Weight, CalendarDays, User, MapPin, CheckCircle2, Clock3, Hash, Tag, Check, X, FileText } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetHawbManifestsQuery, useGetJobUpdatesQuery, useApplyJobUpdateMutation, useDismissJobUpdateMutation,
  type HawbManifest, type HawbJob, type HawbJobPendingUpdate,
} from '@/services/hawbApi';
import { useManifestsLiveRefresh } from '@/hooks/useManifestsLiveRefresh';
import ApiErrorState from '@/components/ApiErrorState';

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/60',
  open: 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300 ring-1 ring-gray-200 dark:ring-navy-700',
  booked: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/60',
  confirmed: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
  on_hold: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/60',
  exported: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  open: 'Open',
  booked: 'Booked',
  confirmed: 'Confirmed',
  on_hold: 'On Hold',
  exported: 'Exported',
};

function BlindBadge({ sourceKind, className = '' }: { sourceKind: HawbManifest['source_kind']; className?: string }) {
  if (sourceKind !== 'blind') return null;
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/60 ${className}`}>
      Blind
    </span>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} ${time}`;
}

function initials(name: string | null): string {
  if (!name) return 'SY';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function routeLabel(m: HawbManifest): string {
  return `${m.start_point || '—'} → ${m.end_point || '—'}`;
}

const UPDATE_FIELD_LABELS: Record<string, string> = {
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

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function computeFieldDiff(job: HawbJob, proposed: Record<string, unknown>) {
  const diffs: { field: string; label: string; oldValue: string; newValue: string }[] = [];
  for (const [field, label] of Object.entries(UPDATE_FIELD_LABELS)) {
    const oldStr = formatFieldValue((job as unknown as Record<string, unknown>)[field]);
    const newStr = formatFieldValue(proposed[field]);
    if (oldStr !== newStr) diffs.push({ field, label, oldValue: oldStr, newValue: newStr });
  }
  return diffs;
}

const UPDATE_REASON_LABEL: Record<HawbJobPendingUpdate['reason'], string> = {
  duplicate_resend: 'Duplicate resend',
  blind_companion_merge: 'Blind companion match',
};

function JobUpdateCard({ update }: { update: HawbJobPendingUpdate }) {
  const [applyUpdate, { isLoading: applying }] = useApplyJobUpdateMutation();
  const [dismissUpdate, { isLoading: dismissing }] = useDismissJobUpdateMutation();
  const diffs = computeFieldDiff(update.job, update.proposed_data);
  const busy = applying || dismissing;

  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[13px]">{update.job.hawb_number}</span>
          <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full ${
            update.reason === 'blind_companion_merge'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/60'
              : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/60'
          }`}>
            {UPDATE_REASON_LABEL[update.reason]}
          </span>
          {update.job.locked && (
            <span className="inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/60">
              Manifest already exported
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-[10.5px] text-gray-400 dark:text-navy-500">
          <FileText size={11} /> {update.source_document.filename}
        </span>
      </div>

      {diffs.length > 0 ? (
        <div className="mt-3 rounded-xl border border-gray-100 dark:border-navy-800 divide-y divide-gray-100 dark:divide-navy-800 overflow-hidden">
          {diffs.map(d => (
            <div key={d.field} className="grid grid-cols-[130px_1fr_16px_1fr] items-center gap-2 px-3 py-1.5 text-[11.5px]">
              <span className="font-bold text-gray-500 dark:text-navy-400">{d.label}</span>
              <span className="text-gray-400 dark:text-navy-500 line-through truncate">{d.oldValue}</span>
              <ChevronRight size={12} className="text-gray-300 dark:text-navy-600" />
              <span className="text-gray-800 dark:text-gray-100 font-semibold truncate">{d.newValue}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] text-gray-400 dark:text-navy-500">No field-level differences detected — new packages/notes data may still apply.</p>
      )}

      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={() => dismissUpdate(update.id)}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-navy-400 bg-gray-50 dark:bg-navy-800 hover:bg-gray-100 dark:hover:bg-navy-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
        >
          <X size={12} /> Dismiss
        </button>
        <button
          onClick={() => applyUpdate(update.id)}
          disabled={busy}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Check size={12} /> {applying ? 'Applying…' : 'Apply update'}
        </button>
      </div>
    </div>
  );
}

export default function ManifestsPage() {
  const [tab, setTab] = useState<'manifests' | 'updates'>('manifests');
  const { data: manifests = [], isLoading, isError, refetch } = useGetHawbManifestsQuery();
  const { data: jobUpdates = [], isLoading: updatesLoading, isError: updatesError, refetch: refetchUpdates } = useGetJobUpdatesQuery();
  const [layout, setLayout] = useState<1 | 2 | 3>(1);
  useManifestsLiveRefresh();

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Manifests</h1>
          <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
            {tab === 'updates' ? `${jobUpdates.length} pending updates` : `${manifests.length} manifests`}
          </p>
        </div>
        <div className="flex items-center gap-0.5 bg-gray-50 dark:bg-navy-800 rounded-lg p-0.5 shrink-0">
          {([1, 2, 3] as const).map(n => (
            <button
              key={n}
              onClick={() => setLayout(n)}
              title={`Layout ${n}`}
              className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${
                layout === n
                  ? 'bg-white dark:bg-navy-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-1 border-b border-gray-100 dark:border-navy-800">
        {([
          { key: 'manifests' as const, label: 'Manifests' },
          { key: 'updates' as const, label: 'Updates', count: jobUpdates.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[12px] font-bold border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              tab === t.key
                ? 'border-emerald-500 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300'
            }`}
          >
            {t.label}
            {!!t.count && t.count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-red-500 text-white">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {tab === 'updates' ? (
        updatesLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 animate-pulse" />
            ))}
          </div>
        ) : updatesError ? (
          <ApiErrorState title="Failed to load pending updates" onRetry={refetchUpdates} />
        ) : jobUpdates.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-300 dark:text-navy-600 text-sm bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800">
            No pending updates
          </div>
        ) : (
          <motion.div variants={staggerItem} className="space-y-3">
            {jobUpdates.map(u => <JobUpdateCard key={u.id} update={u} />)}
          </motion.div>
        )
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load manifests" onRetry={refetch} />
      ) : manifests.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 dark:text-navy-600 text-sm bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800">
          No manifests yet
        </div>
      ) : layout === 1 ? (
        /* Layout 1 — enhanced data table */
        <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-navy-700">
                  {[
                    { label: 'Reference', icon: Hash },
                    { label: 'Status', icon: Tag },
                    { label: 'Jobs', icon: Package },
                    { label: 'Total Weight (kg)', icon: Weight },
                    { label: 'Operator', icon: User },
                    { label: 'Created', icon: CalendarDays },
                  ].map(h => (
                    <th key={h.label} className="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-navy-400 uppercase tracking-wider whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <h.icon size={15} className="text-gray-400 dark:text-navy-500" />
                        {h.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-navy-700">
                {manifests.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/70 dark:hover:bg-navy-800/50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Link href={`/dashboard/manifests/${m.id}`} className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12px] hover:underline">
                        {m.reference_number}
                      </Link>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center text-[9.5px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[m.status]}`}>
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-gray-800 dark:text-navy-200">{m.job_count}</td>
                    <td className="px-4 py-4 text-[12px] font-semibold text-gray-800 dark:text-navy-200">{m.total_weight_kg}</td>
                    <td className="px-4 py-4 text-[11.5px] font-medium text-gray-700 dark:text-navy-300 whitespace-nowrap">{m.created_by_name ?? 'System'}</td>
                    <td className="px-4 py-4 text-[11px] font-medium text-gray-600 dark:text-navy-400 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : layout === 2 ? (
        /* Layout 2 — card grid */
        <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {manifests.map(m => (
            <Link
              key={m.id}
              href={`/dashboard/manifests/${m.id}`}
              className="block bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm p-4 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800/60 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[13px]">{m.reference_number}</span>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <BlindBadge sourceKind={m.source_kind} />
                  <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[m.status]}`}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </span>
              </div>

              <p className="flex items-center gap-1 text-[10.5px] text-gray-400 dark:text-navy-500 mt-2.5">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{routeLabel(m)}</span>
              </p>

              <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-gray-100 dark:border-navy-800">
                <div>
                  <p className="text-[8.5px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide flex items-center gap-1"><Package size={9} /> Jobs</p>
                  <p className="text-[12px] font-black text-gray-800 dark:text-gray-100 mt-0.5">{m.job_count}</p>
                </div>
                <div>
                  <p className="text-[8.5px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide flex items-center gap-1"><Weight size={9} /> Weight</p>
                  <p className="text-[12px] font-black text-gray-800 dark:text-gray-100 mt-0.5">{m.total_weight_kg} kg</p>
                </div>
                <div>
                  <p className="text-[8.5px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide flex items-center gap-1"><CalendarDays size={9} /> Created</p>
                  <p className="text-[12px] font-black text-gray-800 dark:text-gray-100 mt-0.5">{formatDate(m.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3.5 text-[10px] text-gray-400 dark:text-navy-500">
                <span className="w-[18px] h-[18px] rounded-full bg-navy-800 dark:bg-navy-700 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                  {initials(m.created_by_name)}
                </span>
                <span className="truncate">{m.created_by_name ?? 'System'}</span>
                {m.exported_at && (
                  <span className="ml-auto inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 size={11} /> {formatDate(m.exported_at)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </motion.div>
      ) : (
        /* Layout 3 — status-striped list rows */
        <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-navy-800">
          {manifests.map(m => (
            <Link
              key={m.id}
              href={`/dashboard/manifests/${m.id}`}
              className="group relative flex items-center gap-4 pl-5 pr-4 py-3.5 hover:bg-gray-50/70 dark:hover:bg-navy-800/50 transition-colors"
            >
              <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${m.status === 'exported' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-navy-600'}`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12.5px] shrink-0">{m.reference_number}</span>
                  <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[m.status]}`}>
                    {STATUS_LABEL[m.status]}
                  </span>
                  <BlindBadge sourceKind={m.source_kind} />
                </div>
                <div className="flex items-center gap-1 mt-1 min-w-0">
                  <MapPin size={10} className="text-gray-300 dark:text-navy-600 shrink-0" />
                  <span className="text-[10.5px] text-gray-400 dark:text-navy-500 truncate">{routeLabel(m)}</span>
                </div>
              </div>

              <div className="hidden sm:grid grid-cols-[44px_72px_130px_92px] items-center gap-0 shrink-0 pl-5 ml-1 border-l border-gray-100 dark:border-navy-800 text-[11px] text-gray-600 dark:text-navy-300">
                <span className="flex items-center gap-1.5"><Package size={12} className="text-gray-300 dark:text-navy-600" /> {m.job_count}</span>
                <span className="flex items-center gap-1.5"><Weight size={12} className="text-gray-300 dark:text-navy-600" /> {m.total_weight_kg}kg</span>
                <span className="flex items-center gap-1.5 min-w-0 pr-2">
                  <span className="w-4 h-4 rounded-full bg-navy-800 dark:bg-navy-700 text-white flex items-center justify-center text-[7px] font-bold shrink-0">
                    {initials(m.created_by_name)}
                  </span>
                  <span className="truncate">{m.created_by_name ?? 'System'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {m.status === 'exported' ? <CheckCircle2 size={12} className="text-emerald-500 shrink-0" /> : <Clock3 size={12} className="text-gray-300 dark:text-navy-600 shrink-0" />}
                  {m.status === 'exported' && m.exported_at ? formatDate(m.exported_at) : formatDate(m.created_at)}
                </span>
              </div>

              <ChevronRight size={14} className="text-gray-300 dark:text-navy-600 shrink-0 transition-colors group-hover:text-emerald-500" />
            </Link>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
