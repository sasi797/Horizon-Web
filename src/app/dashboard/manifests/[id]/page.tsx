'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Check, Download, TriangleAlert, FileText, ExternalLink, Clock, Thermometer, Package as PackageIcon, Truck, GripVertical, ArrowLeftRight, Ruler, Banknote, Building2, MapPin, Phone, Hash } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetHawbManifestQuery,
  useUpdateHawbManifestMutation,
  useUpdateHawbJobMutation,
  useApproveHawbJobMutation,
  useReorderManifestJobsMutation,
  useExportManifestMutation,
  useConfirmManifestMutation,
  useHoldManifestMutation,
  useMarkManifestExportedMutation,
  type HawbJob,
} from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import { splitAddress, cityLine, postcodeLine } from '@/lib/hawbFormat';

const MANIFEST_STATUS_BADGE: Record<string, string> = {
  open: 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300 ring-1 ring-gray-200 dark:ring-navy-700',
  booked: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/60',
  confirmed: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
  on_hold: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800/60',
  exported: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
};

const MANIFEST_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  booked: 'Booked',
  confirmed: 'Confirmed',
  on_hold: 'On Hold',
  exported: 'Exported',
};

const JOB_STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/60',
  ready_to_manifest: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/60',
  manifested: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
};

const JOB_STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  ready_to_manifest: 'Ready to Manifest',
  manifested: 'Manifested',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 16);
}

function initials(name: string | null): string {
  if (!name) return 'System';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function routeLine(job: HawbJob): string {
  const shipper = splitAddress(job.shipper);
  const consignee = splitAddress(job.consignee);
  return `${shipper.name} · ${cityLine(job.shipper)} → ${consignee.name} · ${cityLine(job.consignee)}`;
}

function pageRangeLabel(job: HawbJob): string | null {
  if (job.page_start == null) return null;
  const count = job.packages.length || 1;
  const end = job.page_start + count - 1;
  return count > 1 ? `Pages ${job.page_start}–${end}` : `Page ${job.page_start}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide mb-1.5">{label}</label>
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
        <Icon size={12} className="text-gray-400 dark:text-navy-500" />
        <p className="text-[10px] font-black text-gray-500 dark:text-navy-400 uppercase tracking-wide">{title}</p>
      </div>
      {children}
    </div>
  );
}

function inputClass(locked: boolean) {
  return `w-full text-[13px] border border-gray-200 dark:border-navy-700 rounded-xl px-3 py-2 bg-gray-50/60 dark:bg-navy-800/60 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-emerald-300 dark:focus:border-emerald-600 focus:bg-white dark:focus:bg-navy-800 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 transition-all ${
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
        <span className={`truncate ${selected ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-navy-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 dark:text-navy-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
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
              <p className="px-3 py-2 text-[12px] text-gray-400 dark:text-navy-500">No locations available</p>
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
  const [approveJob, { isLoading: approving }] = useApproveHawbJobMutation();
  const [reorderJobs] = useReorderManifestJobsMutation();
  const [exportManifest, { isLoading: exporting }] = useExportManifestMutation();
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmManifest, { isLoading: confirming }] = useConfirmManifestMutation();
  const [holdManifest, { isLoading: holding }] = useHoldManifestMutation();
  const [markExported, { isLoading: markingExported }] = useMarkManifestExportedMutation();

  const [orderedJobs, setOrderedJobs] = useState<HawbJob[]>([]);
  const [syncedJobs, setSyncedJobs] = useState<HawbJob[] | undefined>(undefined);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [cardDesign, setCardDesign] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobForm | null>(null);
  const [syncedFormFor, setSyncedFormFor] = useState<string | null>(null);
  const [points, setPoints] = useState({ start_point: '', end_point: '' });
  const [syncedPointsFor, setSyncedPointsFor] = useState<string | undefined>(undefined);

  if (manifest && manifest.jobs !== syncedJobs) {
    setSyncedJobs(manifest.jobs);
    setOrderedJobs(manifest.jobs);
  }
  if (manifest && syncedPointsFor !== manifest.id) {
    setSyncedPointsFor(manifest.id);
    setPoints({ start_point: manifest.start_point ?? '', end_point: manifest.end_point ?? '' });
  }
  if (selectedJobId === null && orderedJobs.length > 0) {
    setSelectedJobId(orderedJobs[0].id);
  }
  const selectedJob = orderedJobs.find(j => j.id === selectedJobId) ?? orderedJobs[0] ?? null;
  if (selectedJob && syncedFormFor !== selectedJob.id) {
    setSyncedFormFor(selectedJob.id);
    setJobForm(formFromJob(selectedJob));
  }
  if (!selectedJob && syncedFormFor !== null) {
    setSyncedFormFor(null);
    setJobForm(null);
  }

  if (isLoading) {
    return <div className="h-64 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 animate-pulse" />;
  }
  if (isError || !manifest) {
    return <ApiErrorState title="Failed to load manifest" onRetry={refetch} />;
  }

  const locked = manifest.status !== 'open';
  const dgCount = orderedJobs.filter(j => j.dangerous_goods).length;
  const packageCount = orderedJobs.reduce((sum, j) => sum + (j.package_qty ?? 0), 0);

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

  const savePoint = async (field: 'start_point' | 'end_point', value: string) => {
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

  const swapShipperConsignee = async () => {
    if (locked || !selectedJob || !jobForm) return;
    const swapped = {
      shipper: jobForm.consignee,
      consignee: jobForm.shipper,
      shipper_contact: jobForm.consignee_contact,
      shipper_phone: jobForm.consignee_phone,
      shipper_reference: jobForm.consignee_reference,
      consignee_contact: jobForm.shipper_contact,
      consignee_phone: jobForm.shipper_phone,
      consignee_reference: jobForm.shipper_reference,
    };
    setJobForm(f => f && ({ ...f, ...swapped }));
    try {
      await updateJob({ id: selectedJob.id, body: swapped }).unwrap();
    } catch {
      // reverts to server value on next refetch
    }
  };

  const handleExport = async () => {
    setExportError(null);
    try {
      const blob = await exportManifest(manifest.id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${manifest.reference_number}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setExportError(detail || 'Export failed');
    }
  };

  const handleApprove = async (jobId: string) => {
    try {
      await approveJob(jobId).unwrap();
    } catch {
      // no-op — status simply won't change, visible on retry
    }
  };

  const handleConfirm = async () => {
    try {
      await confirmManifest(manifest.id).unwrap();
    } catch {
      // no-op
    }
  };

  const handleHold = async () => {
    try {
      await holdManifest(manifest.id).unwrap();
    } catch {
      // no-op
    }
  };

  const handleMarkExported = async () => {
    try {
      await markExported(manifest.id).unwrap();
    } catch {
      // no-op
    }
  };

  const multiPackage = selectedJob ? selectedJob.packages.length > 1 : false;
  const packagesHaveDetail = selectedJob ? selectedJob.packages.some(p => p.temperature_range || p.dimensions) : false;
  const showCombinedTempDims = !multiPackage || !packagesHaveDetail;

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push('/dashboard/manifests')} className="text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight font-mono">{manifest.reference_number}</h1>
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${MANIFEST_STATUS_BADGE[manifest.status]}`}>
                {MANIFEST_STATUS_LABEL[manifest.status]}
              </span>
              {manifest.source_kind === 'blind' && (
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/60">
                  Blind HAWB
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
              {manifest.document.filename} · Created {formatDate(manifest.created_at)} · operator {initials(manifest.created_by_name)} ·{' '}
              {manifest.exported_at ? `exported ${formatDate(manifest.exported_at)}` : 'not yet exported'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedJob && (
            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${JOB_STATUS_BADGE[selectedJob.status]}`}>
              {JOB_STATUS_LABEL[selectedJob.status]}
            </span>
          )}
          {selectedJob && selectedJob.status === 'pending_review' && !locked && (
            <button
              onClick={() => handleApprove(selectedJob.id)}
              disabled={approving}
              title="Confirm the merged fields are correct and mark this job ready to manifest"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-2.5 py-0.5 rounded-full transition-colors"
            >
              <Check size={11} /> {approving ? 'Approving…' : 'Approve'}
            </button>
          )}
          <button
            onClick={() => window.open(manifest.pdf_url, '_blank', 'noopener,noreferrer')}
            title="View full PDF in a new tab"
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gray-700 dark:bg-navy-700 hover:bg-gray-800 dark:hover:bg-navy-600 px-3 py-1.5 rounded-full transition-colors shrink-0"
          >
            <ExternalLink size={14} /> View PDF
          </button>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-4 gap-3">
        {[
          { label: 'Stops', value: orderedJobs.length },
          { label: 'Packages', value: packageCount },
          { label: 'Total weight', value: `${manifest.total_weight_kg.toFixed(2)} kg` },
          { label: 'Dangerous goods', value: dgCount },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-lg font-black text-gray-900 dark:text-gray-100 mt-0.5">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm px-4 py-3">
          <Field label="Start point">
            <LocationSelect
              disabled={locked}
              value={points.start_point}
              placeholder="Collection start location"
              options={withCurrentValue(startOptions, points.start_point)}
              onChange={value => {
                const match = startOptions.find(o => o.value === value);
                const nextEnd = match?.pairedEnd || points.end_point;
                setPoints({ start_point: value, end_point: nextEnd });
                savePoint('start_point', value);
                if (match?.pairedEnd && match.pairedEnd !== points.end_point) {
                  savePoint('end_point', match.pairedEnd);
                }
              }}
            />
          </Field>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm px-4 py-3">
          <Field label="End point">
            <LocationSelect
              disabled={locked}
              value={points.end_point}
              placeholder="Final delivery location"
              options={withCurrentValue(endOptions, points.end_point)}
              onChange={value => {
                setPoints(p => ({ ...p, end_point: value }));
                savePoint('end_point', value);
              }}
            />
          </Field>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[600px]">
        {/* Job details pane — synced to the run order row selected on the left */}
        <div className="order-2 h-[70vh] lg:h-auto flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 shrink-0">
            <p className="text-[11px] font-bold text-gray-500 dark:text-navy-400">Job details</p>
            <div className="flex items-center gap-2">
              {selectedJob && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                  <FileText size={11} /> {selectedJob.hawb_number} · {pageRangeLabel(selectedJob) ?? 'Page 1'}
                </span>
              )}
              {selectedJob?.blind_pdf_url && (
                <button
                  onClick={() => window.open(selectedJob.blind_pdf_url!, '_blank', 'noopener,noreferrer')}
                  title="View the companion booking-form PDF used to fill in redacted fields"
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                >
                  <ExternalLink size={11} /> Booking Form PDF
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm px-4 py-4">
            <AnimatePresence mode="wait">
            {selectedJob && jobForm ? (
              <motion.div
                key={selectedJob.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-6"
              >
                {selectedJob.source_kind === 'blind' && manifest.document.email_body_text && (
                  <details className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/40 px-4 py-3">
                    <summary className="text-[10.5px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide cursor-pointer select-none">
                      Blind HAWB — source email body (cross-check merged fields)
                    </summary>
                    <pre className="mt-2.5 text-[11.5px] text-gray-700 dark:text-navy-300 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
                      {manifest.document.email_body_text}
                    </pre>
                  </details>
                )}

                {/* At-a-glance journey card */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-navy-900 border border-emerald-100 dark:border-emerald-900/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/70 uppercase tracking-wide">
                        <MapPin size={11} /> From
                      </p>
                      <p className="text-[13px] font-black text-gray-900 dark:text-gray-100 truncate mt-0.5">{splitAddress(jobForm.shipper).name || '—'}</p>
                      <p className="text-[10px] text-gray-500 dark:text-navy-400 truncate">{cityLine(jobForm.shipper) || '—'}</p>
                      {postcodeLine(jobForm.shipper) && (
                        <p className="text-[10px] text-gray-400 dark:text-navy-500 truncate">{postcodeLine(jobForm.shipper)}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={swapShipperConsignee}
                      disabled={locked}
                      title="Swap shipper and consignee"
                      className="group w-8 h-8 rounded-full bg-white dark:bg-navy-800 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-sm shrink-0 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-navy-800"
                    >
                      <ArrowLeftRight size={13} className="text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110" />
                    </button>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="flex items-center justify-end gap-1 text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/70 uppercase tracking-wide">
                        To <Building2 size={11} />
                      </p>
                      <p className="text-[13px] font-black text-gray-900 dark:text-gray-100 truncate mt-0.5">{splitAddress(jobForm.consignee).name || '—'}</p>
                      <p className="text-[10px] text-gray-500 dark:text-navy-400 truncate">{cityLine(jobForm.consignee) || '—'}</p>
                      {postcodeLine(jobForm.consignee) && (
                        <p className="text-[10px] text-gray-400 dark:text-navy-500 truncate">{postcodeLine(jobForm.consignee)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3.5 pt-3.5 border-t border-emerald-100/70 dark:border-emerald-900/30">
                    <div className="flex items-center gap-1.5">
                      <PackageIcon size={12} className="text-gray-400 dark:text-navy-500" />
                      <span className="text-[11.5px] font-bold text-gray-700 dark:text-gray-200">
                        {jobForm.weight_kg || '—'} kg
                      </span>
                    </div>
                    {jobForm.dangerous_goods && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-lg whitespace-nowrap">
                        <TriangleAlert size={11} /> DG
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                  {[
                    { value: 'delivery', label: 'Delivery' },
                    { value: 'collection', label: 'Collection' },
                    { value: 'collection_and_delivery', label: 'Collection and Delivery' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-navy-300 cursor-pointer">
                      <input
                        type="radio"
                        name="job_service_type"
                        disabled={locked}
                        checked={jobForm.job_service_type === opt.value}
                        onChange={() => {
                          setJobForm(f => f && ({ ...f, job_service_type: opt.value }));
                          saveJobField(selectedJob.id, 'job_service_type', opt.value);
                        }}
                        className="accent-emerald-600"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {/* Shipper / Consignee */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Section icon={MapPin} title="Shipper">
                    <textarea
                      disabled={locked}
                      value={jobForm.shipper}
                      onChange={e => setJobForm(f => f && ({ ...f, shipper: e.target.value }))}
                      onBlur={e => saveJobField(selectedJob.id, 'shipper', e.target.value || null)}
                      rows={5}
                      className={inputClass(locked)}
                    />
                  </Section>
                  <Section icon={Building2} title="Consignee">
                    <textarea
                      disabled={locked}
                      value={jobForm.consignee}
                      onChange={e => setJobForm(f => f && ({ ...f, consignee: e.target.value }))}
                      onBlur={e => saveJobField(selectedJob.id, 'consignee', e.target.value || null)}
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
                        onBlur={e => saveJobField(selectedJob.id, 'collection_at', e.target.value ? `${e.target.value}:00` : null)}
                        className={inputClass(locked)}
                      />
                    </Field>
                    <Field label="Delivery">
                      <input
                        type="datetime-local"
                        disabled={locked}
                        value={jobForm.delivery_at}
                        onChange={e => setJobForm(f => f && ({ ...f, delivery_at: e.target.value }))}
                        onBlur={e => saveJobField(selectedJob.id, 'delivery_at', e.target.value ? `${e.target.value}:00` : null)}
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
                        onBlur={e => saveJobField(selectedJob.id, 'package_qty', e.target.value ? Number(e.target.value) : null)}
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
                        onBlur={e => saveJobField(selectedJob.id, 'weight_kg', e.target.value ? Number(e.target.value) : null)}
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
                        saveJobField(selectedJob.id, 'dangerous_goods', e.target.checked);
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
                      onBlur={e => saveJobField(selectedJob.id, 'dangerous_goods_notes', e.target.value || null)}
                      placeholder="UN number, class, notes…"
                      rows={2}
                      className={`${inputClass(locked)} mt-3`}
                    />
                  )}
                </div>

                {/* Additional details panel */}
                <div className="rounded-xl border border-gray-100 dark:border-navy-800 bg-gray-50/40 dark:bg-navy-950/30 p-4 space-y-5">
                  <p className="text-[10.5px] font-black text-gray-400 dark:text-navy-500 uppercase tracking-wide">Additional details</p>

                  <Section icon={Hash} title="References">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Client Account">
                          <input disabled={locked} value={jobForm.client_account}
                            onChange={e => setJobForm(f => f && ({ ...f, client_account: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'client_account', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Package Sequence">
                          <input disabled={locked} value={jobForm.package_sequence}
                            onChange={e => setJobForm(f => f && ({ ...f, package_sequence: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'package_sequence', e.target.value || null)}
                            placeholder="e.g. 1 of 1"
                            className={inputClass(locked)} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Shipper Reference">
                          <input disabled={locked} value={jobForm.shipper_reference}
                            onChange={e => setJobForm(f => f && ({ ...f, shipper_reference: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'shipper_reference', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Consignee Reference">
                          <input disabled={locked} value={jobForm.consignee_reference}
                            onChange={e => setJobForm(f => f && ({ ...f, consignee_reference: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'consignee_reference', e.target.value || null)}
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
                            onBlur={e => saveJobField(selectedJob.id, 'shipper_contact', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Shipper Phone">
                          <input disabled={locked} value={jobForm.shipper_phone}
                            onChange={e => setJobForm(f => f && ({ ...f, shipper_phone: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'shipper_phone', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Consignee Contact">
                          <input disabled={locked} value={jobForm.consignee_contact}
                            onChange={e => setJobForm(f => f && ({ ...f, consignee_contact: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'consignee_contact', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Consignee Phone">
                          <input disabled={locked} value={jobForm.consignee_phone}
                            onChange={e => setJobForm(f => f && ({ ...f, consignee_phone: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'consignee_phone', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                      </div>
                    </div>
                  </Section>

                  {showCombinedTempDims && (
                    <Section icon={Thermometer} title="Handling">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Temperature Range">
                          <input disabled={locked} value={jobForm.temperature_range}
                            onChange={e => setJobForm(f => f && ({ ...f, temperature_range: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'temperature_range', e.target.value || null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Dimensions (cm)">
                          <input disabled={locked} value={jobForm.dimensions}
                            onChange={e => setJobForm(f => f && ({ ...f, dimensions: e.target.value }))}
                            onBlur={e => saveJobField(selectedJob.id, 'dimensions', e.target.value || null)}
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
                            onBlur={e => saveJobField(selectedJob.id, 'volumetric_weight_kg', e.target.value ? Number(e.target.value) : null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Direction">
                          <select disabled={locked} value={jobForm.direction}
                            onChange={e => {
                              setJobForm(f => f && ({ ...f, direction: e.target.value }));
                              saveJobField(selectedJob.id, 'direction', e.target.value || null);
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
                            onBlur={e => saveJobField(selectedJob.id, 'declared_value', e.target.value ? Number(e.target.value) : null)}
                            className={inputClass(locked)} />
                        </Field>
                        <Field label="Currency">
                          <input disabled={locked} value={jobForm.declared_value_currency}
                            onChange={e => setJobForm(f => f && ({ ...f, declared_value_currency: e.target.value.toUpperCase() }))}
                            onBlur={e => saveJobField(selectedJob.id, 'declared_value_currency', e.target.value || null)}
                            placeholder="GBP"
                            className={inputClass(locked)} />
                        </Field>
                      </div>
                    </div>
                  </Section>

                  <Section icon={FileText} title="Special Handling">
                    <textarea disabled={locked} value={jobForm.special_handling}
                      onChange={e => setJobForm(f => f && ({ ...f, special_handling: e.target.value }))}
                      onBlur={e => saveJobField(selectedJob.id, 'special_handling', e.target.value || null)}
                      rows={4}
                      className={inputClass(locked)} />
                  </Section>

                  {selectedJob.packages.length > 0 && (
                    <Section icon={PackageIcon} title={`Packages (${selectedJob.packages.length})`}>
                      <div className="border border-gray-100 dark:border-navy-700 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11.5px] border-collapse">
                            <thead>
                              <tr className="bg-gray-50/80 dark:bg-navy-800/80">
                                <th className="text-left font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2 w-7">#</th>
                                <th className="text-left font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Supplier</th>
                                <th className="text-left font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Type</th>
                                <th className="text-right font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Weight</th>
                                <th className="text-left font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Temp</th>
                                <th className="text-left font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Dims (cm)</th>
                                <th className="text-left font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide text-[9.5px] px-3 py-2">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                              {selectedJob.packages.map((p, i) => (
                                <tr key={i} className="bg-white dark:bg-navy-900 even:bg-gray-50/40 dark:even:bg-navy-800/30">
                                  <td className="px-3 py-2 text-gray-400 dark:text-navy-500 font-bold">{i + 1}</td>
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
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="h-full flex items-center justify-center text-[12px] text-gray-400 dark:text-navy-500"
              >
                Select a job from the run order to view its details.
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* Run order pane */}
        <div className="order-1 flex flex-col bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-navy-800">
            <div>
              <h2 className="text-[12px] font-bold text-gray-700 dark:text-navy-200">Run order</h2>
              <p className="text-[10.5px] text-gray-400 dark:text-navy-500">
                {locked ? 'Manifest is exported and locked' : 'Drag to reorder — click a row to view its details'}
              </p>
            </div>
            <div className="flex items-center gap-0.5 bg-gray-50 dark:bg-navy-800 rounded-lg p-0.5 shrink-0">
              {([1, 2, 3, 4, 5] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setCardDesign(n)}
                  title={`Design ${n}`}
                  className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${
                    cardDesign === n
                      ? 'bg-white dark:bg-navy-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto ${cardDesign === 2 ? 'p-3 space-y-2' : 'divide-y divide-gray-50 dark:divide-navy-800/70'}`}>
            {cardDesign === 3 && (
              <div className="grid grid-cols-[24px_1fr_56px_56px_44px_50px] gap-2 px-4 py-2 text-[9px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide border-b border-gray-100 dark:border-navy-800 sticky top-0 bg-white dark:bg-navy-900">
                <span>#</span>
                <span>HAWB · Route</span>
                <span className="text-right">Coll.</span>
                <span className="text-right">Del.</span>
                <span className="text-right">Pkg</span>
                <span className="text-right">Wt (kg)</span>
              </div>
            )}
            {orderedJobs.map((job, index) => {
              const selected = selectedJobId === job.id;
              const pages = pageRangeLabel(job);
              const dragProps = {
                draggable: !locked,
                onDragStart: () => setDragIndex(index),
                onDragOver: (e: React.DragEvent) => { e.preventDefault(); handleDragOver(index); },
                onDrop: handleDrop,
                onClick: () => setSelectedJobId(job.id),
              };

              /* Design 1 — boarding-pass style route ticket */
              if (cardDesign === 1) {
                return (
                  <div
                    key={job.id}
                    {...dragProps}
                    className={`px-4 py-4 cursor-pointer transition-colors ${
                      selected ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-gray-50/70 dark:hover:bg-navy-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-navy-500">
                        Stop {index + 1} · <span className="font-mono text-gray-600 dark:text-navy-300">{job.hawb_number}</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {job.client_account && (
                          <span className="text-[9px] font-bold text-gray-500 dark:text-navy-400 bg-gray-100 dark:bg-navy-800 px-1.5 py-0.5 rounded-full">{job.client_account}</span>
                        )}
                        {pages && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                            <FileText size={9} /> {pages}
                          </span>
                        )}
                        {job.dangerous_goods_notes && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                            <TriangleAlert size={9} /> DG
                          </span>
                        )}
                        <ChevronRight size={14} className={selected ? 'text-emerald-500 shrink-0' : 'text-gray-300 dark:text-navy-600 shrink-0'} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-left w-[92px] shrink-0">
                        <p className="text-[17px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">
                          {job.collection_at ? formatTime(job.collection_at) : '—'}
                        </p>
                        <p className="text-[9.5px] text-gray-400 dark:text-navy-500 truncate mt-1">{splitAddress(job.shipper).name || '—'}</p>
                      </div>

                      <div className="flex-1 flex items-center min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-navy-600 shrink-0" />
                        <span className="flex-1 border-t border-dashed border-gray-300 dark:border-navy-600 mx-1" />
                        <Truck size={13} className="text-gray-300 dark:text-navy-600 shrink-0" />
                        <span className="flex-1 border-t border-dashed border-gray-300 dark:border-navy-600 mx-1" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>

                      <div className="text-right w-[92px] shrink-0">
                        <p className="text-[17px] font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">
                          {job.delivery_at ? formatTime(job.delivery_at) : '—'}
                        </p>
                        <p className="text-[9.5px] text-gray-400 dark:text-navy-500 truncate mt-1">{splitAddress(job.consignee).name || '—'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2.5 text-[9.5px] text-gray-400 dark:text-navy-500">
                      <span>{job.package_qty ?? '—'} pkg · {job.weight_kg ?? '—'} kg</span>
                      {job.direction && <span>{job.direction}</span>}
                      {job.temperature_range && <span>{job.temperature_range}</span>}
                      {job.declared_value != null && <span>{job.declared_value_currency ?? ''} {job.declared_value}</span>}
                    </div>
                  </div>
                );
              }

              /* Design 2 — kanban-style ticket card with status stripe */
              if (cardDesign === 2) {
                const stripeColor = job.dangerous_goods
                  ? 'bg-red-500'
                  : job.direction === 'Outbound'
                  ? 'bg-blue-500'
                  : 'bg-emerald-500';
                return (
                  <div
                    key={job.id}
                    {...dragProps}
                    className={`relative flex gap-3 pl-4 pr-3 py-3 rounded-xl border cursor-pointer transition-all overflow-hidden ${
                      selected
                        ? 'border-emerald-300 dark:border-emerald-700 shadow-md bg-white dark:bg-navy-800'
                        : 'border-gray-100 dark:border-navy-800 hover:shadow-sm bg-gray-50/50 dark:bg-navy-900/40'
                    }`}
                  >
                    <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripeColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[12.5px] text-gray-900 dark:text-gray-100">{job.hawb_number}</span>
                        <span className="text-[13px] font-black text-gray-900 dark:text-gray-100 shrink-0">
                          {job.weight_kg ?? '—'} <span className="text-[9px] font-bold text-gray-400 dark:text-navy-500">kg</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-navy-300 mt-1.5 leading-snug truncate">{splitAddress(job.shipper).name || '—'}</p>
                      <p className="text-[9px] text-gray-300 dark:text-navy-600 leading-none my-0.5">↓</p>
                      <p className="text-[11px] text-gray-600 dark:text-navy-300 leading-snug truncate">{splitAddress(job.consignee).name || '—'}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                        {job.dangerous_goods_notes && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                            <TriangleAlert size={9} /> DG
                          </span>
                        )}
                        {pages && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                            <FileText size={9} /> {pages}
                          </span>
                        )}
                        {job.client_account && (
                          <span className="text-[9px] font-bold text-gray-500 dark:text-navy-400 bg-gray-100 dark:bg-navy-800 px-1.5 py-0.5 rounded-full">{job.client_account}</span>
                        )}
                        <span className="ml-auto text-[10.5px] font-bold text-gray-700 dark:text-gray-200">
                          {job.collection_at ? formatTime(job.collection_at) : '—'}
                        </span>
                        <ChevronRight size={13} className={selected ? 'text-emerald-500 shrink-0' : 'text-gray-300 dark:text-navy-600 shrink-0'} />
                      </div>
                    </div>
                  </div>
                );
              }

              /* Design 3 — dense spreadsheet-style table row */
              if (cardDesign === 3) {
                return (
                  <div
                    key={job.id}
                    {...dragProps}
                    className={`grid grid-cols-[24px_1fr_56px_56px_44px_50px] gap-2 items-center px-4 py-2.5 cursor-pointer text-[11px] border-b border-gray-50 dark:border-navy-800/70 transition-colors ${
                      selected ? 'bg-emerald-50/70 dark:bg-emerald-950/25' : 'hover:bg-gray-50/70 dark:hover:bg-navy-800/50'
                    }`}
                  >
                    <span className="text-gray-400 dark:text-navy-500 font-mono text-[10px]">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{job.hawb_number}</span>
                        {job.dangerous_goods_notes && <TriangleAlert size={10} className="text-red-500 shrink-0" />}
                        {pages && <FileText size={10} className="text-blue-500 shrink-0" />}
                      </div>
                      <p className="text-gray-400 dark:text-navy-500 truncate text-[10px] mt-0.5">{routeLine(job)}</p>
                    </div>
                    <span className="text-gray-600 dark:text-navy-300 text-right tabular-nums">{job.collection_at ? formatTime(job.collection_at) : '—'}</span>
                    <span className="text-gray-400 dark:text-navy-500 text-right tabular-nums">{job.delivery_at ? formatTime(job.delivery_at) : '—'}</span>
                    <span className="text-gray-400 dark:text-navy-500 text-right tabular-nums">{job.package_qty ?? '—'}</span>
                    <span className="text-gray-400 dark:text-navy-500 text-right tabular-nums">{job.weight_kg ?? '—'}</span>
                  </div>
                );
              }

              /* Design 4 — badge row + label/value data grid */
              if (cardDesign === 4) {
                return (
                  <div
                    key={job.id}
                    {...dragProps}
                    className={`flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors border-l-2 ${
                      selected
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500'
                        : 'border-transparent hover:bg-gray-50/70 dark:hover:bg-navy-800/50'
                    }`}
                  >
                    {!locked && <GripVertical size={14} className="text-gray-300 dark:text-navy-600 cursor-grab shrink-0" />}
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-navy-800 dark:bg-navy-700 text-white text-[11px] font-bold shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12px]">{job.hawb_number}</span>
                        {job.client_account && (
                          <span className="text-[9px] font-bold text-gray-500 dark:text-navy-400 bg-gray-100 dark:bg-navy-800 px-1.5 py-0.5 rounded-full">
                            {job.client_account}
                          </span>
                        )}
                        {pages && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                            <FileText size={9} /> {pages}
                          </span>
                        )}
                        {job.dangerous_goods_notes && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                            <TriangleAlert size={9} /> {job.dangerous_goods_notes}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-gray-400 dark:text-navy-500 truncate mt-0.5">{routeLine(job)}</p>
                      <div className="grid grid-cols-4 gap-x-3 gap-y-2 mt-2.5 pt-2.5 border-t border-gray-100 dark:border-navy-800/70">
                        {[
                          { label: 'Collection', value: job.collection_at ? formatTime(job.collection_at) : '—' },
                          { label: 'Delivery', value: job.delivery_at ? formatTime(job.delivery_at) : '—' },
                          { label: 'Packages', value: job.package_qty ?? '—' },
                          { label: 'Weight', value: job.weight_kg != null ? `${job.weight_kg} kg` : '—' },
                          { label: 'Direction', value: job.direction ?? '—' },
                          { label: 'Handling', value: job.temperature_range ?? '—' },
                          { label: 'Dimensions', value: job.dimensions ? `${job.dimensions} cm` : '—' },
                          { label: 'Value', value: job.declared_value != null ? `${job.declared_value_currency ?? ''} ${job.declared_value}` : '—' },
                        ].map(cell => (
                          <div key={cell.label} className="min-w-0">
                            <p className="text-[8.5px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide">{cell.label}</p>
                            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate">{cell.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={14} className={selected ? 'text-emerald-500 shrink-0' : 'text-gray-300 dark:text-navy-600 shrink-0'} />
                  </div>
                );
              }

              /* Design 5 — badge row + inline icon-tag meta strip */
              return (
                <div
                  key={job.id}
                  {...dragProps}
                  className={`flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors border-l-2 ${
                    selected
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500'
                      : 'border-transparent hover:bg-gray-50/70 dark:hover:bg-navy-800/50'
                  }`}
                >
                  {!locked && <GripVertical size={14} className="text-gray-300 dark:text-navy-600 cursor-grab shrink-0" />}
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-navy-800 dark:bg-navy-700 text-white text-[11px] font-bold shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[12px]">{job.hawb_number}</span>
                      {job.client_account && (
                        <span className="text-[9px] font-bold text-gray-500 dark:text-navy-400 bg-gray-100 dark:bg-navy-800 px-1.5 py-0.5 rounded-full">
                          {job.client_account}
                        </span>
                      )}
                      {pages && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                          <FileText size={9} /> {pages}
                        </span>
                      )}
                      {job.dangerous_goods_notes && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded-full">
                          <TriangleAlert size={9} /> {job.dangerous_goods_notes}
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-gray-400 dark:text-navy-500 truncate mt-0.5">{routeLine(job)}</p>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5 text-[10px] font-medium text-gray-500 dark:text-navy-400">
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {job.collection_at ? formatTime(job.collection_at) : '—'} → {job.delivery_at ? formatTime(job.delivery_at) : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <PackageIcon size={10} /> {job.package_qty ?? '—'} · {job.weight_kg ?? '—'} kg
                      </span>
                      {job.direction && (
                        <span className="flex items-center gap-1"><ArrowLeftRight size={10} /> {job.direction}</span>
                      )}
                      {job.temperature_range && (
                        <span className="flex items-center gap-1"><Thermometer size={10} /> {job.temperature_range}</span>
                      )}
                      {job.dimensions && (
                        <span className="flex items-center gap-1"><Ruler size={10} /> {job.dimensions} cm</span>
                      )}
                      {job.declared_value != null && (
                        <span className="flex items-center gap-1"><Banknote size={10} /> {job.declared_value_currency ?? ''} {job.declared_value}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className={selected ? 'text-emerald-500 shrink-0' : 'text-gray-300 dark:text-navy-600 shrink-0'} />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100 dark:border-navy-800">
            {exportError && (
              <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">{exportError}</span>
            )}

            {manifest.status === 'open' && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-navy-900 dark:bg-navy-700 hover:bg-navy-800 dark:hover:bg-navy-600 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
              >
                <Download size={13} /> {exporting ? 'Exporting…' : 'Export manifest'}
              </button>
            )}

            {(manifest.status === 'booked' || manifest.status === 'on_hold') && (
              <>
                <button
                  onClick={handleHold}
                  disabled={holding || manifest.status === 'on_hold'}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
                >
                  {manifest.status === 'on_hold' ? 'On Hold' : holding ? 'Holding…' : 'Put on Hold'}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
                >
                  <Check size={13} /> {confirming ? 'Confirming…' : 'Confirm'}
                </button>
              </>
            )}

            {manifest.status === 'confirmed' && (
              <button
                onClick={handleMarkExported}
                disabled={markingExported}
                className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-navy-900 dark:bg-navy-700 hover:bg-navy-800 dark:hover:bg-navy-600 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
              >
                <Download size={13} /> {markingExported ? 'Marking…' : 'Mark Exported'}
              </button>
            )}

            {manifest.status === 'exported' && (
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 dark:text-emerald-400 px-4 py-2">
                <Download size={13} /> Exported
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
