'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetHawbManifestQuery, useRemoveHawbJobFromManifestMutation } from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';

export default function ManifestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: manifest, isLoading, isError, refetch } = useGetHawbManifestQuery(id);
  const [removeJob, { isLoading: removing }] = useRemoveHawbJobFromManifestMutation();

  if (isLoading) {
    return <div className="h-64 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 animate-pulse" />;
  }
  if (isError || !manifest) {
    return <ApiErrorState title="Failed to load manifest" onRetry={refetch} />;
  }

  const handleRemove = async (jobId: string) => {
    try {
      await removeJob({ manifestId: manifest.id, jobId }).unwrap();
    } catch {
      // no-op
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/manifests')} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight font-mono">{manifest.reference_number}</h1>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
            {manifest.job_count} jobs · {manifest.total_weight_kg} kg total
          </p>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-800">
              {['HAWB', 'Shipper', 'Consignee', 'Weight (kg)', ''].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800/70">
            {manifest.jobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link href={`/dashboard/jobs/${job.id}`} className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[12px] hover:underline">
                    {job.hawb_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[12px] text-gray-700 dark:text-slate-300 max-w-[200px] truncate">{job.shipper ?? '—'}</td>
                <td className="px-4 py-3 text-[12px] text-gray-700 dark:text-slate-300 max-w-[200px] truncate">{job.consignee ?? '—'}</td>
                <td className="px-4 py-3 text-[12px] text-gray-700 dark:text-slate-300 whitespace-nowrap">{job.weight_kg ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => handleRemove(job.id)}
                    disabled={removing}
                    className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    Remove from manifest
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}
