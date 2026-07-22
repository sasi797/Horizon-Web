'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, FileDown, TriangleAlert, FileText, ExternalLink, Clock, Thermometer, Package as PackageIcon, Banknote, Building2, MapPin, Phone, Hash, RefreshCw, Weight, Navigation, Flag, Ban, List, Combine } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetHawbManifestQuery,
  useUpdateHawbManifestMutation,
  useUpdateHawbJobMutation,
  useReorderManifestJobsMutation,
  useCancelManifestMutation,
  useReopenManifestMutation,
  useRetryManifestExtractionMutation,
  useGetJobUpdatesQuery,
  useApplyJobUpdateMutation,
  type HawbJob,
  type HawbManifestDetail,
} from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import Tooltip from '@/components/Tooltip';
import ConfirmDialog from '@/components/ConfirmDialog';
import { splitAddress, cityLine } from '@/lib/hawbFormat';

const MANIFEST_STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  open: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  booked: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  on_hold: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  exported: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400',
  extracting: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  failed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
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
};

// Stub list — real account numbers (keyed off the collection address) are pending; swap this
// out once the actual list is provided.
const ACCOUNT_NUMBER_OPTIONS = [
  { value: 'PS0011', label: 'PS0011' },
  { value: 'PS0022', label: 'PS0022' },
  { value: 'PS0033', label: 'PS0033' },
];

const VEHICLE_SIZE_OPTIONS = [
  { value: 'small_van', label: 'Small Van' },
  { value: 'short_wheel_base', label: 'Short wheel base' },
  { value: 'long_wheel_base', label: 'Long wheel base' },
];

// Shape of what would eventually be POSTed to the external booking system.
// External API integration is on hold pending their docs (single job / bulk /
// both, auth, response contract) — for now this is built and downloaded
// locally so the field mapping can be reviewed before any call is wired up.
function buildExportPayload(manifest: HawbManifestDetail, jobs: HawbJob[]) {
  return {
    manifest_reference: manifest.reference_number,
    job_reference: manifest.job_reference,
    account_number: manifest.account_number,
    vehicle_size: manifest.vehicle_size,
    start_point: manifest.start_point,
    end_point: manifest.end_point,
    jobs: jobs.map((job, index) => ({
      sequence: index + 1,
      hawb_number: job.hawb_number,
      service_type: job.job_service_type,
      shipper: job.shipper,
      consignee: job.consignee,
      collection_at: job.collection_at,
      delivery_at: job.delivery_at,
      package_qty: job.package_qty,
      weight_kg: job.weight_kg,
      dangerous_goods: job.dangerous_goods,
      dangerous_goods_notes: job.dangerous_goods_notes,
      temperature_range: job.temperature_range,
      dimensions: job.dimensions,
      special_handling: job.special_handling,
    })),
  };
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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
        {isFailed ? <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" /> : <RefreshCw size={9} className="animate-spin" />}
        {MANIFEST_STATUS_LABEL[manifest.status]}
      </span>
      <h1 className="text-[13px] font-bold text-gray-700 dark:text-navy-200">{manifest.document.filename}</h1>
      {isFailed ? (
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

function inputClass(locked: boolean) {
  return `w-full text-[13px] border border-gray-200 dark:border-navy-700 rounded-xl px-3 py-1.5 bg-gray-50/60 dark:bg-navy-800/60 text-gray-700 dark:text-gray-200 placeholder:text-gray-900 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-300 dark:focus:border-emerald-600 focus:bg-white dark:focus:bg-navy-800 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 transition-all ${
    locked ? 'opacity-60 cursor-not-allowed' : ''
  }`;
}

function LocationSelect({
  value, options, placeholder, disabled, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`${inputClass(disabled)} flex items-center justify-between gap-2 text-left ${open ? 'border-emerald-300 dark:border-emerald-600 ring-2 ring-emerald-100 dark:ring-emerald-900/40' : ''}`}
      >
        <span className={`truncate ${selected ? 'text-gray-700 dark:text-gray-200' : 'text-gray-900 dark:text-navy-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-500 dark:text-navy-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

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
                <button
                  key={o.value}
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
  const [payloadBuilt, setPayloadBuilt] = useState(false);
  const [cancelManifest, { isLoading: cancelling }] = useCancelManifestMutation();
  const [reopenManifest, { isLoading: reopening }] = useReopenManifestMutation();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { data: jobUpdates = [] } = useGetJobUpdatesQuery();
  const [applyJobUpdate] = useApplyJobUpdateMutation();

  const [orderedJobs, setOrderedJobs] = useState<HawbJob[]>([]);
  const [syncedJobs, setSyncedJobs] = useState<HawbJob[] | undefined>(undefined);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [runOrderView, setRunOrderView] = useState<'list' | 'merge'>('list');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [jobForm, setJobForm] = useState<JobForm | null>(null);
  const [syncedFormFor, setSyncedFormFor] = useState<string | null>(null);
  const [manifestFields, setManifestFields] = useState({
    start_point: '', end_point: '', job_reference: '', account_number: '', vehicle_size: '',
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
    if (manifest && syncedPointsFor !== manifest.id) {
      setSyncedPointsFor(manifest.id);
      setManifestFields({
        start_point: manifest.start_point ?? '',
        end_point: manifest.end_point ?? '',
        job_reference: manifest.job_reference ?? '',
        account_number: manifest.account_number ?? '',
        vehicle_size: manifest.vehicle_size ?? '',
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

  if (isLoading) {
    return <ManifestDetailSkeleton />;
  }
  if (isError || !manifest) {
    return <ApiErrorState title="Failed to load manifest" onRetry={refetch} />;
  }
  if (manifest.status === 'extracting' || manifest.status === 'failed') {
    return <ManifestPlaceholderState manifest={manifest} onBack={() => router.push('/dashboard/manifests')} />;
  }

  // Export no longer flips manifest.status (it stays 'open') — exported_at is now
  // the only signal that a manifest's jobs are locked and it can no longer be
  // edited, exported again, or cancelled.
  const locked = (manifest.status !== 'open' && manifest.status !== 'pending_review') || manifest.exported_at != null;
  const dgCount = orderedJobs.filter(j => j.dangerous_goods).length;
  const packageCount = orderedJobs.reduce((sum, j) => sum + (j.package_qty ?? 0), 0);
  const jobIdsWithUpdates = new Set(jobUpdates.map(u => u.job_id));

  // Groups jobs that share the exact same collection and delivery address — a
  // driver visiting the same two stops for multiple HAWBs can treat them as one
  // combined leg. This is purely a display grouping for the "Merge" run-order
  // view; it never changes the underlying jobs or their order.
  const routeGroups = new Map<string, HawbJob[]>();
  for (const job of orderedJobs) {
    const key = `${job.shipper}→${job.consignee}`;
    const group = routeGroups.get(key);
    if (group) group.push(job); else routeGroups.set(key, [job]);
  }
  const missingExportFields = [
    !manifestFields.job_reference && 'Job reference',
    !manifestFields.account_number && 'Account number',
    !manifestFields.vehicle_size && 'Vehicle size',
  ].filter((v): v is string => Boolean(v));

  // Start/end point pickers offer the collection & delivery addresses already present on
  // this manifest's run, so choosing a start point can auto-fill its matching end point.
  const startOptions = Array.from(
    new Map(
      orderedJobs.filter(j => j.shipper).map(j => [j.shipper as string, {
        value: j.shipper as string,
        label: [splitAddress(j.shipper).name, cityLine(j.shipper)].filter(Boolean).join(' · '),
        pairedEnd: j.consignee ?? '',
      }]),
    ).values(),
  );
  const endOptions = Array.from(
    new Map(
      orderedJobs.filter(j => j.consignee).map(j => [j.consignee as string, {
        value: j.consignee as string,
        label: [splitAddress(j.consignee).name, cityLine(j.consignee)].filter(Boolean).join(' · '),
      }]),
    ).values(),
  );
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

  const handleDragOver = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setOrderedJobs(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  };

  const saveManifestField = async (
    field: 'start_point' | 'end_point' | 'job_reference' | 'account_number' | 'vehicle_size',
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

  const handleExport = () => {
    const payload = buildExportPayload(manifest, orderedJobs);
    console.log('[Manifest export payload]', payload);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manifest.reference_number}-export-payload.json`;
    a.click();
    URL.revokeObjectURL(url);
    setPayloadBuilt(true);
    setTimeout(() => setPayloadBuilt(false), 3000);
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
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
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
                disabled={missingExportFields.length > 0}
                className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 disabled:opacity-60 pl-2 pr-3 py-1 rounded-md transition-colors shrink-0"
              >
                <span className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/40">
                  <FileDown size={11} strokeWidth={2.25} />
                </span>
                {payloadBuilt ? 'Payload built ✓' : 'Export manifest'}
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

      <motion.div variants={staggerItem} className="grid grid-cols-4 gap-2.5">
        {[
          { label: 'Packages', value: packageCount, icon: PackageIcon, tone: 'text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30' },
          { label: 'Total weight', value: `${manifest.total_weight_kg.toFixed(2)} kg`, icon: Weight, tone: 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Dangerous goods', value: dgCount, icon: TriangleAlert, tone: dgCount > 0 ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30' : 'text-gray-500 dark:text-navy-500 bg-gray-50 dark:bg-navy-800/60' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-2.5 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${stat.tone}`}>
              <stat.icon size={13} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-navy-500 uppercase tracking-wide truncate">{stat.label}</p>
              <p className="text-[14px] font-black text-gray-900 dark:text-gray-100 leading-tight mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
        <Tooltip content="View full PDF in a new tab" side="bottom" className="block">
          <button
            onClick={() => window.open(manifest.pdf_url, '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center gap-2.5 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors text-left"
          >
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30">
              <FileText size={13} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-navy-500 uppercase tracking-wide truncate">Document</p>
              <p className="flex items-center gap-1 text-[14px] font-black text-gray-900 dark:text-gray-100 leading-tight mt-0.5">
                View PDF
                <ExternalLink size={11} strokeWidth={2.5} className="text-gray-500 dark:text-navy-500" />
              </p>
            </div>
          </button>
        </Tooltip>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-2.5">
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5">
          <Field label={<span className="inline-flex items-center gap-1"><Navigation size={10} /> Start point</span>}>
            <LocationSelect
              disabled={locked}
              value={manifestFields.start_point}
              placeholder="Collection start location"
              options={withCurrentValue(startOptions, manifestFields.start_point)}
              onChange={value => {
                const match = startOptions.find(o => o.value === value);
                const nextEnd = match?.pairedEnd || manifestFields.end_point;
                setManifestFields(f => ({ ...f, start_point: value, end_point: nextEnd }));
                saveManifestField('start_point', value);
                if (match?.pairedEnd && match.pairedEnd !== manifestFields.end_point) {
                  saveManifestField('end_point', match.pairedEnd);
                }
              }}
            />
          </Field>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5">
          <Field label={<span className="inline-flex items-center gap-1"><Flag size={10} /> End point</span>}>
            <LocationSelect
              disabled={locked}
              value={manifestFields.end_point}
              placeholder="Final delivery location"
              options={withCurrentValue(endOptions, manifestFields.end_point)}
              onChange={value => {
                setManifestFields(f => ({ ...f, end_point: value }));
                saveManifestField('end_point', value);
              }}
            />
          </Field>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-3 gap-2.5">
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5">
          <Field label={<span>Job reference <span className="text-red-500">*</span></span>}>
            <input
              type="text"
              disabled={locked}
              value={manifestFields.job_reference}
              placeholder="e.g. JR-10234"
              onChange={e => setManifestFields(f => ({ ...f, job_reference: e.target.value }))}
              onBlur={e => saveManifestField('job_reference', e.target.value)}
              className={inputClass(locked)}
            />
          </Field>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5">
          <Field label={<span>Account number <span className="text-red-500">*</span></span>}>
            <LocationSelect
              disabled={locked}
              value={manifestFields.account_number}
              placeholder="Select account number"
              options={withCurrentValue(ACCOUNT_NUMBER_OPTIONS, manifestFields.account_number)}
              onChange={value => {
                setManifestFields(f => ({ ...f, account_number: value }));
                saveManifestField('account_number', value);
              }}
            />
          </Field>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 px-3.5 py-2.5">
          <Field label={<span>Vehicle size <span className="text-red-500">*</span></span>}>
            <LocationSelect
              disabled={locked}
              value={manifestFields.vehicle_size}
              placeholder="Select vehicle size"
              options={withCurrentValue(VEHICLE_SIZE_OPTIONS, manifestFields.vehicle_size)}
              onChange={value => {
                setManifestFields(f => ({ ...f, vehicle_size: value }));
                saveManifestField('vehicle_size', value);
              }}
            />
          </Field>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex flex-col bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-navy-800">
          <div>
            <h2 className="text-[12px] font-bold text-gray-700 dark:text-navy-200">Run order</h2>
            <p className="text-[10.5px] text-gray-500 dark:text-navy-500">
              {locked ? 'Manifest is exported and locked' : 'Drag to reorder — click a row to expand its details'}
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

        <div className="overflow-x-auto">
        <div className="min-w-[920px]">
        <div className="grid grid-cols-[24px_190px_1fr_1fr_56px_56px_44px_50px_112px] gap-2 px-4 py-2 text-[11px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide border-b border-gray-100 dark:border-navy-800">
          <span>#</span>
          <span>HAWB</span>
          <span>From</span>
          <span>To</span>
          <span className="text-right">Coll.</span>
          <span className="text-right">Del.</span>
          <span className="text-right">Pkg</span>
          <span className="text-right">Wt (kg)</span>
          <span className="text-right">Service</span>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-navy-800/70">
          {(() => { let mergeRowCounter = 0; return orderedJobs.map((job, index) => {
            const selected = selectedJobId === job.id;
            const pages = pageRangeLabel(job);
            const jobMultiPackage = job.packages.length > 1;
            const jobPackagesHaveDetail = job.packages.some(p => p.temperature_range || p.dimensions);
            const jobShowCombinedTempDims = !jobMultiPackage || !jobPackagesHaveDetail;
            const groupKey = `${job.shipper}→${job.consignee}`;
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

            if (isGroupParent && !groupExpanded) {
              const collTimes = routeGroup.map(j => j.collection_at ? formatTime(j.collection_at) : '—');
              const delTimes = routeGroup.map(j => j.delivery_at ? formatTime(j.delivery_at) : '—');
              const services = routeGroup.map(j => j.job_service_type ?? '');
              const totalPkg = routeGroup.reduce((sum, j) => sum + (j.package_qty ?? 0), 0);
              const totalWt = routeGroup.reduce((sum, j) => sum + (j.weight_kg ?? 0), 0);
              return (
                <div key={groupKey}>
                  <div
                    onClick={() => setExpandedGroups(prev => new Set(prev).add(groupKey))}
                    className="grid grid-cols-[24px_190px_1fr_1fr_56px_56px_44px_50px_112px] gap-2 items-center px-4 py-2.5 cursor-pointer text-[12px] transition-colors bg-blue-50/40 dark:bg-blue-950/15 hover:bg-blue-50/70 dark:hover:bg-blue-950/25"
                  >
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{rowNumber}</span>
                    <div className="min-w-0 flex items-center gap-1.5">
                      <ChevronDown size={11} className="text-blue-400 dark:text-blue-500 shrink-0 -rotate-90" />
                      <Combine size={11} className="text-blue-500 dark:text-blue-400 shrink-0" />
                      <span className="font-bold text-blue-700 dark:text-blue-400 truncate">{routeGroup.length} HAWBs merged</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 min-w-0">
                      <MapPin size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span className="text-gray-900 dark:text-gray-100 truncate">
                        {[splitAddress(job.shipper).name, cityLine(job.shipper)].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 min-w-0">
                      <Building2 size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span className="text-gray-900 dark:text-gray-100 truncate">
                        {[splitAddress(job.consignee).name, cityLine(job.consignee)].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{commonValue(collTimes)}</span>
                    <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{commonValue(delTimes)}</span>
                    <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{totalPkg}</span>
                    <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{totalWt}</span>
                    <div className="flex justify-end">
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
                </div>
              );
            }

            const dragProps = {
              draggable: !locked && runOrderView === 'list',
              onDragStart: () => setDragIndex(index),
              onDragOver: (e: React.DragEvent) => { e.preventDefault(); handleDragOver(index); },
              onDrop: handleDrop,
              onClick: () => setSelectedJobId(cur => (cur === job.id ? null : job.id)),
            };

            return (
              <div key={job.id}>
                {isGroupParent && isFirstInGroup && groupExpanded && (
                  <div
                    onClick={() => setExpandedGroups(prev => { const next = new Set(prev); next.delete(groupKey); return next; })}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-50/70 dark:bg-blue-950/20 text-[10.5px] font-semibold text-blue-700 dark:text-blue-400 cursor-pointer hover:bg-blue-100/70 dark:hover:bg-blue-950/40"
                  >
                    <span className="font-mono">{rowNumber}</span>
                    <Combine size={11} strokeWidth={2.25} className="shrink-0" />
                    {routeGroup.length} HAWBs share this route — click to collapse
                  </div>
                )}
                <div
                  {...dragProps}
                  className={`grid grid-cols-[24px_190px_1fr_1fr_56px_56px_44px_50px_112px] gap-2 items-center px-4 py-2.5 cursor-pointer text-[12px] transition-colors ${
                    isGroupParent ? 'bg-blue-50/25 dark:bg-blue-950/10' : ''
                  } ${
                    selected ? 'bg-emerald-50/70 dark:bg-emerald-950/25' : 'hover:bg-gray-50/70 dark:hover:bg-navy-800/50'
                  }`}
                >
                  <span className="text-gray-900 dark:text-gray-100 font-mono">{isGroupParent && groupExpanded ? '' : rowNumber}</span>
                  <div className="min-w-0 flex items-center gap-1.5">
                    <ChevronDown size={11} className={`text-gray-300 dark:text-navy-600 shrink-0 transition-transform ${selected ? 'rotate-0' : '-rotate-90'}`} />
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">{job.hawb_number}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-500 dark:text-blue-400 shrink-0">
                      <FileText size={10} />{pages ?? 'Page 1'}
                    </span>
                    {job.dangerous_goods_notes && <TriangleAlert size={10} className="text-red-500 shrink-0" />}
                    {jobIdsWithUpdates.has(job.id) && <RefreshCw size={10} className="text-orange-500 shrink-0" />}
                  </div>
                  <span className="inline-flex items-center gap-0.5 min-w-0">
                    <MapPin size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-gray-900 dark:text-gray-100 truncate">
                      {[splitAddress(job.shipper).name, cityLine(job.shipper)].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-0.5 min-w-0">
                    <Building2 size={9} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-gray-900 dark:text-gray-100 truncate">
                      {[splitAddress(job.consignee).name, cityLine(job.consignee)].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{job.collection_at ? formatTime(job.collection_at) : '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{job.delivery_at ? formatTime(job.delivery_at) : '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{job.package_qty ?? '—'}</span>
                  <span className="text-gray-900 dark:text-gray-100 text-right tabular-nums">{job.weight_kg ?? '—'}</span>
                  <div className="flex justify-end">
                    <ServiceTypePicker
                      value={job.job_service_type ?? ''}
                      disabled={locked}
                      onChange={value => updateServiceType(job.id, value)}
                    />
                  </div>
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
                      <div className="px-4 py-4 space-y-6">
                        {job.blind_pdf_url && (
                          <div className="flex items-center justify-end">
                            <Tooltip content="View the companion MF-PCS PDF used to fill in redacted fields" side="bottom">
                              <button
                                onClick={() => window.open(job.blind_pdf_url!, '_blank', 'noopener,noreferrer')}
                                className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                              >
                                <ExternalLink size={11} /> MF-PCS View PDF
                              </button>
                            </Tooltip>
                          </div>
                        )}

                        {/* Shipper / Consignee */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Section icon={MapPin} title="Shipper">
                            <textarea
                              disabled={locked}
                              value={jobForm.shipper}
                              onChange={e => setJobForm(f => f && ({ ...f, shipper: e.target.value }))}
                              onBlur={e => saveJobField(job.id, 'shipper', e.target.value || null)}
                              rows={5}
                              className={inputClass(locked)}
                            />
                          </Section>
                          <Section icon={Building2} title="Consignee">
                            <textarea
                              disabled={locked}
                              value={jobForm.consignee}
                              onChange={e => setJobForm(f => f && ({ ...f, consignee: e.target.value }))}
                              onBlur={e => saveJobField(job.id, 'consignee', e.target.value || null)}
                              rows={5}
                              className={inputClass(locked)}
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
                                      <tr className="bg-gray-50/80 dark:bg-navy-800/80">
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
