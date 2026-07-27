'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ListTree } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useCreateDropdownFieldMutation } from '@/services/dropdownApi';
import RequireRole from '@/components/RequireRole';

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full h-9 px-3 bg-transparent border border-gray-200 dark:border-navy-700 rounded-lg text-[13px] text-gray-800 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors';

function NewMenuConfigurationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createField, { isLoading }] = useCreateDropdownFieldMutation();

  const [module, setModule] = useState(searchParams.get('module') ?? '');
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = module.trim() && fieldName.trim() && fieldLabel.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createField({
        module: module.trim(),
        field_name: fieldName.trim(),
        field_label: fieldLabel.trim(),
      }).unwrap();
      router.push('/dashboard/menu-configuration');
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to create field. Please try again.');
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4 max-w-lg">
      <motion.div variants={staggerItem} className="flex items-center gap-2.5">
        <Link href="/dashboard/menu-configuration" className="text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <ListTree size={16} strokeWidth={2} />
        </span>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">New Dropdown Field</h1>
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={handleSubmit} className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl p-5 space-y-4">
        <Field label="Module">
          <input type="text" value={module} onChange={(e) => setModule(e.target.value)} className={inputClass} placeholder="manifest" required />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Which part of the app this dropdown belongs to — e.g. &quot;manifest&quot;</p>
        </Field>
        <Field label="Field name">
          <input type="text" value={fieldName} onChange={(e) => setFieldName(e.target.value)} className={inputClass} placeholder="account_number" required />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Lowercase, no spaces — matches the field this dropdown drives</p>
        </Field>
        <Field label="Field label">
          <input type="text" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} className={inputClass} placeholder="Account Number" required />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Shown to admins managing this list</p>
        </Field>

        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12.5px] font-semibold transition-colors"
          >
            {isLoading ? 'Creating…' : 'Create Field'}
          </button>
          <Link href="/dashboard/menu-configuration" className="text-[12.5px] text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200 transition-colors">
            Cancel
          </Link>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function NewMenuConfigurationPage() {
  return (
    <RequireRole role="admin">
      <NewMenuConfigurationPageContent />
    </RequireRole>
  );
}
