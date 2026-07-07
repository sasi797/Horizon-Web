'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Package, TriangleAlert } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetHawbJobsQuery, useCreateHawbManifestMutation, type HawbJob } from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import { splitAddress } from '@/lib/hawbFormat';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'ready_to_manifest', label: 'Ready to Manifest' },
  { key: 'manifested', label: 'Manifested' },
];

const STATUS_BADGE: Record<string, string> = {
  pending_review: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800/60',
  ready_to_manifest: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800/60',
  manifested: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  ready_to_manifest: 'Ready to Manifest',
  manifested: 'Manifested',
};

function PartyCell({ value }: { value: string | null }) {
  const { name, address } = splitAddress(value);
  return (
    <td className="px-4 py-3.5 max-w-[220px]">
      <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 truncate">{name}</p>
      {address && <p className="text-[10.5px] text-gray-400 dark:text-slate-500 truncate mt-0.5">{address}</p>}
    </td>
  );
}

export default function JobsPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useGetHawbJobsQuery({
    status: status || undefined,
    search: search || undefined,
    page,
    page_size: 25,
  });

  const [createManifest, { isLoading: manifesting }] = useCreateHawbManifestMutation();

  const jobs: HawbJob[] = useMemo(() => data?.items ?? [], [data]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const readyIds = jobs.filter(j => j.status === 'ready_to_manifest').map(j => j.id);
    setSelected(prev => (prev.size === readyIds.length ? new Set() : new Set(readyIds)));
  };

  const handleManifest = async () => {
    if (selected.size === 0) return;
    try {
      await createManifest(Array.from(selected)).unwrap();
      setSelected(new Set());
      refetch();
    } catch {
      // surfaced via mutation error state if needed
    }
  };

  const readyCount = jobs.filter(j => j.status === 'ready_to_manifest').length;

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">HAWB Jobs</h1>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{data?.total ?? 0} total jobs</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search HAWB, shipper, consignee…"
            className="text-[12px] border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 w-64 focus:outline-none focus:border-amber-300 dark:focus:border-amber-600 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-900/40"
          />
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-0.5 gap-0.5 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              status === tab.key
                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-400 shadow-sm'
                : 'text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl px-4 py-2.5"
        >
          <span className="text-[12px] font-bold text-amber-700 dark:text-amber-400">{selected.size} job{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={handleManifest}
            disabled={manifesting}
            className="ml-auto text-[12px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-4 py-1.5 rounded-lg transition-colors"
          >
            {manifesting ? 'Creating manifest…' : 'Manifest Selected'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[12px] font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          >
            Clear
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load jobs" onRetry={refetch} />
      ) : jobs.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 dark:text-slate-600 text-sm bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
          No jobs found
        </div>
      ) : (
        <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={readyCount > 0 && selected.size === readyCount}
                    onChange={toggleAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                {['HAWB', 'Shipper', 'Consignee', 'Weight (kg)', 'Status', 'Received'].map(h => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap ${h === 'Weight (kg)' ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/70">
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3.5">
                    {job.status === 'ready_to_manifest' && (
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggle(job.id)}
                        className="rounded cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Link href={`/dashboard/jobs/${job.id}`} className="flex items-center gap-1.5 font-mono font-bold text-amber-600 dark:text-amber-400 text-[12px] hover:underline w-fit">
                      <FileText size={13} className="shrink-0 opacity-50" />
                      {job.hawb_number}
                    </Link>
                    {job.packages.length > 1 && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                        <Package size={9} /> {job.packages.length} pkgs
                      </span>
                    )}
                  </td>
                  <PartyCell value={job.shipper} />
                  <PartyCell value={job.consignee} />
                  <td className="px-4 py-3.5 text-[12px] text-gray-700 dark:text-slate-300 whitespace-nowrap text-right tabular-nums">{job.weight_kg ?? '—'}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[job.status]}`}>
                        {STATUS_LABEL[job.status]}
                      </span>
                      {job.dangerous_goods && (
                        <TriangleAlert size={13} className="text-red-500 dark:text-red-400 shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[11px] text-gray-500 dark:text-slate-500 whitespace-nowrap">
                    {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800">
              <span className="text-[11px] text-gray-400 dark:text-slate-500">Page {data.page} of {data.total_pages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-[11px] font-bold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                  disabled={page >= data.total_pages}
                  className="text-[11px] font-bold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
