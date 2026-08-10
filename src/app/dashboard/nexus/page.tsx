'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Play, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetNexusOptionsQuery,
  useCreateNexusEmployeeMutation,
  type NexusPushResult,
} from '@/services/nexusApi';
import RequireRole from '@/components/RequireRole';

const BASE_INPUT =
  'w-full h-9 px-2.5 rounded-lg border bg-white dark:bg-navy-900 text-[12px] text-gray-800 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none transition-colors';
const OK_BORDER = 'border-gray-200 dark:border-navy-700 focus:border-emerald-500/60';
const BAD_BORDER = 'border-red-400 dark:border-red-500/70 focus:border-red-500';

interface Form {
  full_name: string;
  email: string;
  password: string;
  role: string;
  shift: string;
}

type TextField = 'full_name' | 'email' | 'password';

const EMPTY: Form = { full_name: '', email: '', password: '', role: '', shift: '' };

// Deliberately loose — the address only has to be plausible here, since the
// backend validates it properly with EmailStr and Nexus will reject anything
// it does not like anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Required() {
  return <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold text-gray-500 dark:text-navy-400 mb-1"
      >
        {label}
        <Required />
      </label>
      {children}
      <p className="mt-1 text-[10.5px] text-red-500 dark:text-red-400 min-h-[13px]">{error ?? ''}</p>
    </div>
  );
}

function NexusPageContent() {
  // Roles and shifts come from the backend so they cannot drift out of step
  // with the values the automation is willing to select in Nexus.
  const { data: options } = useGetNexusOptionsQuery();
  const [createEmployee, { isLoading }] = useCreateNexusEmployeeMutation();

  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState<Record<TextField, boolean>>({
    full_name: false,
    email: false,
    password: false,
  });
  const [result, setResult] = useState<NexusPushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const blur = (key: TextField) => () => setTouched((t) => ({ ...t, [key]: true }));

  const roles = options?.roles ?? [];
  const shifts = options?.shifts ?? [];
  const role = form.role || roles[0] || '';
  const shift = form.shift || shifts[0] || '';

  const problems: Record<TextField, string | undefined> = {
    full_name: form.full_name.trim() === '' ? 'Full name is required' : undefined,
    email:
      form.email.trim() === ''
        ? 'Email address is required'
        : !EMAIL_RE.test(form.email.trim())
          ? 'Enter a valid email address'
          : undefined,
    password: form.password === '' ? 'Password is required' : undefined,
  };

  const isComplete = !problems.full_name && !problems.email && !problems.password && role !== '';

  // Only nag about a field once it has been visited, so a fresh form is not
  // covered in red before anything has been typed.
  const shown = (key: TextField) => (touched[key] ? problems[key] : undefined);

  const run = async () => {
    setTouched({ full_name: true, email: true, password: true });
    if (!isComplete) return;

    setError(null);
    setResult(null);
    try {
      setResult(
        await createEmployee({
          ...form,
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          role,
          shift,
          dry_run: false,
          headless: true,
        }).unwrap()
      );
      setForm(EMPTY);
      setTouched({ full_name: false, email: false, password: false });
    } catch (err) {
      const data = (err as { data?: { detail?: unknown } })?.data;
      const detail = data?.detail;
      // FastAPI validation errors arrive as a list of field objects.
      if (Array.isArray(detail)) {
        setError(
          detail
            .map((d: { loc?: string[]; msg?: string }) => `${d.loc?.slice(-1)[0]}: ${d.msg}`)
            .join(', ')
        );
      } else {
        setError(typeof detail === 'string' ? detail : 'The run failed before it could report back.');
      }
    }
  };

  const inputClass = (key: TextField) => `${BASE_INPUT} ${shown(key) ? BAD_BORDER : OK_BORDER}`;

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start gap-2.5">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mt-0.5">
          <UserPlus size={16} strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Nexus</h1>
          <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
            Creates an employee by filling the Settings → Users form in a browser
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={staggerItem}
        className="rounded-xl border border-gray-200 dark:border-navy-700 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 dark:bg-navy-900/40 border-b border-gray-200 dark:border-navy-700">
          <h2 className="text-[12px] font-bold text-gray-700 dark:text-navy-100">New employee</h2>
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500">
            <span className="text-red-500">*</span> All fields are required
          </p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1">
          <Field id="full_name" label="Full Name" error={shown('full_name')}>
            <input
              id="full_name"
              value={form.full_name}
              onChange={(e) => set('full_name')(e.target.value)}
              onBlur={blur('full_name')}
              placeholder="Jane Doe"
              aria-required="true"
              aria-invalid={!!shown('full_name')}
              className={inputClass('full_name')}
            />
          </Field>

          <Field id="email" label="Email Address" error={shown('email')}>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set('email')(e.target.value)}
              onBlur={blur('email')}
              placeholder="jane@linkworks.in"
              aria-required="true"
              aria-invalid={!!shown('email')}
              className={inputClass('email')}
            />
          </Field>

          <Field id="password" label="Password" error={shown('password')}>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => set('password')(e.target.value)}
              onBlur={blur('password')}
              placeholder="••••••••"
              aria-required="true"
              aria-invalid={!!shown('password')}
              className={inputClass('password')}
            />
          </Field>

          <Field id="role" label="Role">
            <select
              id="role"
              value={role}
              onChange={(e) => set('role')(e.target.value)}
              aria-required="true"
              className={`${BASE_INPUT} ${OK_BORDER} cursor-pointer`}
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>

          <Field id="shift" label="Shift">
            <select
              id="shift"
              value={shift}
              onChange={(e) => set('shift')(e.target.value)}
              aria-required="true"
              className={`${BASE_INPUT} ${OK_BORDER} cursor-pointer`}
            >
              {shifts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={isLoading || !isComplete}
          title={isComplete ? undefined : 'Fill in every field to continue'}
          className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold shadow-sm shadow-emerald-600/20 cursor-pointer transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-300 dark:disabled:bg-navy-700 disabled:text-gray-500 dark:disabled:text-navy-500 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={13} strokeWidth={2.5} className="animate-spin" />
          ) : (
            <Play size={13} strokeWidth={2.5} />
          )}
          Add employee in Nexus
        </button>
        {isLoading && (
          <span className="text-[11px] text-gray-400 dark:text-navy-500">
            Browser running — this takes 20–35 seconds…
          </span>
        )}
      </motion.div>

      {error && (
        <motion.div
          variants={staggerItem}
          className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2.5"
        >
          <AlertTriangle size={14} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" strokeWidth={2.5} />
          <p className="text-[12px] text-red-700 dark:text-red-300">{error}</p>
        </motion.div>
      )}

      {result && (
        <motion.div
          variants={staggerItem}
          className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5"
        >
          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.5} />
          <div className="text-[12px] text-emerald-800 dark:text-emerald-300 space-y-0.5">
            <p className="font-semibold">Employee created in Nexus.</p>
            <p className="text-[11px] opacity-80">Screenshot: {result.screenshot}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function NexusPage() {
  return (
    <RequireRole role="admin">
      <NexusPageContent />
    </RequireRole>
  );
}
