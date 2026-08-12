'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, ChevronDown, Check, Package, CalendarDays, RefreshCw, CaseSensitive, CircleDot, Hash, User, File, Search, X, CheckCircle2, FileSearch, MessageSquare, History, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetHawbManifestsQuery, useGetJobUpdatesQuery, useGetProcessingDocumentsQuery, useRetryManifestExtractionMutation,
} from '@/services/hawbApi';
import { useManifestsLiveRefresh } from '@/hooks/useManifestsLiveRefresh';
import ApiErrorState from '@/components/ApiErrorState';
import Tooltip from '@/components/Tooltip';

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  open: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  booked: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  on_hold: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  exported: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  cancelled: 'bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400',
  ignored: 'bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-navy-400',
};

// The manifest's own Status column only makes sense once extraction has produced
// jobs — while extracting or failed, this column shows '—' and the separate
// Extract column (loading / completed / failed / ignored) carries the meaningful
// state. "ignored" is a same-filename resend that was skipped before extraction
// ever ran — distinct from "failed" (an extraction attempt that broke) since
// it's never retryable.
const EXTRACT_BADGE: Record<'loading' | 'completed' | 'failed' | 'ignored', string> = {
  loading: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  ignored: 'bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-navy-400',
};

const EXTRACT_LABEL: Record<'loading' | 'completed' | 'failed' | 'ignored', string> = {
  loading: 'Extracting…',
  completed: 'Completed',
  failed: 'Failed',
  ignored: 'Skipped (duplicate)',
};

const TAG_COLORS = [
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
];

function tagColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  open: 'Open',
  booked: 'Booked',
  confirmed: 'Confirmed',
  on_hold: 'On Hold',
  exported: 'Exported',
  cancelled: 'Cancelled',
  ignored: 'Ignored',
};

type SortKey = 'reference_number' | 'status' | 'job_count' | 'indigo_job_number' | 'total_weight_kg' | 'created_by_name' | 'created_at';

// Extract and HAWB Numbers have no single scalar to compare, so they're display-only columns.
const TABLE_COLUMNS: { label: string; icon: typeof CaseSensitive; sortKey?: SortKey }[] = [
  { label: 'Reference', icon: CaseSensitive, sortKey: 'reference_number' },
  { label: 'Status', icon: CircleDot, sortKey: 'status' },
  { label: 'Extract', icon: FileSearch },
  { label: 'Remarks', icon: MessageSquare },
  { label: 'Jobs', icon: Hash, sortKey: 'job_count' },
  { label: 'Indigo Job No', icon: Hash, sortKey: 'indigo_job_number' },
  { label: 'HAWB Numbers', icon: Hash },
  { label: 'Total Weight (kg)', icon: Hash, sortKey: 'total_weight_kg' },
  { label: 'Operator', icon: User, sortKey: 'created_by_name' },
  { label: 'Created', icon: CalendarDays, sortKey: 'created_at' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 50;

const HAWB_PREVIEW_COUNT = 2;

function PendingUpdateBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <Tooltip content={`${count} pending update${count > 1 ? 's' : ''} — open this manifest to review`}>
      <span
        className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800/60 ${className}`}
      >
        <RefreshCw size={9} /> {count}
      </span>
    </Tooltip>
  );
}

function HawbTag({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[10.5px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300">
      {value}
    </span>
  );
}

function HawbNumbersCell({ hawbNumbers }: { hawbNumbers: string[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Clamp to the viewport after the panel renders, same technique as Tooltip —
  // near a screen edge, the anchored position from toggleOpen() can otherwise
  // push part of the panel off-screen.
  useLayoutEffect(() => {
    if (!open || !coords || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const clampedLeft = Math.min(Math.max(rect.left, margin), maxLeft);
    const clampedTop = Math.min(Math.max(rect.top, margin), maxTop);
    const deltaLeft = clampedLeft - rect.left;
    const deltaTop = clampedTop - rect.top;
    if (Math.abs(deltaLeft) > 0.5 || Math.abs(deltaTop) > 0.5) {
      setCoords(c => (c ? { top: c.top + deltaTop, left: c.left + deltaLeft } : c));
    }
  }, [open, coords]);

  const preview = hawbNumbers.slice(0, HAWB_PREVIEW_COUNT);
  const overflowCount = hawbNumbers.length - HAWB_PREVIEW_COUNT;

  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  return (
    <div className="flex flex-nowrap items-center gap-1">
      {preview.map(h => <HawbTag key={h} value={h} />)}
      {overflowCount > 0 && (
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
          className={`shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
            open
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
              : 'bg-gray-50 dark:bg-navy-800/60 text-gray-400 dark:text-navy-500 hover:bg-gray-100 dark:hover:bg-navy-800'
          }`}
        >
          +{overflowCount} more
        </button>
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              style={{ position: 'fixed', top: coords.top, left: coords.left }}
              className="z-[100] w-64 bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-xl shadow-xl p-3"
            >
              <div className="mb-2">
                <span className="text-[10px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide">
                  {hawbNumbers.length} HAWB number{hawbNumbers.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                {hawbNumbers.map(h => <HawbTag key={h} value={h} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function PageSizeSelect({ value, options, onChange }: { value: number; options: number[]; onChange: (value: number) => void }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-md border text-[11.5px] font-semibold transition-colors ${
          open
            ? 'border-emerald-500/60 text-gray-900 dark:text-gray-100'
            : 'border-gray-200 dark:border-navy-700 text-gray-700 dark:text-navy-200 hover:border-gray-300 dark:hover:border-navy-600'
        }`}
      >
        {value}
        <ChevronDown size={12} className={`text-gray-400 dark:text-navy-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute z-20 bottom-full right-0 mb-1.5 w-16 bg-white dark:bg-navy-800 border border-gray-100 dark:border-navy-700 rounded-xl shadow-lg py-1"
          >
            {options.map(n => {
              const isSelected = n === value;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { onChange(n); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[12px] transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-navy-700'
                  }`}
                >
                  {n}
                  {isSelected && <Check size={12} className="shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Skel({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-gray-100 dark:bg-navy-800 ${className}`} />;
}

function ManifestsTableSkeleton() {
  return (
    <div className="bg-white dark:bg-navy-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-navy-700">
              {TABLE_COLUMNS.map(({ label, icon: Icon }, i) => (
                <th
                  key={label}
                  className={`px-4 pt-3 pb-2.5 text-[12px] font-medium text-gray-500 dark:text-navy-400 whitespace-nowrap ${i < TABLE_COLUMNS.length - 1 ? 'border-r border-gray-200 dark:border-navy-700' : ''}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon size={13} strokeWidth={1.8} className="text-gray-400 dark:text-navy-500" />
                    {label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-200 dark:border-navy-700">
                <td className="px-4 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-20 h-3.5" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-16 h-5 rounded-full" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-16 h-5 rounded-full" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-24 h-3.5" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-4 h-3.5" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-16 h-3.5" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <div className="flex items-center gap-1">
                    <Skel className="w-16 h-4" />
                    <Skel className="w-16 h-4" />
                    <Skel className="w-16 h-4" />
                  </div>
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-10 h-3.5" />
                </td>
                <td className="px-2 py-2.5 border-r border-gray-200 dark:border-navy-700">
                  <Skel className="w-14 h-5 rounded-full" />
                </td>
                <td className="pl-2 pr-4 py-2.5">
                  <Skel className="w-24 h-3.5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} ${time}`;
}

export default function ManifestsPage() {
  const router = useRouter();
  const { data: manifests = [], isLoading, isError, refetch } = useGetHawbManifestsQuery();
  const { data: jobUpdates = [] } = useGetJobUpdatesQuery();
  const { data: allProcessingDocs = [] } = useGetProcessingDocumentsQuery(undefined, { pollingInterval: 8000 });
  // Plain documents now get a placeholder manifest row instead — only MF-PCS
  // (blind) documents still rely on this banner, since they never get a row.
  const processingDocs = allProcessingDocs.filter(d => d.source_kind === 'blind');
  useManifestsLiveRefresh();
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'open' | 'pending' | 'exported'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);
  const [retryExtraction, { isLoading: retrying, originalArgs: retryingManifestId }] = useRetryManifestExtractionMutation();

  const toggleSort = (key: SortKey) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      return prev.dir === 'asc' ? { key, dir: 'desc' } : null;
    });
    setPage(0);
  };

  const pendingUpdateCounts = new Map<string, number>();
  for (const u of jobUpdates) {
    const manifestId = u.job.manifest_id;
    if (!manifestId) continue;
    pendingUpdateCounts.set(manifestId, (pendingUpdateCounts.get(manifestId) ?? 0) + 1);
  }

  // "Pending" here mirrors the Status column's own Pending badge (m.status
  // extracting/failed) rather than the separate 'pending_review' status —
  // that's what the badge actually reads for the rows this tab is meant to catch.
  const STATUS_TABS: { key: typeof statusTab; label: string; match: (m: (typeof manifests)[number]) => boolean }[] = [
    { key: 'all', label: 'All', match: () => true },
    { key: 'open', label: 'Open', match: m => m.status === 'open' },
    { key: 'pending', label: 'Pending', match: m => m.status === 'extracting' || m.status === 'failed' },
    { key: 'exported', label: 'Exported', match: m => m.status === 'exported' },
  ];
  const statusFilteredManifests = manifests.filter(STATUS_TABS.find(t => t.key === statusTab)!.match);

  const q = search.trim().toLowerCase();
  const filteredManifests = !q ? statusFilteredManifests : statusFilteredManifests.filter(m =>
    m.reference_number.toLowerCase().includes(q) ||
    (m.created_by_name ?? 'system').toLowerCase().includes(q) ||
    m.hawb_numbers.some(h => h.toLowerCase().includes(q))
  );

  const sortedManifests = sort ? [...filteredManifests].sort((a, b) => {
    const av = a[sort.key] ?? (typeof a[sort.key] === 'number' ? 0 : '');
    const bv = b[sort.key] ?? (typeof b[sort.key] === 'number' ? 0 : '');
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  }) : filteredManifests;

  const totalPages = Math.max(1, Math.ceil(sortedManifests.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const pagedManifests = sortedManifests.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mt-0.5">
            <Package size={16} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Manifests</h1>
            <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
              {filteredManifests.length} manifest{filteredManifests.length === 1 ? '' : 's'}
              {manifests.length !== filteredManifests.length ? ` of ${manifests.length}` : ''} — track jobs, weight, and export status in one place
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => router.push('/dashboard/manifests/history')}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
          >
            <History size={13} strokeWidth={1.8} />
            Merge History
          </button>
          <div className="relative">
            <Search size={13} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-navy-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search reference, HAWB, operator…"
              aria-label="Search manifests"
              className="w-64 h-8 pl-8 pr-7 bg-transparent border-0 border-b border-gray-200 dark:border-navy-700 text-[12px] text-gray-700 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(0); }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 dark:text-navy-600 hover:text-gray-500 dark:hover:text-navy-400 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-navy-800/60 rounded-lg w-fit">
        {STATUS_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setStatusTab(key); setPage(0); }}
            className={`relative px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
              statusTab === key
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200'
            }`}
          >
            {statusTab === key && (
              <motion.span
                layoutId="manifest-status-tab-bg"
                className="absolute inset-0 bg-white dark:bg-navy-900 rounded-md shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </motion.div>

      {processingDocs.length > 0 && (
        <motion.div variants={staggerItem} className="flex items-center gap-2 text-[11.5px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2">
          <RefreshCw size={12} className="animate-spin" />
          Processing {processingDocs.length} MF-PCS email{processingDocs.length === 1 ? '' : 's'}…
        </motion.div>
      )}

      {isLoading ? (
        <ManifestsTableSkeleton />
      ) : isError ? (
        <ApiErrorState title="Failed to load manifests" onRetry={refetch} />
      ) : (
        <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl overflow-hidden">
          <div className="overflow-auto max-h-[78vh]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-20 bg-white dark:bg-navy-900">
                <tr className="border-b border-gray-200 dark:border-navy-700">
                  {TABLE_COLUMNS.map(({ label, icon: Icon, sortKey }, i) => (
                    <th
                      key={label}
                      className={`px-4 pt-3 pb-2.5 text-[12px] font-medium text-gray-500 dark:text-navy-400 whitespace-nowrap ${i < TABLE_COLUMNS.length - 1 ? 'border-r border-gray-200 dark:border-navy-700' : ''}`}
                    >
                      {sortKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(sortKey)}
                          className="inline-flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-navy-200 transition-colors"
                        >
                          <Icon size={13} strokeWidth={1.8} className="text-gray-400 dark:text-navy-500" />
                          {label}
                          {sort?.key === sortKey ? (
                            sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                          ) : (
                            <ArrowUpDown size={11} className="text-gray-300 dark:text-navy-600" />
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon size={13} strokeWidth={1.8} className="text-gray-400 dark:text-navy-500" />
                          {label}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody key={`${statusTab}-${sort?.key ?? 'none'}-${sort?.dir ?? ''}-${clampedPage}-${pageSize}`}>
                {filteredManifests.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="h-48 text-center text-gray-300 dark:text-navy-600 text-sm">
                      {q || statusTab !== 'all' ? 'No manifests match your filters' : 'No manifests yet'}
                    </td>
                  </tr>
                )}
                {pagedManifests.map((m, i) => {
                  const isExtracting = m.status === 'extracting';
                  const isFailed = m.status === 'failed';
                  const isIgnored = m.status === 'ignored';
                  const isPending = isExtracting || isFailed;
                  const extractState = isExtracting ? 'loading' : isFailed ? 'failed' : isIgnored ? 'ignored' : 'completed';
                  const isRetrying = retrying && retryingManifestId === m.id;

                  return (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={isPending ? undefined : { y: -1, transition: { duration: 0.15, ease: 'easeOut' } }}
                    whileFocus={isPending ? undefined : { y: -1, transition: { duration: 0.15, ease: 'easeOut' } }}
                    transition={{ duration: 0.6, delay: i * 0.055, ease: [0.45, 0, 0.15, 1] as const }}
                    {...(isPending ? {} : {
                      onClick: () => router.push(`/dashboard/manifests/${m.id}`),
                      onKeyDown: (e: ReactKeyboardEvent<HTMLTableRowElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/dashboard/manifests/${m.id}`);
                        }
                      },
                      tabIndex: 0,
                      role: 'link',
                      'aria-label': `Open manifest ${m.reference_number}`,
                    })}
                    className={`group relative border-b border-gray-200 dark:border-navy-700 outline-none transition-colors duration-150 ${
                      isPending
                        ? ''
                        : 'cursor-pointer hover:z-10 focus-visible:z-10 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10 hover:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.3)] dark:hover:shadow-[0_4px_16px_-4px_rgba(16,185,129,0.2)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-400'
                    }`}
                  >
                    <td className="px-4 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap group-hover:rounded-l-lg">
                      <span className="inline-flex items-center gap-1.5">
                        <File size={13} strokeWidth={1.8} className="text-gray-300 dark:text-navy-600 shrink-0 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
                        <span className="font-mono font-semibold text-gray-900 dark:text-gray-100 text-[12.5px] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {m.reference_number}
                        </span>
                        <PendingUpdateBadge count={pendingUpdateCounts.get(m.id) ?? 0} />
                      </span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          Pending
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[m.status]}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {STATUS_LABEL[m.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${EXTRACT_BADGE[extractState]}`}>
                        {isExtracting && <RefreshCw size={9} className="animate-spin" />}
                        {(isFailed || isIgnored) && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
                        {extractState === 'completed' && <CheckCircle2 size={9} />}
                        {EXTRACT_LABEL[extractState]}
                      </span>
                      {isFailed && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); retryExtraction(m.id); }}
                          disabled={isRetrying}
                          aria-label="Retry extraction"
                          className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-navy-300 hover:bg-gray-200 dark:hover:bg-navy-700 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw size={9} className={isRetrying ? 'animate-spin' : ''} />
                          Retry
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] text-gray-500 dark:text-navy-400 max-w-[220px]">
                      {m.remarks ? (
                        <Tooltip content={m.remarks} side="top" className="block max-w-[220px]">
                          <div
                            onClick={e => e.stopPropagation()}
                            className="max-w-[220px] truncate cursor-default"
                          >
                            {m.remarks}
                          </div>
                        </Tooltip>
                      ) : (
                        <span className="text-gray-300 dark:text-navy-600">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] font-medium text-gray-700 dark:text-navy-200">{isPending ? '—' : m.job_count}</td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] font-mono text-gray-700 dark:text-navy-200">
                      {m.indigo_job_number ?? <span className="text-gray-300 dark:text-navy-600 font-sans">—</span>}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 max-w-[280px]">
                      {isPending ? <span className="text-[12px] text-gray-400 dark:text-navy-500">—</span> : <HawbNumbersCell hawbNumbers={m.hawb_numbers} />}
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] font-medium text-gray-700 dark:text-navy-200">{isPending ? '—' : m.total_weight_kg}</td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full ${tagColor(m.created_by_name ?? 'System')}`}>
                        {m.created_by_name ?? 'System'}
                      </span>
                    </td>
                    <td className="pl-2 pr-4 py-2 whitespace-nowrap group-hover:rounded-r-lg">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] text-gray-500 dark:text-navy-400">{formatDateTime(m.created_at)}</span>
                        {!isPending && (
                          <ChevronRight size={13} className="ml-1 text-gray-300 dark:text-navy-600 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-all" />
                        )}
                      </span>
                    </td>
                  </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end px-4 py-2.5 border-t border-gray-200 dark:border-navy-700 text-[11.5px] text-gray-500 dark:text-navy-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <PageSizeSelect
                  value={pageSize}
                  options={PAGE_SIZE_OPTIONS}
                  onChange={(n) => { setPageSize(n); setPage(0); }}
                />
              </div>
              <span>
                {sortedManifests.length === 0
                  ? '0 of 0'
                  : `${clampedPage * pageSize + 1}–${Math.min((clampedPage + 1) * pageSize, sortedManifests.length)} of ${sortedManifests.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={clampedPage === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  aria-label="Previous page"
                  className="p-1 rounded-md text-gray-400 dark:text-navy-500 hover:text-gray-700 dark:hover:text-navy-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:text-navy-500 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={clampedPage >= totalPages - 1}
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  aria-label="Next page"
                  className="p-1 rounded-md text-gray-400 dark:text-navy-500 hover:text-gray-700 dark:hover:text-navy-200 hover:bg-gray-50 dark:hover:bg-navy-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 dark:disabled:hover:text-navy-500 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
