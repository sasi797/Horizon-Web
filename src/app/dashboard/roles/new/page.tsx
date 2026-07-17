'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldPlus } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useCreateRoleMutation } from '@/services/rolesApi';
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

function NewRolePageContent() {
  const router = useRouter();
  const [createRole, { isLoading }] = useCreateRoleMutation();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [permissions, setPermissions] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && key.trim() && permissions.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createRole({ name: name.trim(), key: key.trim(), permissions: permissions.trim() }).unwrap();
      router.push('/dashboard/roles');
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to create role. Please try again.');
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4 max-w-lg">
      <motion.div variants={staggerItem} className="flex items-center gap-2.5">
        <Link href="/dashboard/roles" className="text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <ShieldPlus size={16} strokeWidth={2} />
        </span>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">New Role</h1>
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={handleSubmit} className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl p-5 space-y-4">
        <Field label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Dispatcher" required />
        </Field>
        <Field label="Key">
          <input type="text" value={key} onChange={(e) => setKey(e.target.value)} className={inputClass} placeholder="dispatcher" required />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Lowercase, no spaces — e.g. &quot;admin&quot;</p>
        </Field>
        <Field label="Permissions">
          <textarea value={permissions} onChange={(e) => setPermissions(e.target.value)} rows={4} className={`${inputClass} h-auto py-2 resize-y`} placeholder="manifests:read, manifests:write" required />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Free-text for now — not yet parsed into individual permissions</p>
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
            {isLoading ? 'Creating…' : 'Create Role'}
          </button>
          <Link href="/dashboard/roles" className="text-[12.5px] text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200 transition-colors">
            Cancel
          </Link>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function NewRolePage() {
  return (
    <RequireRole role="admin">
      <NewRolePageContent />
    </RequireRole>
  );
}
