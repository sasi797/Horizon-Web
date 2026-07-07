'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GripVertical, X, Plus, Download, ChevronDown, TriangleAlert } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetHawbManifestQuery,
  useGetHawbJobsQuery,
  useRemoveHawbJobFromManifestMutation,
  useAddJobsToManifestMutation,
  useReorderManifestJobsMutation,
  useExportManifestMutation,
  type HawbJob,
} from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import Modal from '@/components/Modal';
import { splitAddress, cityLine } from '@/lib/hawbFormat';

const MANIFEST_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-1 ring-gray-200 dark:ring-slate-700',
  exported: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/60',
};

const MANIFEST_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  exported: 'Exported',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string | null): string {
  if (!name) return '—';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function routeLine(job: HawbJob): string {
  const shipper = splitAddress(job.shipper);
  const consignee = splitAddress(job.consignee);
  return `${shipper.name} · ${cityLine(job.shipper)} → ${consignee.name} · ${cityLine(job.consignee)}`;
}

export default function ManifestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: manifest, isLoading, isError, refetch } = useGetHawbManifestQuery(id);
  const [removeJob] = useRemoveHawbJobFromManifestMutation();
  const [addJobs, { isLoading: adding }] = useAddJobsToManifestMutation();
  const [reorderJobs] = useReorderManifestJobsMutation();
  const [exportManifest, { isLoading: exporting }] = useExportManifestMutation();

  const [orderedJobs, setOrderedJobs] = useState<HawbJob[]>([]);
  const [syncedJobs, setSyncedJobs] = useState<HawbJob[] | undefined>(undefined);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  if (manifest && manifest.jobs !== syncedJobs) {
    setSyncedJobs(manifest.jobs);
    setOrderedJobs(manifest.jobs);
  }

  const { data: readyPage } = useGetHawbJobsQuery(
    { status: 'ready_to_manifest', page_size: 100 },
    { skip: !addModalOpen }
  );

  if (isLoading) {
    return <div className="h-64 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 animate-pulse" />;
  }
  if (isError || !manifest) {
    return <ApiErrorState title="Failed to load manifest" onRetry={refetch} />;
  }

  const locked = manifest.status === 'exported';
  const dgCount = orderedJobs.filter(j => j.dangerous_goods).length;
  const packageCount = orderedJobs.reduce((sum, j) => sum + (j.package_qty ?? 0), 0);

  const persistOrder = async (jobs: HawbJob[]) => {
    try {
      await reorderJobs({ manifestId: manifest.id, job_ids: jobs.map(j => j.id) }).unwrap();
    } catch {
      // no-op — refetch on next render will restore server order
    }
  };

  const handleSortByCollectionTime = () => {
    const sorted = [...orderedJobs].sort((a, b) => {
      if (!a.collection_at) return 1;
      if (!b.collection_at) return -1;
      return new Date(a.collection_at).getTime() - new Date(b.collection_at).getTime();
    });
    setOrderedJobs(sorted);
    persistOrder(sorted);
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

  const handleRemove = async (jobId: string) => {
    try {
      await removeJob({ manifestId: manifest.id, jobId }).unwrap();
    } catch {
      // no-op
    }
  };

  const toggleAddSelection = (jobId: string) => {
    setSelectedToAdd(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const handleAddJobs = async () => {
    if (selectedToAdd.size === 0) return;
    try {
      await addJobs({ manifestId: manifest.id, job_ids: Array.from(selectedToAdd) }).unwrap();
      setSelectedToAdd(new Set());
      setAddModalOpen(false);
    } catch {
      // no-op
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportManifest(manifest.id).unwrap();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${manifest.reference_number}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // no-op
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start gap-3">
        <button onClick={() => router.push('/dashboard/manifests')} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 mt-0.5">
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
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
            Created {formatDate(manifest.created_at)} · operator {initials(manifest.created_by_name)} ·{' '}
            {manifest.exported_at ? `exported ${formatDate(manifest.exported_at)}` : 'not yet exported'}
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-4 gap-3">
        {[
          { label: 'Stops', value: orderedJobs.length },
          { label: 'Packages', value: packageCount },
          { label: 'Total weight', value: `${manifest.total_weight_kg.toFixed(2)} kg` },
          { label: 'Dangerous goods', value: dgCount },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-lg font-black text-gray-900 dark:text-gray-100 mt-0.5">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-bold text-gray-700 dark:text-slate-200">Run order</h2>
          <p className="text-[10.5px] text-gray-400 dark:text-slate-500">
            {locked ? 'Manifest is exported and locked' : 'Drag to reorder — sets the driver\'s sequence'}
          </p>
        </div>
        <button
          onClick={handleSortByCollectionTime}
          disabled={locked}
          className="flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
        >
          Sort: collection time <ChevronDown size={12} />
        </button>
      </motion.div>

      <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-800">
              {['Order', 'Job & route', 'Collection', 'Packages', 'DG', ''].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800/70">
            {orderedJobs.map((job, index) => (
              <tr
                key={job.id}
                draggable={!locked}
                onDragStart={() => setDragIndex(index)}
                onDragOver={e => { e.preventDefault(); handleDragOver(index); }}
                onDrop={handleDrop}
                className="hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {!locked && <GripVertical size={14} className="text-gray-300 dark:text-slate-600 cursor-grab" />}
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800 dark:bg-slate-700 text-white text-[11px] font-bold">
                      {index + 1}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5 max-w-[280px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[12px]">{job.hawb_number}</span>
                    {job.client_account && (
                      <span className="text-[9px] font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                        {job.client_account}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-gray-400 dark:text-slate-500 truncate mt-0.5">{routeLine(job)}</p>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100">{job.collection_at ? formatTime(job.collection_at) : '—'}</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-slate-500">
                    Collect{job.collection_at ? ` · ${formatDate(job.collection_at)}` : ''}
                  </p>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <p className="text-[12px] font-bold text-gray-800 dark:text-gray-100">
                    {job.package_qty ?? '—'} · {job.weight_kg ?? '—'} kg
                  </p>
                  <p className="text-[10.5px] text-gray-400 dark:text-slate-500">{job.temperature_range || 'Ambient'}</p>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {job.dangerous_goods_notes ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
                      <TriangleAlert size={10} /> {job.dangerous_goods_notes}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-300 dark:text-slate-600">None</span>
                  )}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-right">
                  <button
                    onClick={() => handleRemove(job.id)}
                    disabled={locked}
                    className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={() => setAddModalOpen(true)}
            disabled={locked}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} /> Add job
          </button>
          <p className="text-[10.5px] text-gray-400 dark:text-slate-500">File-drop stub until courier target is confirmed</p>
          <button
            onClick={handleExport}
            disabled={locked || exporting}
            className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-60 px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={13} /> {locked ? 'Exported' : exporting ? 'Exporting…' : 'Export manifest'}
          </button>
        </div>
      </motion.div>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)}>
        <div className="p-4 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-[13px] font-bold text-gray-800 dark:text-gray-100">Add job to manifest</h3>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">Jobs ready to manifest</p>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {(readyPage?.items ?? []).length === 0 ? (
            <p className="text-[12px] text-gray-400 dark:text-slate-500 text-center py-6">No jobs are ready to manifest</p>
          ) : (
            readyPage!.items.map(job => (
              <label
                key={job.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedToAdd.has(job.id)}
                  onChange={() => toggleAddSelection(job.id)}
                  className="rounded cursor-pointer"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-mono font-bold text-amber-600 dark:text-amber-400">{job.hawb_number}</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-slate-500 truncate">{routeLine(job)}</p>
                </div>
              </label>
            ))
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={() => setAddModalOpen(false)}
            className="text-[12px] font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleAddJobs}
            disabled={selectedToAdd.size === 0 || adding}
            className="text-[12px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 px-4 py-1.5 rounded-lg transition-colors"
          >
            {adding ? 'Adding…' : `Add ${selectedToAdd.size || ''} job${selectedToAdd.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}
