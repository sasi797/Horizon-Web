'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, FileDown, TriangleAlert, FileText, ExternalLink, Clock, Thermometer, Package as PackageIcon, Banknote, Building2, MapPin, Phone, Hash, RefreshCw, Navigation, Flag, Ban, List, Combine, Weight, CalendarClock, Truck, Ungroup, RotateCcw } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetHawbManifestQuery,
  useUpdateHawbManifestMutation,
  useUpdateHawbJobMutation,
  useReorderManifestJobsMutation,
  useCancelManifestMutation,
  useReopenManifestMutation,
  useRetryManifestExtractionMutation,
  useIndigoExportManifestMutation,
  useGetJobUpdatesQuery,
  useApplyJobUpdateMutation,
  type HawbJob,
  type HawbManifestDetail,
} from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import Tooltip from '@/components/Tooltip';
import ConfirmDialog from '@/components/ConfirmDialog';
import { splitAddress, cityLine, cityAndPostcodeLine, parseAddressParts, buildAddress, addressIdentityKey, isUkAddress, type AddressParts } from '@/lib/hawbFormat';
import { useGetDropdownValuesQuery } from '@/services/dropdownApi';

const MANIFEST_STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  open: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  booked: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  on_hold: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  exported: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  cancelled: 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400',
  extracting: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  failed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  ignored: 'bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-navy-400',
};

const MANIFEST_STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  open: 'Open',
  booked: 'Booked',
  confirmed: 'Confirmed',
  on_hold: 'On Hold',
  exported: 'Exported',
  cancelled: 'Cancelled',
  extracting: 'Extracting…',
  failed: 'Extraction Failed',
  ignored: 'Ignored (duplicate)',
};

// collection_at/delivery_at are wall-clock times extracted from the HAWB PDF,
// stored with a fake UTC tag purely to fit a timestamptz column (see
// hawb_ingest._parse_dt) — they aren't real UTC instants. Reading the digits
// straight out of the ISO string keeps this in sync with toDatetimeLocal
// below and avoids the browser silently "converting" to its local timezone.
function formatTime(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return '—';
  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

// Unlike formatTime above, created_at is a real UTC instant (an audit
// timestamp, not a wall-clock value lifted from the PDF), so it's fine —
// correct, even — to let the browser convert it to local time here.
function formatDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 16);
}

// A merged group's Coll./Del./Service columns only show one value when every
// member agrees — otherwise there's no single answer to display, so it falls
// back to "Mixed" rather than picking one member arbitrarily.
function commonValue<T>(values: T[]): T | 'Mixed' {
  return values.every(v => v === values[0]) ? values[0] : 'Mixed';
}

function pageRangeLabel(job: HawbJob): string | null {
  if (job.page_start == null) return null;
  const count = job.packages.length || 1;
  const end = job.page_start + count - 1;
  return count > 1 ? `Pages ${job.page_start}–${end}` : `Page ${job.page_start}`;
}

function Skel({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-gray-100 dark:bg-navy-800 ${className}`} />;
}

function ManifestDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Skel className="w-7 h-7 rounded-md shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skel className="w-28 h-4" />
              <Skel className="w-20 h-5 rounded-full" />
            </div>
            <Skel className="w-64 h-3" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skel className="w-32 h-7 rounded-md" />
          <Skel className="w-24 h-7 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-4 py-3">
            <Skel className="w-8 h-8 rounded-lg shrink-0" />
            <div className="min-w-0 space-y-1.5 flex-1">
              <Skel className="w-16 h-2" />
              <Skel className="w-12 h-4" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-4 py-3 space-y-1.5">
            <Skel className="w-24 h-2" />
            <Skel className="w-full h-9 rounded-xl" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-4 py-3 space-y-1.5">
            <Skel className="w-24 h-2" />
            <Skel className="w-full h-9 rounded-xl" />
          </div>
        ))}
      </div>

      <div className="flex flex-col bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-navy-800 space-y-1.5">
          <Skel className="w-20 h-3" />
          <Skel className="w-48 h-2.5" />
        </div>
        <div className="divide-y divide-gray-50 dark:divide-navy-800/70">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Skel className="w-4 h-2.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skel className="w-24 h-2.5" />
                <Skel className="w-40 h-2" />
              </div>
              <Skel className="w-8 h-2.5 shrink-0" />
              <Skel className="w-8 h-2.5 shrink-0" />
              <Skel className="w-24 h-6 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Shown instead of the full field-editor/job-table layout for a manifest that
// has no jobs yet — either still extracting, or extraction landed on nothing
// to manifest (a real failure, or every HAWB turned out to be a duplicate).
// Reachable by direct URL even though the manifests table keeps these rows
// non-clickable.
function ManifestPlaceholderState({ manifest, onBack }: { manifest: HawbManifestDetail; onBack: () => void }) {
  const [retryExtraction, { isLoading: retrying }] = useRetryManifestExtractionMutation();
  const isFailed = manifest.status === 'failed';
  const isIgnored = manifest.status === 'ignored';

  return (
    <div className="flex flex-col items-center gap-3 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 py-16 px-6 text-center">
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-500 dark:text-navy-400 hover:text-gray-800 dark:hover:text-navy-100 transition-colors mb-2"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to manifests
      </button>
      <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full ${MANIFEST_STATUS_BADGE[manifest.status]}`}>
        {isFailed || isIgnored ? <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" /> : <RefreshCw size={9} className="animate-spin" />}
        {MANIFEST_STATUS_LABEL[manifest.status]}
      </span>
      <h1 className="text-[13px] font-bold text-gray-700 dark:text-navy-200">{manifest.document.filename}</h1>
      {isIgnored ? (
        <p className="text-[12px] text-gray-500 dark:text-navy-500 max-w-sm">
          {manifest.remarks ?? 'This filename was already ingested previously, so it was not re-extracted.'} This is a resend, not a failure, so there&apos;s no retry — if this file genuinely has new content, it needs to arrive under a different filename.
        </p>
      ) : isFailed ? (
        <>
          <p className="text-[12px] text-gray-500 dark:text-navy-500 max-w-sm">
            {manifest.remarks ?? 'Extraction failed for this document, so there is nothing to manifest yet.'} Retry to re-process the PDF already on file — no need to resend the email.
          </p>
          <button
            type="button"
            onClick={() => retryExtraction(manifest.id)}
            disabled={retrying}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 pl-2 pr-3 py-1 rounded-md transition-colors"
          >
            <RefreshCw size={11} strokeWidth={2.25} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Retrying…' : 'Retry extraction'}
          </button>
        </>
      ) : (
        <p className="text-[12px] text-gray-500 dark:text-navy-500 max-w-sm">
          Extraction is still in progress — this page will update automatically once it finishes.
        </p>
      )}
    </div>
  );
}

const ROW1_ICON_TONE = 'text-gray-400 dark:text-navy-500';
const ROW2_ICON_TONE = 'text-emerald-500 dark:text-emerald-400';

function PropLabel({
  icon: Icon, iconTone, children, required,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  iconTone?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <p className="flex items-center gap-1 text-[9.5px] font-semibold text-gray-500/85 dark:text-navy-400/85 uppercase tracking-wide mb-1">
      {Icon && <Icon size={10} className={`shrink-0 ${iconTone ?? ''}`} />}
      {children}
      {required && <span className="w-1 h-1 rounded-full bg-red-500 dark:bg-red-400 shrink-0" />}
    </p>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className="text-gray-500 dark:text-navy-500" />
        <p className="text-[10px] font-black text-gray-500 dark:text-navy-400 uppercase tracking-wide">{title}</p>
      </div>
      {children}
    </div>
  );
}

// The literal placeholder text an OCR extractor drops in for a redacted
// blinded-trial shipper/consignee block — not a usable value for a driver
// run sheet. Blank fields are allowed through (e.g. addresses that
// legitimately have no separate town/postcode line).
function isBlinded(value: string): boolean {
  return value.trim().toLowerCase().includes('blinded data');
}

function AddressFields({
  value, locked, onChange, onSave,
}: {
  value: string;
  locked: boolean;
  onChange: (raw: string) => void;
  onSave: (raw: string) => void;
}) {
  const [parts, setParts] = useState<AddressParts>(() => parseAddressParts(value));

  const update = (patch: Partial<AddressParts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(buildAddress(next));
  };

  const commit = () => onSave(buildAddress(parts));

  return (
    <div className="space-y-3">
      <Field label="Company Name">
        <input disabled={locked} value={parts.name}
          onChange={e => update({ name: e.target.value })}
          onBlur={commit}
          className={inputClass(locked, isBlinded(parts.name))} />
      </Field>
      <Field label="Address">
        <textarea disabled={locked} value={parts.address} rows={2}
          onChange={e => update({ address: e.target.value })}
          onBlur={commit}
          className={inputClass(locked, isBlinded(parts.address))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Town">
          <input disabled={locked} value={parts.town}
            onChange={e => update({ town: e.target.value })}
            onBlur={commit}
            className={inputClass(locked, isBlinded(parts.town))} />
        </Field>
        <Field label="Postcode">
          <input disabled={locked} value={parts.postcode}
            onChange={e => update({ postcode: e.target.value })}
            onBlur={commit}
            className={inputClass(locked, isBlinded(parts.postcode))} />
        </Field>
      </div>
      <Field label="Country">
        <input disabled={locked} value={parts.country}
          onChange={e => update({ country: e.target.value })}
          onBlur={commit}
          className={inputClass(locked, isBlinded(parts.country))} />
      </Field>
    </div>
  );
}

function inputClass(locked: boolean, invalid?: boolean) {
  const base = 'w-full text-[13px] border rounded-xl px-3 py-1.5 bg-gray-50/60 dark:bg-navy-800/60 text-black dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:bg-white dark:focus:bg-navy-800 focus:ring-2 transition-all';
  const state = invalid && !locked
    ? 'field-invalid border-red-400 dark:border-red-500 focus:border-red-400 dark:focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-900/40'
    : 'border-gray-200 dark:border-navy-700 focus:border-emerald-300 dark:focus:border-emerald-600 focus:ring-emerald-100 dark:focus:ring-emerald-900/40';
  return `${base} ${state} ${locked ? 'opacity-60 cursor-not-allowed' : ''}`;
}

const TAG_CLASSES: Record<'gray' | 'blue' | 'purple', string> = {
  gray: 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300',
  blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
};

function LocationSelect({
  value, options, disabled, onChange, tag, emptyLabel = 'Empty',
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
  tag?: 'gray' | 'blue' | 'purple';
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <Tooltip content={selected?.label} side="top" className="block">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={`group w-full flex items-center justify-between gap-1.5 text-left rounded-md -mx-2 px-2 py-1.5 transition-colors ${
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50 dark:hover:bg-navy-800/60'
          } ${open ? 'bg-gray-50 dark:bg-navy-800/60' : ''}`}
        >
          {selected ? (
            tag ? (
              <span className={`truncate text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${TAG_CLASSES[tag]}`}>{selected.label}</span>
            ) : (
              <span className="truncate text-[12.5px] font-medium text-gray-800 dark:text-gray-100">{selected.label}</span>
            )
          ) : (
            <span className="truncate text-[12.5px] text-gray-300 dark:text-navy-600">{emptyLabel}</span>
          )}
          <ChevronDown size={12} className={`text-gray-400 dark:text-navy-500 shrink-0 transition-all ${open ? 'opacity-100 rotate-180' : 'opacity-0 group-hover:opacity-100'}`} />
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute z-20 mt-1.5 w-full max-h-60 overflow-y-auto bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-xl shadow-lg py-1"
          >
            {options.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-gray-500 dark:text-navy-500">No locations available</p>
            )}
            {options.map(o => {
              const isSelected = o.value === value;
              return (
                <Tooltip key={o.value} content={o.label} side="right" className="block">
                  <button
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-[12.5px] transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && <Check size={13} className="shrink-0" />}
                  </button>
                </Tooltip>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type JobServiceType = 'delivery' | 'collection' | 'collection_and_delivery';

const SERVICE_TYPE_OPTIONS: { value: JobServiceType; label: string; short: string }[] = [
  { value: 'delivery', label: 'Delivery', short: 'Del' },
  { value: 'collection', label: 'Collection', short: 'Coll' },
];

// Del/Coll follows the route's UK leg — these are UK driver runs, so a UK
// "From" means the driver collects and a UK "To" means the driver delivers.
// Domestic UK-to-UK could be either (and neither end in the UK is not this
// driver's job at all), so both those cases stay unset for a person to pick.
function defaultServiceType(job: HawbJob): JobServiceType | null {
  const fromUk = isUkAddress(job.shipper);
  const toUk = isUkAddress(job.consignee);
  if (fromUk === toUk) return null;
  return fromUk ? 'collection' : 'delivery';
}

function ServiceTypePicker({
  value, disabled, onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: JobServiceType) => void;
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50/70 dark:bg-navy-800/60 p-0.5 gap-0.5 shrink-0"
    >
      {SERVICE_TYPE_OPTIONS.map(opt => (
        <Tooltip key={opt.value} content={opt.label} side="bottom">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`px-1.5 py-1 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap ${
              value === opt.value
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-700'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {opt.short}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

type JobForm = {
  shipper: string; consignee: string; collection_at: string; delivery_at: string;
  package_qty: string; weight_kg: string; dangerous_goods: boolean; dangerous_goods_notes: string;
  client_account: string; package_sequence: string;
  shipper_contact: string; shipper_phone: string; shipper_reference: string;
  consignee_contact: string; consignee_phone: string; consignee_reference: string;
  temperature_range: string; dimensions: string; volumetric_weight_kg: string;
  declared_value: string; declared_value_currency: string; direction: string; special_handling: string;
  job_service_type: string;
};

function formFromJob(job: HawbJob): JobForm {
  return {
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
    job_service_type: job.job_service_type ?? '',
  };
}

export default function ManifestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: manifest, isLoading, isError, refetch } = useGetHawbManifestQuery(id);
  const [updateManifest] = useUpdateHawbManifestMutation();
  const [updateJob] = useUpdateHawbJobMutation();
  const [reorderJobs] = useReorderManifestJobsMutation();
  const [indigoExportManifest] = useIndigoExportManifestMutation();
  const [payloadBuilt, setPayloadBuilt] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cancelManifest, { isLoading: cancelling }] = useCancelManifestMutation();
  const [reopenManifest, { isLoading: reopening }] = useReopenManifestMutation();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { data: jobUpdates = [] } = useGetJobUpdatesQuery();
  const [applyJobUpdate] = useApplyJobUpdateMutation();
  const { data: savedStartPoints = [] } = useGetDropdownValuesQuery({ module: 'manifest', field_name: 'start_point' });
  const { data: savedEndPoints = [] } = useGetDropdownValuesQuery({ module: 'manifest', field_name: 'end_point' });
  const { data: savedAccountNumbers = [] } = useGetDropdownValuesQuery({ module: 'manifest', field_name: 'account_number' });
  const { data: savedServiceTypes = [] } = useGetDropdownValuesQuery({ module: 'manifest', field_name: 'service_type' });
  const { data: savedVehicleSizes = [] } = useGetDropdownValuesQuery({ module: 'manifest', field_name: 'vehicle_size' });

  const [orderedJobs, setOrderedJobs] = useState<HawbJob[]>([]);
  const [syncedJobs, setSyncedJobs] = useState<HawbJob[] | undefined>(undefined);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [runOrderView, setRunOrderView] = useState<'list' | 'merge'>('list');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [jobForm, setJobForm] = useState<JobForm | null>(null);
  const [syncedFormFor, setSyncedFormFor] = useState<string | null>(null);
  const [manifestFields, setManifestFields] = useState({
    start_point: '', end_point: '', job_reference: '', account_number: '', vehicle_size: '',
    service_type: '',
  });
  const [syncedPointsFor, setSyncedPointsFor] = useState<string | undefined>(undefined);

  // Auto-apply pending blind-companion/duplicate merges as soon as they're seen —
  // no manual "Apply" click needed. Already-exported (locked) jobs are the one
  // exception: those stay manual so an already-sent manifest is never silently
  // rewritten without a person choosing to.
  const autoAppliedRef = useRef<Set<string>>(new Set());
  const manifestJobIds = new Set((manifest?.jobs ?? []).map(j => j.id));
  const autoApplyIds = jobUpdates
    .filter(u => manifestJobIds.has(u.job_id) && !u.job.locked)
    .map(u => u.id)
    .join(',');
  useEffect(() => {
    if (!autoApplyIds) return;
    for (const id of autoApplyIds.split(',')) {
      if (!autoAppliedRef.current.has(id)) {
        autoAppliedRef.current.add(id);
        applyJobUpdate(id);
      }
    }
  }, [autoApplyIds, applyJobUpdate]);

  useEffect(() => {
    if (manifest && manifest.jobs !== syncedJobs) {
      setSyncedJobs(manifest.jobs);
      setOrderedJobs(manifest.jobs);
    }
  }, [manifest, syncedJobs]);

  useEffect(() => {
    if (runOrderView !== 'merge') setSelectedForMerge(new Set());
  }, [runOrderView]);

  // Fill in Del/Coll for any job the extractor left blank, from the route's UK
  // leg (see defaultServiceType). Only ever fills a blank — an extracted or
  // hand-picked value is never overwritten — and it persists rather than just
  // displaying, since a blank Del/Coll is one of the things that blocks export.
  // Exported manifests are left alone entirely.
  const serviceDefaultedRef = useRef<Set<string>>(new Set());
  const manifestLocked = manifest != null
    && ((manifest.status !== 'open' && manifest.status !== 'pending_review') || manifest.exported_at != null);
  const pendingServiceDefaults = (manifest?.jobs ?? [])
    .filter(j => !j.job_service_type)
    .map(j => `${j.id}=${defaultServiceType(j) ?? ''}`)
    .filter(entry => !entry.endsWith('='))
    .join(',');
  useEffect(() => {
    if (manifestLocked || !pendingServiceDefaults) return;
    for (const entry of pendingServiceDefaults.split(',')) {
      const [jobId, value] = entry.split('=') as [string, JobServiceType];
      if (serviceDefaultedRef.current.has(jobId)) continue;
      serviceDefaultedRef.current.add(jobId);
      setOrderedJobs(prev => prev.map(j => (j.id === jobId ? { ...j, job_service_type: value } : j)));
      updateJob({ id: jobId, body: { job_service_type: value } });
    }
  }, [pendingServiceDefaults, manifestLocked, updateJob]);

  useEffect(() => {
    if (manifest && syncedPointsFor !== manifest.id) {
      setSyncedPointsFor(manifest.id);
      setManifestFields({
        start_point: manifest.start_point ?? '',
        end_point: manifest.end_point ?? '',
        job_reference: manifest.job_reference ?? '',
        account_number: manifest.account_number ?? '',
        vehicle_size: manifest.vehicle_size ?? '',
        service_type: manifest.service_type ?? '',
      });
    }
  }, [manifest, syncedPointsFor]);

  const selectedJob = orderedJobs.find(j => j.id === selectedJobId) ?? null;

  useEffect(() => {
    if (selectedJob && syncedFormFor !== selectedJob.id) {
      setSyncedFormFor(selectedJob.id);
      setJobForm(formFromJob(selectedJob));
    } else if (!selectedJob && syncedFormFor !== null) {
      setSyncedFormFor(null);
      setJobForm(null);
    }
  }, [selectedJob, syncedFormFor]);

  // Groups jobs into shared driver legs for the "Merge" run-order view. Two-tier
  // priority: (1) same delivery ("To") address — that's the repeated stop the
  // driver actually cares about; (2) for whatever's left ungrouped after that,
  // same shipper contact (the named collection contact, not just the same
  // building — e.g. two HAWBs booked by the same person at a hospital even
  // though the printed address block has minor differences per document).
  // This is purely a display grouping; it never changes the underlying jobs or
  // their order. Computed here
  // (before the loading/error early returns below) because the useEffect that
  // depends on it must itself be called unconditionally on every render — a
  // hook placed after an early return gets skipped on some renders and not
  // others, which is exactly what triggered "Rendered more hooks than during
  // the previous render" when this lived further down.
  const routeGroups = new Map<string, HawbJob[]>();
  const jobGroupKey = new Map<string, string>();
  const groupedJobIds = new Set<string>();

  // A job with manual_group_id set (manually merged or manually unmerged via
  // the Merge view) is excluded from the To/contact auto-heuristic entirely —
  // it's grouped purely by that override below — so a manual choice can never
  // pull other jobs into its bucket, and unmerging one job never breaks the
  // auto-grouping of whoever it's left behind.
  const autoJobs = orderedJobs.filter(j => !j.manual_group_id);

  const byConsignee = new Map<string, HawbJob[]>();
  for (const job of autoJobs) {
    const identity = addressIdentityKey(job.consignee);
    if (!identity) continue;
    const group = byConsignee.get(identity);
    if (group) group.push(job); else byConsignee.set(identity, [job]);
  }
  for (const [identity, jobs] of byConsignee) {
    if (jobs.length < 2) continue;
    const key = `to:${identity}`;
    routeGroups.set(key, jobs);
    jobs.forEach(j => { jobGroupKey.set(j.id, key); groupedJobIds.add(j.id); });
  }

  const byShipperContact = new Map<string, HawbJob[]>();
  for (const job of autoJobs) {
    if (groupedJobIds.has(job.id)) continue;
    const contact = job.shipper_contact?.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!contact) continue;
    const group = byShipperContact.get(contact);
    if (group) group.push(job); else byShipperContact.set(contact, [job]);
  }
  for (const [contact, jobs] of byShipperContact) {
    if (jobs.length < 2) continue;
    const key = `contact:${contact}`;
    routeGroups.set(key, jobs);
    jobs.forEach(j => { jobGroupKey.set(j.id, key); groupedJobIds.add(j.id); });
  }

  const byManualGroup = new Map<string, HawbJob[]>();
  for (const job of orderedJobs) {
    if (!job.manual_group_id) continue;
    const group = byManualGroup.get(job.manual_group_id);
    if (group) group.push(job); else byManualGroup.set(job.manual_group_id, [job]);
  }
  for (const [groupId, jobs] of byManualGroup) {
    const key = `manual:${groupId}`;
    routeGroups.set(key, jobs);
    jobs.forEach(j => jobGroupKey.set(j.id, key));
  }

  for (const job of orderedJobs) {
    if (!jobGroupKey.has(job.id)) jobGroupKey.set(job.id, `single:${job.id}`);
  }

  // The Merge view's run order is a list of stops, not of HAWBs: a merged group
  // is one stop and every ungrouped HAWB is a stop of its own. Reordering (which
  // only the Merge view offers) moves whole stops, so it works on these slots
  // rather than on orderedJobs directly.
  const mergeSlots: { key: string; jobs: HawbJob[] }[] = [];
  const seenSlotKeys = new Set<string>();
  for (const job of orderedJobs) {
    const key = jobGroupKey.get(job.id)!;
    if (seenSlotKeys.has(key)) continue;
    seenSlotKeys.add(key);
    mergeSlots.push({ key, jobs: routeGroups.get(key) ?? [job] });
  }

  if (isLoading) {
    return <ManifestDetailSkeleton />;
  }
  if (isError || !manifest) {
    return <ApiErrorState title="Failed to load manifest" onRetry={refetch} />;
  }
  if (manifest.status === 'extracting' || manifest.status === 'failed' || manifest.status === 'ignored') {
    return <ManifestPlaceholderState manifest={manifest} onBack={() => router.push('/dashboard/manifests')} />;
  }

  // Export no longer flips manifest.status (it stays 'open') — exported_at is now
  // the only signal that a manifest's jobs are locked and it can no longer be
  // edited, exported again, or cancelled.
  const locked = manifestLocked;
  const dgCount = orderedJobs.filter(j => j.dangerous_goods).length;
  const packageCount = orderedJobs.reduce((sum, j) => sum + (j.package_qty ?? 0), 0);
  const jobIdsWithUpdates = new Set(jobUpdates.map(u => u.job_id));
  const jobsMissingService = orderedJobs.filter(j => !j.job_service_type).length;
  // The whole manifest books as one Indigo Job, so every HAWB on it carries the
  // same JobNumber — the first one that has it is the manifest's number.
  const indigoJobNumber = orderedJobs.find(j => j.indigo_job_number)?.indigo_job_number ?? null;
  // A parsed shipper/consignee field only blocks export if it still holds the
  // literal "Blinded Data" placeholder an extractor drops in for a redacted
  // blinded-trial address. Blank fields are allowed through — e.g. addresses
  // that legitimately have no separate town/postcode line (some Irish
  // addresses) are not treated as incomplete.
  const jobHasIncompleteAddress = (job: HawbJob) => {
    const shipper = parseAddressParts(job.shipper);
    const consignee = parseAddressParts(job.consignee);
    return isBlinded(shipper.name) || isBlinded(shipper.address)
      || isBlinded(shipper.town) || isBlinded(shipper.postcode) || isBlinded(shipper.country)
      || isBlinded(consignee.name) || isBlinded(consignee.address)
      || isBlinded(consignee.town) || isBlinded(consignee.postcode) || isBlinded(consignee.country);
  };
  const jobsWithIncompleteAddress = orderedJobs.filter(jobHasIncompleteAddress).length;
  const missingExportFields = [
    !manifestFields.start_point && 'Start point',
    !manifestFields.end_point && 'End point',
    !manifestFields.job_reference && 'Job reference',
    !manifestFields.account_number && 'Account number',
    !manifestFields.vehicle_size && 'Vehicle size',
    !manifestFields.service_type && 'Service type',
    jobsMissingService > 0 && `Del/Coll on ${jobsMissingService} job${jobsMissingService === 1 ? '' : 's'}`,
    jobsWithIncompleteAddress > 0 && `Shipper/Consignee details on ${jobsWithIncompleteAddress} job${jobsWithIncompleteAddress === 1 ? '' : 's'}`,
  ].filter((v): v is string => Boolean(v));

  // Start/end point pickers offer the Configuration defaults (module 'manifest',
  // fields 'start_point'/'end_point') plus, per job, whichever address matches its
  // Service selection — Coll contributes its collection (from) address, Del its
  // delivery (to) address — into both pickers, since either can turn out to be the
  // manifest's actual route start or end.
  const jobPointCandidates = new Map<string, string>();
  orderedJobs.forEach(j => {
    if (j.job_service_type === 'collection' && j.shipper) {
      jobPointCandidates.set(j.shipper, [splitAddress(j.shipper).name, cityLine(j.shipper)].filter(Boolean).join(' · '));
    } else if (j.job_service_type === 'delivery' && j.consignee) {
      jobPointCandidates.set(j.consignee, [splitAddress(j.consignee).name, cityLine(j.consignee)].filter(Boolean).join(' · '));
    }
  });
  const startOptions = Array.from(
    new Map([
      ...savedStartPoints.map(v => [v.value, v.label] as const),
      ...jobPointCandidates,
    ]).entries(),
  ).map(([value, label]) => ({ value, label }));
  const endOptions = Array.from(
    new Map([
      ...savedEndPoints.map(v => [v.value, v.label] as const),
      ...jobPointCandidates,
    ]).entries(),
  ).map(([value, label]) => ({ value, label }));
  const accountNumberOptions = savedAccountNumbers.map(v => ({ value: v.value, label: v.label }));
  const serviceTypeOptions = savedServiceTypes.map(v => ({ value: v.value, label: v.label }));
  const vehicleSizeOptions = savedVehicleSizes.map(v => ({ value: v.value, label: v.label }));
  const withCurrentValue = (options: { value: string; label: string }[], current: string) =>
    !current || options.some(o => o.value === current) ? options : [{ value: current, label: current }, ...options];

  const persistOrder = async (jobs: HawbJob[]) => {
    try {
      await reorderJobs({ manifestId: manifest.id, job_ids: jobs.map(j => j.id) }).unwrap();
    } catch {
      // no-op — refetch on next render will restore server order
    }
  };

  const handleDrop = () => {
    setDragIndex(null);
    persistOrder(orderedJobs);
  };

  // Dragging moves a whole stop (see mergeSlots). Writing the slots back out
  // flattens each group's HAWBs contiguously at its new position, which is what
  // the driver runs anyway — merged HAWBs are collected/delivered together.
  const handleSlotDragOver = (slotIndex: number) => {
    if (dragIndex === null || dragIndex === slotIndex) return;
    const next = [...mergeSlots];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(slotIndex, 0, moved);
    setOrderedJobs(next.flatMap(slot => slot.jobs));
    setDragIndex(slotIndex);
  };

  const saveManifestField = async (
    field: 'start_point' | 'end_point' | 'job_reference' | 'account_number' | 'vehicle_size' | 'service_type',
    value: string,
  ) => {
    if (locked) return;
    try {
      await updateManifest({ id: manifest.id, body: { [field]: value || null } }).unwrap();
    } catch {
      // reverts to server value on next refetch
    }
  };

  const saveJobField = async (jobId: string, field: string, value: unknown) => {
    if (locked) return;
    // updateHawbJob only invalidates the 'HawbJob' cache tag, not the manifest
    // detail query this page reads (it's keyed on 'HawbManifest') — so without
    // this, orderedJobs (and everything derived from it: export-readiness
    // checks, the run-order table) would stay stale until an unrelated
    // manifest-level refetch happened to occur. Apply the edit to local state
    // immediately, same workaround updateServiceType already uses below.
    setOrderedJobs(prev => prev.map(j => (j.id === jobId ? { ...j, [field]: value } : j)));
    try {
      await updateJob({ id: jobId, body: { [field]: value } }).unwrap();
    } catch {
      // reverts to server value on next refetch
    }
  };

  const updateServiceType = (jobId: string, value: JobServiceType) => {
    setOrderedJobs(prev => prev.map(j => (j.id === jobId ? { ...j, job_service_type: value } : j)));
    if (jobId === selectedJob?.id) {
      setJobForm(f => f && ({ ...f, job_service_type: value }));
    }
    saveJobField(jobId, 'job_service_type', value);
  };

  const handleMergeSelected = async () => {
    if (locked || selectedForMerge.size < 2) return;
    const groupId = crypto.randomUUID?.() ?? `grp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ids = Array.from(selectedForMerge);
    await Promise.all(ids.map(id => saveJobField(id, 'manual_group_id', groupId)));
    setSelectedForMerge(new Set());
  };

  const handleExport = async () => {
    // Indigo's API has no CORS support, so a direct browser → Indigo call is
    // blocked outright — the payload is built and the AddJob request is made
    // server-side instead (see Horizon-Api's app/services/indigo_export.py),
    // keeping the account credentials out of the frontend bundle entirely.
    setExporting(true);
    setExportError(null);
    try {
      const { results } = await indigoExportManifest({
        manifestId: manifest.id,
        service_type: manifestFields.service_type,
      }).unwrap();

      // Per Indigo's doc, JobNumber is only populated "on success" — a
      // rejection can come back with ErrorCode left null and only
      // Errormessage set (seen live: "Invalid Customer Number"), so checking
      // ErrorCode alone would have silently reported this as a success.
      const failed = results.filter(r => !r.JobNumber);
      if (failed.length > 0) {
        setExportError(
          `${failed.length} of ${results.length} job(s) were rejected by Indigo: ${failed.map(f => f.Errormessage || `error ${f.ErrorCode ?? 'unknown'}`).join('; ')}`
        );
      } else {
        setPayloadBuilt(true);
        setTimeout(() => setPayloadBuilt(false), 3000);
      }
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setExportError(detail ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const confirmCancel = async () => {
    try {
      await cancelManifest(manifest.id).unwrap();
      setShowCancelConfirm(false);
    } catch {
      // no-op
    }
  };

  const handleReopen = async () => {
    try {
      await reopenManifest(manifest.id).unwrap();
    } catch {
      // no-op
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push('/dashboard/manifests')}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 dark:text-navy-500 hover:bg-gray-100 dark:hover:bg-navy-800 hover:text-gray-700 dark:hover:text-navy-200 transition-colors mt-0.5 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="flex items-center gap-1 text-base font-black text-gray-900 dark:text-gray-100 leading-tight font-mono">
                <Hash size={15} strokeWidth={2.5} className="text-gray-300 dark:text-navy-600 shrink-0" />
                {manifest.reference_number}
              </h1>
              <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full ${MANIFEST_STATUS_BADGE[manifest.status]}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {MANIFEST_STATUS_LABEL[manifest.status]}
              </span>
              {manifest.source_kind === 'blind' && (
                <span className="inline-flex items-center text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  Blind HAWB
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 truncate max-w-[220px]">
                <FileText size={10} className="shrink-0" />
                {manifest.document.filename}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {manifest.status === 'open' && !locked && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={cancelling}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-60 pl-2 pr-3 py-1 rounded-md transition-colors shrink-0"
            >
              <span className="flex items-center justify-center w-4 h-4 rounded bg-red-100 dark:bg-red-900/40">
                <Ban size={11} strokeWidth={2.25} />
              </span>
              {cancelling ? 'Cancelling…' : 'Cancel manifest'}
            </button>
          )}
          {manifest.status === 'open' && !locked && (
            <Tooltip
              content={missingExportFields.length > 0 ? `Missing before export: ${missingExportFields.join(', ')}` : undefined}
              side="bottom"
            >
              <button
                onClick={handleExport}
                disabled={missingExportFields.length > 0 || exporting}
                className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 disabled:opacity-60 pl-2 pr-3 py-1 rounded-md transition-colors shrink-0"
              >
                <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/40">
                  <FileDown size={11} strokeWidth={2.25} />
                </span>
                {exporting ? 'Exporting…' : payloadBuilt ? 'Exported ✓' : 'Export manifest'}
              </button>
            </Tooltip>
          )}
          {manifest.status === 'cancelled' && (
            <button
              onClick={handleReopen}
              disabled={reopening}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 disabled:opacity-60 pl-2 pr-3 py-1 rounded-md transition-colors shrink-0"
            >
              <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/40">
                <RefreshCw size={11} strokeWidth={2.25} />
              </span>
              {reopening ? 'Reopening…' : 'Reopen manifest'}
            </button>
          )}
        </div>
      </motion.div>

      {exportError && (
        <motion.div
          variants={staggerItem}
          className="flex items-start gap-2 text-[11.5px] font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-xl px-3 py-2"
        >
          <TriangleAlert size={13} className="shrink-0 mt-0.5" />
          <span>{exportError}</span>
        </motion.div>
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        title="Cancel this manifest?"
        message={`${manifest.reference_number} will be marked cancelled and locked from editing. Its ${orderedJobs.length} job${orderedJobs.length === 1 ? '' : 's'} stay attached — you can reopen it later to pick up right where you left off.`}
        confirmLabel="Cancel manifest"
        cancelLabel="Keep manifest"
        tone="danger"
        loading={cancelling}
        onConfirm={confirmCancel}
        onClose={() => setShowCancelConfirm(false)}
      />

      <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm p-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-3.5 gap-y-2.5 pb-3">
          <div className="min-w-0 rounded-md px-2 py-1.5 -mx-2">
            <PropLabel icon={PackageIcon} iconTone={ROW1_ICON_TONE}>Packages</PropLabel>
            <p className="text-[12.5px] font-medium text-gray-800 dark:text-gray-100 truncate">{packageCount}</p>
          </div>
          <div className="min-w-0 rounded-md px-2 py-1.5 -mx-2">
            <PropLabel icon={Weight} iconTone={ROW1_ICON_TONE}>Total weight</PropLabel>
            <p className="text-[12.5px] font-medium text-gray-800 dark:text-gray-100 truncate">{manifest.total_weight_kg.toFixed(2)} kg</p>
          </div>
          <div className="min-w-0 rounded-md px-2 py-1.5 -mx-2">
            <PropLabel icon={TriangleAlert} iconTone={ROW1_ICON_TONE}>Dangerous goods</PropLabel>
            <p className={`text-[12.5px] font-semibold truncate ${dgCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>{dgCount}</p>
          </div>
          <div className="min-w-0 rounded-md px-2 py-1.5 -mx-2">
            <PropLabel icon={Hash} iconTone={ROW1_ICON_TONE}>Indigo job</PropLabel>
            <p className="text-[12.5px] font-medium font-mono text-gray-800 dark:text-gray-100 truncate">
              {indigoJobNumber ?? '—'}
            </p>
          </div>
          <div className="min-w-0 rounded-md px-2 py-1.5 -mx-2">
            <PropLabel icon={CalendarClock} iconTone={ROW1_ICON_TONE}>Uploaded</PropLabel>
            <p className="text-[12.5px] font-medium text-gray-800 dark:text-gray-100 truncate">{formatDateTime(manifest.created_at)}</p>
          </div>
          <Tooltip content="View full PDF in a new tab" side="top" className="block">
            <button
              onClick={async () => {
                // pdf_url is a presigned S3 link that expires after an hour — the
                // cached copy may be stale if this tab has been open a while, so
                // open the tab immediately (to keep the user gesture) then point
                // it at a freshly refetched URL once available.
                const pdfWindow = window.open('', '_blank');
                try {
                  const fresh = await refetch().unwrap();
                  if (pdfWindow) pdfWindow.location.href = fresh.pdf_url;
                } catch {
                  if (pdfWindow) pdfWindow.location.href = manifest.pdf_url;
                }
              }}
              className="min-w-0 w-full text-left rounded-md px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-navy-800/60 transition-colors"
            >
              <PropLabel icon={FileText} iconTone={ROW1_ICON_TONE}>Document</PropLabel>
              <p className="flex items-center gap-1 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                View PDF
                <ExternalLink size={10} strokeWidth={2.5} className="shrink-0" />
              </p>
            </button>
          </Tooltip>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-3.5 gap-y-2.5 pt-3 border-t border-dashed border-gray-200 dark:border-navy-800">
          <div className="min-w-0">
            <PropLabel icon={Navigation} iconTone={ROW2_ICON_TONE} required>Start point</PropLabel>
            <LocationSelect
              disabled={locked}
              value={manifestFields.start_point}
              emptyLabel="Empty"
              options={withCurrentValue(startOptions, manifestFields.start_point)}
              onChange={value => {
                setManifestFields(f => ({ ...f, start_point: value }));
                saveManifestField('start_point', value);
              }}
            />
          </div>
          <div className="min-w-0">
            <PropLabel icon={Flag} iconTone={ROW2_ICON_TONE} required>End point</PropLabel>
            <LocationSelect
              disabled={locked}
              value={manifestFields.end_point}
              emptyLabel="Empty"
              options={withCurrentValue(endOptions, manifestFields.end_point)}
              onChange={value => {
                setManifestFields(f => ({ ...f, end_point: value }));
                saveManifestField('end_point', value);
              }}
            />
          </div>
          <div className="min-w-0">
            <PropLabel icon={Banknote} iconTone={ROW2_ICON_TONE} required>Account number</PropLabel>
            <LocationSelect
              disabled={locked}
              value={manifestFields.account_number}
              emptyLabel="Empty"
              tag="gray"
              options={withCurrentValue(accountNumberOptions, manifestFields.account_number)}
              onChange={value => {
                setManifestFields(f => ({ ...f, account_number: value }));
                saveManifestField('account_number', value);
              }}
            />
          </div>
          <div className="min-w-0">
            <PropLabel icon={List} iconTone={ROW2_ICON_TONE} required>Service type</PropLabel>
            <LocationSelect
              disabled={locked}
              value={manifestFields.service_type}
              emptyLabel="Empty"
              tag="blue"
              options={withCurrentValue(serviceTypeOptions, manifestFields.service_type)}
              onChange={value => {
                setManifestFields(f => ({ ...f, service_type: value }));
                saveManifestField('service_type', value);
              }}
            />
          </div>
          <div className="min-w-0">
            <PropLabel icon={Truck} iconTone={ROW2_ICON_TONE} required>Vehicle size</PropLabel>
            <LocationSelect
              disabled={locked}
              value={manifestFields.vehicle_size}
              emptyLabel="Empty"
              tag="purple"
              options={withCurrentValue(vehicleSizeOptions, manifestFields.vehicle_size)}
              onChange={value => {
                setManifestFields(f => ({ ...f, vehicle_size: value }));
                saveManifestField('vehicle_size', value);
              }}
            />
          </div>
          <div className="min-w-0">
            <PropLabel icon={Hash} iconTone={ROW2_ICON_TONE} required>Job reference</PropLabel>
            <input
              type="text"
              disabled={locked}
              value={manifestFields.job_reference}
              placeholder="Empty"
              onChange={e => setManifestFields(f => ({ ...f, job_reference: e.target.value }))}
              onBlur={e => saveManifestField('job_reference', e.target.value)}
              className={`w-full text-[12.5px] font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-navy-600 placeholder:font-normal bg-transparent border-none rounded-md px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-navy-800/60 focus:bg-gray-50 dark:focus:bg-navy-800/60 focus:outline-none focus:ring-1 focus:ring-emerald-300 dark:focus:ring-emerald-700 transition-colors ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-navy-800">
          <div>
            <h2 className="text-[12px] font-bold text-gray-700 dark:text-navy-200">Run order</h2>
            <p className="text-[10.5px] text-gray-500 dark:text-navy-500">
              {locked
                ? 'Manifest is exported and locked'
                : runOrderView === 'merge'
                  ? 'Drag to reorder stops — click a group to expand it'
                  : routeGroups.size === 0
                    ? 'Drag to reorder — click a row to expand its details'
                    : 'Click a row to expand its details'}
            </p>
          </div>
          <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-navy-700 bg-gray-50/70 dark:bg-navy-800/60 p-0.5 gap-0.5 shrink-0">
            <Tooltip content="One row per HAWB" side="bottom">
              <button
                type="button"
                onClick={() => setRunOrderView('list')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-bold transition-colors ${
                  runOrderView === 'list'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-700'
                }`}
              >
                <List size={12} strokeWidth={2.25} />
                List
              </button>
            </Tooltip>
            <Tooltip content="Group HAWBs that share the same collection and delivery address" side="bottom">
              <button
                type="button"
                onClick={() => setRunOrderView('merge')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-bold transition-colors ${
                  runOrderView === 'merge'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-700'
                }`}
              >
                <Combine size={12} strokeWidth={2.25} />
                Merge
              </button>
            </Tooltip>
          </div>
        </div>

        {runOrderView === 'merge' && selectedForMerge.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              {selectedForMerge.size} HAWB{selectedForMerge.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedForMerge(new Set())}
                className="px-2 py-1 rounded-md text-[10.5px] font-bold text-gray-500 dark:text-navy-400 hover:bg-white dark:hover:bg-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedForMerge.size < 2 || locked}
                onClick={handleMergeSelected}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-bold bg-emerald-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700"
              >
                <Combine size={12} strokeWidth={2.25} />
                Merge {selectedForMerge.size} selected
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
        <div className="min-w-[1630px]">
        <div className="grid grid-cols-[36px_190px_100px_minmax(240px,1.3fr)_100px_minmax(240px,1.3fr)_100px_140px_140px_60px_70px_110px] gap-2 px-4 py-2 text-[11px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide border-b border-gray-100 dark:border-navy-800">
          <div className="col-span-3 sticky left-0 z-10 -ml-4 pl-4 w-[358px] bg-white dark:bg-navy-900 grid grid-cols-[36px_190px_100px] gap-2">
            <span>#</span>
            <span>HAWB</span>
            <span>Service</span>
          </div>
          <span className="pl-2">From</span>
          <span>Col postcode</span>
          <span>To</span>
          <span>Del postcode</span>
          <span>Coll.</span>
          <span>Del.</span>
          <span>Pkg</span>
          <span>Wt (kg)</span>
          <span>Indigo Job#</span>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-navy-800/70">
          {(() => { let mergeRowCounter = 0; return orderedJobs.map(job => {
            const selected = selectedJobId === job.id;
            const pages = pageRangeLabel(job);
            const jobMultiPackage = job.packages.length > 1;
            const jobPackagesHaveDetail = job.packages.some(p => p.temperature_range || p.dimensions);
            const jobShowCombinedTempDims = !jobMultiPackage || !jobPackagesHaveDetail;
            const groupKey = jobGroupKey.get(job.id) ?? `single:${job.id}`;
            const routeGroup = routeGroups.get(groupKey) ?? [job];
            const isGroupParent = runOrderView === 'merge' && routeGroup.length > 1;
            const isFirstInGroup = isGroupParent && routeGroup[0].id === job.id;
            const groupExpanded = expandedGroups.has(groupKey);

            // Non-first members of a collapsed group are represented entirely by
            // the group summary row below — they don't get a row of their own
            // until the group is expanded.
            if (isGroupParent && !isFirstInGroup && !groupExpanded) return null;

            // A merged group occupies exactly one slot in the run order regardless
            // of whether it's expanded — expanding it to inspect the individual
            // HAWBs shouldn't renumber every stop after it.
            if (!isGroupParent || isFirstInGroup) mergeRowCounter += 1;
            const rowNumber = mergeRowCounter;
            // Reordering is a Merge-view affordance — except when there's nothing
            // to merge (no shared routes at all), in which case List and Merge
            // render identically and dragging works right there in List too.
            // Every row of a group shares the group's slot, so members of an
            // expanded group are valid drop targets even though only its header
            // is draggable.
            const slotIndex = rowNumber - 1;
            const reorderable = !locked && (runOrderView === 'merge' || routeGroups.size === 0);

            if (isGroupParent && !groupExpanded) {
              const matchedOn = groupKey.startsWith('to:')
                ? 'Same To'
                : groupKey.startsWith('contact:')
                  ? 'Same Shipper Contact'
                  : 'Manually merged';
              const collTimes = routeGroup.map(j => j.collection_at ? formatTime(j.collection_at) : '—');
              const delTimes = routeGroup.map(j => j.delivery_at ? formatTime(j.delivery_at) : '—');
              const services = routeGroup.map(j => j.job_service_type ?? '');
              const totalPkg = routeGroup.reduce((sum, j) => sum + (j.package_qty ?? 0), 0);
              const totalWt = routeGroup.reduce((sum, j) => sum + (j.weight_kg ?? 0), 0);
              return (
                <div key={groupKey}>
                  <div
                    draggable={reorderable}
                    onDragStart={() => setDragIndex(slotIndex)}
                    onDragOver={reorderable ? (e: React.DragEvent) => { e.preventDefault(); handleSlotDragOver(slotIndex); } : undefined}
                    onDrop={reorderable ? handleDrop : undefined}
                    onClick={() => setExpandedGroups(prev => new Set(prev).add(groupKey))}
                    className={`grid grid-cols-[36px_190px_100px_minmax(240px,1.3fr)_100px_minmax(240px,1.3fr)_100px_140px_140px_60px_70px_110px] gap-2 items-center px-4 py-2.5 text-[12px] transition-colors bg-blue-50/40 dark:bg-blue-950/15 hover:bg-blue-50/70 dark:hover:bg-blue-950/25 ${reorderable ? 'cursor-move' : 'cursor-pointer'}`}
                  >
                    <div className="col-span-3 sticky left-0 z-10 -ml-4 pl-4 w-[358px] bg-blue-50 dark:bg-blue-950/90 grid grid-cols-[36px_190px_100px] gap-2 items-center">
                      <span className="text-gray-900 dark:text-gray-100 font-mono">{rowNumber}</span>
                      <div className="min-w-0 py-1">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown size={11} className="text-blue-400 dark:text-blue-500 shrink-0 -rotate-90" />
                          <Combine size={11} className="text-blue-500 dark:text-blue-400 shrink-0" />
                          <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 shrink-0">{routeGroup.length} HAWBs</span>
                          <span className="text-[9px] font-semibold text-blue-400/80 dark:text-blue-500/80 shrink-0 px-1 py-px rounded bg-blue-100/70 dark:bg-blue-900/40">{matchedOn}</span>
                        </div>
                        <div className="max-h-12 overflow-y-auto pr-1 mt-0.5 space-y-0.5">
                          {routeGroup.map(j => (
                            <div key={j.id} className="font-mono font-bold text-[11px] leading-tight text-blue-700 dark:text-blue-400 truncate">
                              {j.hawb_number}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex">
                        {(() => {
                          const svc = commonValue(services);
                          const opt = SERVICE_TYPE_OPTIONS.find(o => o.value === svc);
                          return (
                            <span className="text-[10px] font-bold text-gray-500 dark:text-navy-400 whitespace-nowrap">
                              {opt ? opt.short : 'Mixed'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-0.5 min-w-0 pl-2">
                      <MapPin size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span className="text-gray-900 dark:text-gray-100 truncate">
                        {[splitAddress(job.shipper).name, cityLine(job.shipper)].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 truncate">{cityAndPostcodeLine(job.shipper).postcode || '—'}</span>
                    <span className="inline-flex items-center gap-0.5 min-w-0">
                      <Building2 size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span className="text-gray-900 dark:text-gray-100 truncate">
                        {[splitAddress(job.consignee).name, cityLine(job.consignee)].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 truncate">{cityAndPostcodeLine(job.consignee).postcode || '—'}</span>
                    <span className="text-gray-900 dark:text-gray-100 tabular-nums">{commonValue(collTimes)}</span>
                    <span className="text-gray-900 dark:text-gray-100 tabular-nums">{commonValue(delTimes)}</span>
                    <span className="text-gray-900 dark:text-gray-100 tabular-nums">{totalPkg}</span>
                    <span className="text-gray-900 dark:text-gray-100 tabular-nums">{totalWt}</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono truncate">{commonValue(routeGroup.map(j => j.indigo_job_number ?? '—'))}</span>
                  </div>
                </div>
              );
            }

            const dragProps = {
              draggable: reorderable && !isGroupParent,
              onDragStart: () => setDragIndex(slotIndex),
              onDragOver: reorderable ? (e: React.DragEvent) => { e.preventDefault(); handleSlotDragOver(slotIndex); } : undefined,
              onDrop: reorderable ? handleDrop : undefined,
              onClick: () => setSelectedJobId(cur => (cur === job.id ? null : job.id)),
            };

            // Opaque backgrounds for the frozen #/HAWB columns — they need to
            // fully mask the From/To/etc. columns sliding underneath them as
            // the table scrolls horizontally, so they can't reuse the row's
            // own translucent state colors.
            const stickyBg = selected
              ? 'bg-emerald-50 dark:bg-emerald-950/90'
              : isGroupParent
                ? 'bg-blue-50 dark:bg-blue-950/90'
                : 'bg-white dark:bg-navy-900';

            return (
              <div key={job.id}>
                {isGroupParent && isFirstInGroup && groupExpanded && (
                  <div
                    draggable={reorderable}
                    onDragStart={() => setDragIndex(slotIndex)}
                    onDragOver={reorderable ? (e: React.DragEvent) => { e.preventDefault(); handleSlotDragOver(slotIndex); } : undefined}
                    onDrop={reorderable ? handleDrop : undefined}
                    onClick={() => setExpandedGroups(prev => { const next = new Set(prev); next.delete(groupKey); return next; })}
                    className={`flex items-center gap-1.5 px-4 py-1.5 bg-blue-50/70 dark:bg-blue-950/20 text-[10.5px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100/70 dark:hover:bg-blue-950/40 ${reorderable ? 'cursor-move' : 'cursor-pointer'}`}
                  >
                    <span className="font-mono">{rowNumber}</span>
                    <Combine size={11} strokeWidth={2.25} className="shrink-0" />
                    {routeGroup.length} HAWBs share this route ({groupKey.startsWith('to:') ? 'same To' : groupKey.startsWith('contact:') ? 'same shipper contact' : 'manually merged'}) — click to collapse
                  </div>
                )}
                <div
                  {...dragProps}
                  className={`grid grid-cols-[36px_190px_100px_minmax(240px,1.3fr)_100px_minmax(240px,1.3fr)_100px_140px_140px_60px_70px_110px] gap-2 items-center px-4 py-2.5 cursor-pointer text-[12px] transition-colors ${
                    isGroupParent ? 'bg-blue-50/25 dark:bg-blue-950/10' : ''
                  } ${
                    selected ? 'bg-emerald-50/70 dark:bg-emerald-950/25' : 'hover:bg-gray-50/70 dark:hover:bg-navy-800/50'
                  }`}
                >
                  <div className={`col-span-3 sticky left-0 z-10 -ml-4 pl-4 w-[358px] ${stickyBg} grid grid-cols-[36px_190px_100px] gap-2 items-center`}>
                    <div className="flex items-center gap-1">
                      {runOrderView === 'merge' && !locked && (
                        <input
                          type="checkbox"
                          checked={selectedForMerge.has(job.id)}
                          onClick={e => e.stopPropagation()}
                          onChange={() => setSelectedForMerge(prev => {
                            const next = new Set(prev);
                            if (next.has(job.id)) next.delete(job.id); else next.add(job.id);
                            return next;
                          })}
                          className="w-3 h-3 rounded cursor-pointer accent-emerald-600 shrink-0"
                        />
                      )}
                      <span className="text-gray-900 dark:text-gray-100 font-mono">{isGroupParent && groupExpanded ? '' : rowNumber}</span>
                    </div>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <ChevronDown size={11} className={`text-gray-300 dark:text-navy-600 shrink-0 transition-transform ${selected ? 'rotate-0' : '-rotate-90'}`} />
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate min-w-0">{job.hawb_number}</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-500 dark:text-blue-400 shrink-0">
                        <FileText size={10} />{pages ?? 'Page 1'}
                      </span>
                      {job.dangerous_goods_notes && <TriangleAlert size={10} className="text-red-500 shrink-0" />}
                      {jobIdsWithUpdates.has(job.id) && <RefreshCw size={10} className="text-orange-500 shrink-0" />}
                      {runOrderView === 'merge' && !locked && !job.manual_group_id && routeGroup.length > 1 && (
                        <Tooltip content="Remove from group — becomes its own stop" side="top">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); saveJobField(job.id, 'manual_group_id', job.id); }}
                            className="shrink-0 text-gray-400 hover:text-red-500"
                          >
                            <Ungroup size={11} />
                          </button>
                        </Tooltip>
                      )}
                      {runOrderView === 'merge' && !locked && job.manual_group_id && (
                        <Tooltip content="Reset to automatic grouping" side="top">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); saveJobField(job.id, 'manual_group_id', null); }}
                            className="shrink-0 text-gray-400 hover:text-emerald-600"
                          >
                            <RotateCcw size={11} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex">
                      <ServiceTypePicker
                        value={job.job_service_type ?? ''}
                        disabled={locked}
                        onChange={value => updateServiceType(job.id, value)}
                      />
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-0.5 min-w-0 pl-2">
                    <MapPin size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-gray-900 dark:text-gray-100 truncate">
                      {[splitAddress(job.shipper).name, cityLine(job.shipper)].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 truncate">{cityAndPostcodeLine(job.shipper).postcode || '—'}</span>
                  <span className="inline-flex items-center gap-0.5 min-w-0">
                    <Building2 size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-gray-900 dark:text-gray-100 truncate">
                      {[splitAddress(job.consignee).name, cityLine(job.consignee)].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 truncate">{cityAndPostcodeLine(job.consignee).postcode || '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 tabular-nums">{job.collection_at ? formatTime(job.collection_at) : '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 tabular-nums">{job.delivery_at ? formatTime(job.delivery_at) : '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 tabular-nums">{job.package_qty ?? '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 tabular-nums">{job.weight_kg ?? '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 font-mono truncate">{job.indigo_job_number ?? '—'}</span>
                </div>

                <AnimatePresence initial={false}>
                  {selected && jobForm && (
                    <motion.div
                      key="expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden bg-gray-50/40 dark:bg-navy-950/20 border-t border-gray-100 dark:border-navy-800"
                    >
                      <div className="px-4 py-4 space-y-6 max-w-4xl">
                        {(job.blind_pdf_url || job.indigo_job_number) && (
                          <div className="flex items-center justify-end gap-2">
                            {job.indigo_job_number && (
                              <Tooltip content="Indigo's own reference for this job, returned from AddJob" side="bottom">
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                                  <Hash size={11} /> Indigo Job {job.indigo_job_number}
                                </span>
                              </Tooltip>
                            )}
                            {job.blind_pdf_url && (
                              <Tooltip content="View the companion MF-PCS PDF used to fill in redacted fields" side="bottom">
                                <button
                                  onClick={() => window.open(job.blind_pdf_url!, '_blank', 'noopener,noreferrer')}
                                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                                >
                                  <ExternalLink size={11} /> MF-PCS View PDF
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        )}

                        {/* Shipper / Consignee */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Section icon={MapPin} title="Shipper">
                            <AddressFields
                              key={job.id}
                              value={jobForm.shipper}
                              locked={locked}
                              onChange={raw => setJobForm(f => f && ({ ...f, shipper: raw }))}
                              onSave={raw => saveJobField(job.id, 'shipper', raw || null)}
                            />
                          </Section>
                          <Section icon={Building2} title="Consignee">
                            <AddressFields
                              key={job.id}
                              value={jobForm.consignee}
                              locked={locked}
                              onChange={raw => setJobForm(f => f && ({ ...f, consignee: raw }))}
                              onSave={raw => saveJobField(job.id, 'consignee', raw || null)}
                            />
                          </Section>
                        </div>

                        {/* Schedule */}
                        <Section icon={Clock} title="Schedule">
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Collection">
                              <input
                                type="datetime-local"
                                disabled={locked}
                                value={jobForm.collection_at}
                                onChange={e => setJobForm(f => f && ({ ...f, collection_at: e.target.value }))}
                                onBlur={e => saveJobField(job.id, 'collection_at', e.target.value ? `${e.target.value}:00` : null)}
                                className={inputClass(locked)}
                              />
                            </Field>
                            <Field label="Delivery">
                              <input
                                type="datetime-local"
                                disabled={locked}
                                value={jobForm.delivery_at}
                                onChange={e => setJobForm(f => f && ({ ...f, delivery_at: e.target.value }))}
                                onBlur={e => saveJobField(job.id, 'delivery_at', e.target.value ? `${e.target.value}:00` : null)}
                                className={inputClass(locked)}
                              />
                            </Field>
                          </div>
                        </Section>

                        {/* Package */}
                        <Section icon={PackageIcon} title="Package">
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Package Qty">
                              <input
                                type="number"
                                disabled={locked}
                                value={jobForm.package_qty}
                                onChange={e => setJobForm(f => f && ({ ...f, package_qty: e.target.value }))}
                                onBlur={e => saveJobField(job.id, 'package_qty', e.target.value ? Number(e.target.value) : null)}
                                className={inputClass(locked)}
                              />
                            </Field>
                            <Field label="Weight (kg)">
                              <input
                                type="number"
                                step="0.01"
                                disabled={locked}
                                value={jobForm.weight_kg}
                                onChange={e => setJobForm(f => f && ({ ...f, weight_kg: e.target.value }))}
                                onBlur={e => saveJobField(job.id, 'weight_kg', e.target.value ? Number(e.target.value) : null)}
                                className={inputClass(locked)}
                              />
                            </Field>
                          </div>
                        </Section>

                        {/* Dangerous goods — alert-styled toggle */}
                        <div className={`rounded-xl border p-3.5 transition-colors ${
                          jobForm.dangerous_goods
                            ? 'border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20'
                            : 'border-gray-100 dark:border-navy-800 bg-gray-50/40 dark:bg-navy-800/30'
                        }`}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={locked}
                              checked={jobForm.dangerous_goods}
                              onChange={e => {
                                setJobForm(f => f && ({ ...f, dangerous_goods: e.target.checked }));
                                saveJobField(job.id, 'dangerous_goods', e.target.checked);
                              }}
                              className="rounded cursor-pointer accent-red-600"
                            />
                            <span className={`flex items-center gap-1.5 text-[12px] font-bold ${
                              jobForm.dangerous_goods ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-navy-300'
                            }`}>
                              <TriangleAlert size={13} /> Dangerous goods
                            </span>
                          </label>

                          {jobForm.dangerous_goods && (
                            <textarea
                              disabled={locked}
                              value={jobForm.dangerous_goods_notes}
                              onChange={e => setJobForm(f => f && ({ ...f, dangerous_goods_notes: e.target.value }))}
                              onBlur={e => saveJobField(job.id, 'dangerous_goods_notes', e.target.value || null)}
                              placeholder="UN number, class, notes…"
                              rows={2}
                              className={`${inputClass(locked)} mt-3`}
                            />
                          )}
                        </div>

                        {/* Additional details panel */}
                        <div className="rounded-xl border border-gray-100 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 space-y-5">
                          <p className="text-[10.5px] font-black text-gray-500 dark:text-navy-500 uppercase tracking-wide">Additional details</p>

                          <Section icon={Hash} title="References">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Client Account">
                                  <input disabled={locked} value={jobForm.client_account}
                                    onChange={e => setJobForm(f => f && ({ ...f, client_account: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'client_account', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Package Sequence">
                                  <input disabled={locked} value={jobForm.package_sequence}
                                    onChange={e => setJobForm(f => f && ({ ...f, package_sequence: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'package_sequence', e.target.value || null)}
                                    placeholder="e.g. 1 of 1"
                                    className={inputClass(locked)} />
                                </Field>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Shipper Reference">
                                  <input disabled={locked} value={jobForm.shipper_reference}
                                    onChange={e => setJobForm(f => f && ({ ...f, shipper_reference: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'shipper_reference', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Consignee Reference">
                                  <input disabled={locked} value={jobForm.consignee_reference}
                                    onChange={e => setJobForm(f => f && ({ ...f, consignee_reference: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'consignee_reference', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                              </div>
                            </div>
                          </Section>

                          <Section icon={Phone} title="Contacts">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Shipper Contact">
                                  <input disabled={locked} value={jobForm.shipper_contact}
                                    onChange={e => setJobForm(f => f && ({ ...f, shipper_contact: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'shipper_contact', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Shipper Phone">
                                  <input disabled={locked} value={jobForm.shipper_phone}
                                    onChange={e => setJobForm(f => f && ({ ...f, shipper_phone: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'shipper_phone', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Consignee Contact">
                                  <input disabled={locked} value={jobForm.consignee_contact}
                                    onChange={e => setJobForm(f => f && ({ ...f, consignee_contact: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'consignee_contact', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Consignee Phone">
                                  <input disabled={locked} value={jobForm.consignee_phone}
                                    onChange={e => setJobForm(f => f && ({ ...f, consignee_phone: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'consignee_phone', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                              </div>
                            </div>
                          </Section>

                          {jobShowCombinedTempDims && (
                            <Section icon={Thermometer} title="Handling">
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Temperature Range">
                                  <input disabled={locked} value={jobForm.temperature_range}
                                    onChange={e => setJobForm(f => f && ({ ...f, temperature_range: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'temperature_range', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Dimensions (cm)">
                                  <input disabled={locked} value={jobForm.dimensions}
                                    onChange={e => setJobForm(f => f && ({ ...f, dimensions: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'dimensions', e.target.value || null)}
                                    className={inputClass(locked)} />
                                </Field>
                              </div>
                            </Section>
                          )}

                          <Section icon={Banknote} title="Commercial">
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Volumetric Weight (kg)">
                                  <input type="number" step="0.01" disabled={locked} value={jobForm.volumetric_weight_kg}
                                    onChange={e => setJobForm(f => f && ({ ...f, volumetric_weight_kg: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'volumetric_weight_kg', e.target.value ? Number(e.target.value) : null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Direction">
                                  <select disabled={locked} value={jobForm.direction}
                                    onChange={e => {
                                      setJobForm(f => f && ({ ...f, direction: e.target.value }));
                                      saveJobField(job.id, 'direction', e.target.value || null);
                                    }}
                                    className={inputClass(locked)}>
                                    <option value="">—</option>
                                    <option value="Inbound">Inbound</option>
                                    <option value="Outbound">Outbound</option>
                                  </select>
                                </Field>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Declared Value">
                                  <input type="number" step="0.01" disabled={locked} value={jobForm.declared_value}
                                    onChange={e => setJobForm(f => f && ({ ...f, declared_value: e.target.value }))}
                                    onBlur={e => saveJobField(job.id, 'declared_value', e.target.value ? Number(e.target.value) : null)}
                                    className={inputClass(locked)} />
                                </Field>
                                <Field label="Currency">
                                  <input disabled={locked} value={jobForm.declared_value_currency}
                                    onChange={e => setJobForm(f => f && ({ ...f, declared_value_currency: e.target.value.toUpperCase() }))}
                                    onBlur={e => saveJobField(job.id, 'declared_value_currency', e.target.value || null)}
                                    placeholder="GBP"
                                    className={inputClass(locked)} />
                                </Field>
                              </div>
                            </div>
                          </Section>

                          <Section icon={FileText} title="Special Handling">
                            <textarea disabled={locked} value={jobForm.special_handling}
                              onChange={e => setJobForm(f => f && ({ ...f, special_handling: e.target.value }))}
                              onBlur={e => saveJobField(job.id, 'special_handling', e.target.value || null)}
                              rows={4}
                              className={inputClass(locked)} />
                          </Section>

                          {job.packages.length > 0 && (
                            <Section icon={PackageIcon} title={`Packages (${job.packages.length})`}>
                              <div className="border border-gray-100 dark:border-navy-700 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11.5px] border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100 dark:bg-navy-800/80">
                                        <th className="text-left font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2 w-7">#</th>
                                        <th className="text-left font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Supplier</th>
                                        <th className="text-left font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Type</th>
                                        <th className="text-right font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Weight</th>
                                        <th className="text-left font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Temp</th>
                                        <th className="text-left font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Dims (cm)</th>
                                        <th className="text-left font-bold text-gray-500 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                                      {job.packages.map((p, i) => (
                                        <tr key={i} className="bg-white dark:bg-navy-900 even:bg-gray-50/40 dark:even:bg-navy-800/30">
                                          <td className="px-3 py-2 text-gray-500 dark:text-navy-500 font-bold">{i + 1}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-navy-300 whitespace-nowrap">{p.supplier || '—'}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-navy-300 whitespace-nowrap">{p.package_type || '—'}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-navy-300 text-right whitespace-nowrap">{p.weight_kg != null ? `${p.weight_kg} kg` : '—'}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-navy-300 whitespace-nowrap">{p.temperature_range || '—'}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-navy-300 whitespace-nowrap">{p.dimensions || '—'}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-navy-300">{p.content_description || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </Section>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }); })()}
        </div>
        </div>
        </div>

      </motion.div>
    </motion.div>
  );
}
