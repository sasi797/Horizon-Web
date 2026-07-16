'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Package, CalendarDays, RefreshCw, CaseSensitive, CircleDot, Hash, User, File, Search, X } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetHawbManifestsQuery, useGetJobUpdatesQuery } from '@/services/hawbApi';
import { useManifestsLiveRefresh } from '@/hooks/useManifestsLiveRefresh';
import ApiErrorState from '@/components/ApiErrorState';
import Tooltip from '@/components/Tooltip';

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  open: 'bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-navy-200',
  booked: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  on_hold: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  exported: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
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
};

const TABLE_COLUMNS = [
  { label: 'Reference', icon: CaseSensitive },
  { label: 'Status', icon: CircleDot },
  { label: 'Jobs', icon: Hash },
  { label: 'HAWB Numbers', icon: Hash },
  { label: 'Total Weight (kg)', icon: Hash },
  { label: 'Operator', icon: User },
  { label: 'Created', icon: CalendarDays },
];

const HAWB_PREVIEW_COUNT = 3;

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
    <div className="flex flex-wrap items-center gap-1">
      {preview.map(h => <HawbTag key={h} value={h} />)}
      {overflowCount > 0 && (
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
          className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
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

function formatDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} ${time}`;
}

export default function ManifestsPage() {
  const { data: manifests = [], isLoading, isError, refetch } = useGetHawbManifestsQuery();
  const { data: jobUpdates = [] } = useGetJobUpdatesQuery();
  useManifestsLiveRefresh();
  const [search, setSearch] = useState('');

  const pendingUpdateCounts = new Map<string, number>();
  for (const u of jobUpdates) {
    const manifestId = u.job.manifest_id;
    if (!manifestId) continue;
    pendingUpdateCounts.set(manifestId, (pendingUpdateCounts.get(manifestId) ?? 0) + 1);
  }

  const q = search.trim().toLowerCase();
  const filteredManifests = !q ? manifests : manifests.filter(m =>
    m.reference_number.toLowerCase().includes(q) ||
    (m.created_by_name ?? 'system').toLowerCase().includes(q) ||
    m.hawb_numbers.some(h => h.toLowerCase().includes(q))
  );

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
              {q && manifests.length !== filteredManifests.length ? ` of ${manifests.length}` : ''} — track jobs, weight, and export status in one place
            </p>
          </div>
        </div>
        <div className="relative shrink-0">
          <Search size={13} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-navy-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, HAWB, operator…"
            aria-label="Search manifests"
            className="w-64 h-8 pl-8 pr-7 bg-transparent border-0 border-b border-gray-200 dark:border-navy-700 text-[12px] text-gray-700 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 dark:text-navy-600 hover:text-gray-500 dark:hover:text-navy-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load manifests" onRetry={refetch} />
      ) : filteredManifests.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 dark:text-navy-600 text-sm bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800">
          {q ? 'No manifests match your search' : 'No manifests yet'}
        </div>
      ) : (
        <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-navy-700">
                  {TABLE_COLUMNS.map(({ label, icon: Icon }, i) => (
                    <th
                      key={label}
                      className={`px-4 pb-2.5 text-[12px] font-medium text-gray-500 dark:text-navy-400 whitespace-nowrap ${i < TABLE_COLUMNS.length - 1 ? 'border-r border-gray-200 dark:border-navy-700' : ''}`}
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
                {filteredManifests.map((m) => (
                  <tr
                    key={m.id}
                    className="group border-b border-gray-200 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:bg-gray-50/60 dark:hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="px-4 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <File size={13} strokeWidth={1.8} className="text-gray-300 dark:text-navy-600 shrink-0" />
                        <Link href={`/dashboard/manifests/${m.id}`} className="font-mono font-semibold text-gray-900 dark:text-gray-100 text-[12.5px] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                          {m.reference_number}
                        </Link>
                        <PendingUpdateBadge count={pendingUpdateCounts.get(m.id) ?? 0} />
                      </span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[m.status]}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] font-medium text-gray-700 dark:text-navy-200">{m.job_count}</td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 max-w-[280px]">
                      <HawbNumbersCell hawbNumbers={m.hawb_numbers} />
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] font-medium text-gray-700 dark:text-navy-200">{m.total_weight_kg}</td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full ${tagColor(m.created_by_name ?? 'System')}`}>
                        {m.created_by_name ?? 'System'}
                      </span>
                    </td>
                    <td className="pl-2 pr-4 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] text-gray-500 dark:text-navy-400">{formatDateTime(m.created_at)}</span>
                        <ChevronRight size={13} className="ml-1 text-gray-300 dark:text-navy-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
