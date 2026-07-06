'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetHawbJobsQuery, useCreateHawbManifestMutation } from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'ready_to_manifest', label: 'Ready to Manifest' },
  { key: 'manifested', label: 'Manifested' },
];

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

  const jobs = useMemo(() => data?.items ?? [], [data]);

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
          <h1 className="text-base font-black text-gray-900 leading-tight">HAWB Jobs</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{data?.total ?? 0} total jobs</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search HAWB, shipper, consignee…"
            className="text-[12px] border border-gray-200 rounded-xl px-3 py-2 bg-white w-64 focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatus(tab.key); setPage(1); }}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
              status === tab.key ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5"
        >
          <span className="text-[12px] font-bold text-amber-700">{selected.size} job{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={handleManifest}
            disabled={manifesting}
            className="ml-auto text-[12px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-4 py-1.5 rounded-lg transition-colors"
          >
            {manifesting ? 'Creating manifest…' : 'Manifest Selected'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[12px] font-semibold text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load jobs" onRetry={refetch} />
      ) : jobs.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 text-sm bg-white rounded-2xl border border-gray-100">
          No jobs found
        </div>
      ) : (
        <motion.div variants={staggerItem} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={readyCount > 0 && selected.size === readyCount}
                    onChange={toggleAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                {['HAWB', 'Shipper', 'Consignee', 'Weight (kg)', 'Status', 'Received'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3">
                    {job.status === 'ready_to_manifest' && (
                      <input
                        type="checkbox"
                        checked={selected.has(job.id)}
                        onChange={() => toggle(job.id)}
                        className="rounded cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/dashboard/jobs/${job.id}`} className="font-mono font-bold text-amber-600 text-[12px] hover:underline">
                      {job.hawb_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-700 max-w-[200px] truncate">{job.shipper ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700 max-w-[200px] truncate">{job.consignee ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700 whitespace-nowrap">{job.weight_kg ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[job.status]}`}>
                      {STATUS_LABEL[job.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                    {new Date(job.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">Page {data.page} of {data.total_pages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                  disabled={page >= data.total_pages}
                  className="text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
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
