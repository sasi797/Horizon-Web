'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useCreateUserMutation } from '@/services/usersApi';
import { useGetRolesQuery } from '@/services/rolesApi';
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

function NewUserPageContent() {
  const router = useRouter();
  const { data: roles = [] } = useGetRolesQuery();
  const [createUser, { isLoading }] = useCreateUserMutation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && email.trim() && password.length >= 8 && roleId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createUser({ name: name.trim(), email: email.trim(), password, role_id: roleId, is_active: isActive }).unwrap();
      router.push('/dashboard/users');
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to create user. Please try again.');
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4 max-w-lg">
      <motion.div variants={staggerItem} className="flex items-center gap-2.5">
        <Link href="/dashboard/users" className="text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <UserPlus size={16} strokeWidth={2} />
        </span>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">New User</h1>
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={handleSubmit} className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl p-5 space-y-4">
        <Field label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Jane Doe" required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="jane@example.com" required />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" required minLength={8} />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Minimum 8 characters</p>
        </Field>
        <Field label="Role">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputClass} required>
            <option value="" disabled>Select a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-navy-300 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300 dark:border-navy-600" />
          Active
        </label>

        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12.5px] font-semibold transition-colors"
          >
            {isLoading ? 'Creating…' : 'Create User'}
          </button>
          <Link href="/dashboard/users" className="text-[12.5px] text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200 transition-colors">
            Cancel
          </Link>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function NewUserPage() {
  return (
    <RequireRole role="admin">
      <NewUserPageContent />
    </RequireRole>
  );
}
