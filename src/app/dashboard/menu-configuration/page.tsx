'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ListTree, Plus, Trash2, ArrowUp, ArrowDown, Package, UserRound, Layers } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetDropdownFieldsQuery,
  useDeleteDropdownFieldMutation,
  useCreateDropdownValueMutation,
  useUpdateDropdownValueMutation,
  useDeleteDropdownValueMutation,
  type DropdownField,
  type DropdownValue,
} from '@/services/dropdownApi';
import ApiErrorState from '@/components/ApiErrorState';
import RequireRole from '@/components/RequireRole';

const BASE_MODULES = [
  { key: 'manifest', label: 'Manifest', icon: Package },
  { key: 'user', label: 'User', icon: UserRound },
];

const inputClass = 'w-full h-8 px-2.5 bg-transparent border border-gray-200 dark:border-navy-700 rounded-lg text-[12.5px] text-gray-800 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors';

function MenuConfigurationPageContent() {
  const { data: fields = [], isLoading, isError, refetch } = useGetDropdownFieldsQuery();
  const [deleteField] = useDeleteDropdownFieldMutation();
  const [createValue, { isLoading: isAdding }] = useCreateDropdownValueMutation();
  const [updateValue] = useUpdateDropdownValueMutation();
  const [deleteValue] = useDeleteDropdownValueMutation();

  const [activeModule, setActiveModule] = useState(BASE_MODULES[0].key);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const extraModules = [...new Set(fields.map(f => f.module))]
    .filter(m => !BASE_MODULES.some(bm => bm.key === m))
    .map(m => ({ key: m, label: m.charAt(0).toUpperCase() + m.slice(1), icon: Layers }));
  const modules = [...BASE_MODULES, ...extraModules];

  const fieldsInModule = fields.filter(f => f.module === activeModule);
  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;

  useEffect(() => {
    if (!selectedField || selectedField.module !== activeModule) {
      setSelectedFieldId(fieldsInModule[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, fields]);

  const sortedValues = selectedField ? [...selectedField.values].sort((a, b) => a.order_index - b.order_index) : [];

  const handleDeleteField = async (f: DropdownField) => {
    if (!window.confirm(`Delete the "${f.field_label}" dropdown field and all of its values? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteField(f.id).unwrap();
      if (selectedFieldId === f.id) setSelectedFieldId(null);
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to delete field.');
    }
  };

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField || !newValue.trim() || !newLabel.trim()) return;
    setError(null);
    try {
      await createValue({
        fieldId: selectedField.id,
        body: { value: newValue.trim(), label: newLabel.trim(), order_index: sortedValues.length },
      }).unwrap();
      setNewValue('');
      setNewLabel('');
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to add value.');
    }
  };

  const handleDeleteValue = async (v: DropdownValue) => {
    if (!window.confirm(`Remove "${v.label}"?`)) return;
    setError(null);
    try {
      await deleteValue(v.id).unwrap();
    } catch {
      setError('Failed to delete value.');
    }
  };

  const handleToggleActive = async (v: DropdownValue) => {
    try {
      await updateValue({ id: v.id, body: { is_active: !v.is_active } }).unwrap();
    } catch {
      setError('Failed to update value.');
    }
  };

  const moveValue = async (index: number, direction: -1 | 1) => {
    const target = sortedValues[index + direction];
    const current = sortedValues[index];
    if (!target) return;
    try {
      await Promise.all([
        updateValue({ id: current.id, body: { order_index: target.order_index } }).unwrap(),
        updateValue({ id: target.id, body: { order_index: current.order_index } }).unwrap(),
      ]);
    } catch {
      setError('Failed to reorder values.');
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mt-0.5">
            <ListTree size={16} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Configuration</h1>
            <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">Manage dropdown values used across the app</p>
          </div>
        </div>
        <Link
          href={`/dashboard/menu-configuration/new?module=${activeModule}`}
          className="group inline-flex items-center gap-2 h-8 pl-2 pr-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[12px] font-semibold shadow-sm shadow-emerald-600/20 transition-colors no-underline shrink-0"
        >
          <span className="flex items-center justify-center w-4 h-4 rounded bg-white/15">
            <Plus size={11} strokeWidth={2.5} />
          </span>
          New Field
        </Link>
      </motion.div>

      {error && (
        <p className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
      )}

      <motion.div variants={staggerItem} className="flex items-center gap-1 border-b border-gray-200 dark:border-navy-700">
        {modules.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveModule(key)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
              activeModule === key
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200'
            }`}
          >
            <Icon size={13} strokeWidth={2} />
            {label}
            {activeModule === key && (
              <motion.span layoutId="menu-config-tab" className="absolute left-0 right-0 -bottom-px h-[2px] bg-emerald-500 rounded-full" />
            )}
          </button>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
          <div className="h-64 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 animate-pulse" />
          <div className="h-64 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 animate-pulse" />
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load dropdown fields" onRetry={refetch} />
      ) : (
        <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 items-start">
          {/* Left: field names for the active module */}
          <div className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-navy-800">
              <h2 className="text-[12px] font-bold text-gray-700 dark:text-navy-200">Fields</h2>
              <p className="text-[10.5px] text-gray-400 dark:text-navy-500">{fieldsInModule.length} field{fieldsInModule.length === 1 ? '' : 's'} in this module</p>
            </div>
            <AnimatePresence mode="wait">
              {fieldsInModule.length === 0 ? (
                <motion.div
                  key={`empty-${activeModule}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-center justify-center gap-2 h-40 px-4 text-center"
                >
                  <ListTree size={20} strokeWidth={1.6} className="text-gray-300 dark:text-navy-600" />
                  <p className="text-[12.5px] text-gray-400 dark:text-navy-500">No fields for this module yet</p>
                  <Link
                    href={`/dashboard/menu-configuration/new?module=${activeModule}`}
                    className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors no-underline"
                  >
                    Add one via New Field →
                  </Link>
                </motion.div>
              ) : (
                <motion.div
                  key={`list-${activeModule}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="divide-y divide-gray-50 dark:divide-navy-800/70"
                >
                  {fieldsInModule.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFieldId(f.id)}
                      className={`group relative flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
                        selectedFieldId !== f.id ? 'hover:bg-gray-50/60 dark:hover:bg-navy-800/30' : ''
                      }`}
                    >
                      {selectedFieldId === f.id && (
                        <motion.div
                          layoutId="field-active-bg"
                          className="absolute inset-0 bg-emerald-50/70 dark:bg-emerald-950/20"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <div className="relative z-10 flex-1 min-w-0">
                        <p className={`text-[12.5px] font-semibold truncate transition-colors ${selectedFieldId === f.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}>
                          {f.field_label}
                        </p>
                        <p className="text-[10.5px] font-mono text-gray-400 dark:text-navy-500 truncate">{f.field_name} · {f.values.length} value{f.values.length === 1 ? '' : 's'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteField(f); }}
                        className="relative z-10 shrink-0 opacity-0 group-hover:opacity-100 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-opacity"
                        aria-label={`Delete ${f.field_label}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: values for the selected field */}
          <div className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl overflow-hidden">
            <AnimatePresence mode="wait">
              {!selectedField ? (
                <motion.div
                  key={`empty-values-${activeModule}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="flex flex-col items-center justify-center gap-2 h-40 px-4 text-center"
                >
                  <ListTree size={20} strokeWidth={1.6} className="text-gray-300 dark:text-navy-600" />
                  <p className="text-[12.5px] text-gray-400 dark:text-navy-500">
                    {fieldsInModule.length === 0 ? 'No fields for this module yet' : 'Select a field to manage its values'}
                  </p>
                  {fieldsInModule.length === 0 && (
                    <Link
                      href={`/dashboard/menu-configuration/new?module=${activeModule}`}
                      className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors no-underline"
                    >
                      Add one via New Field →
                    </Link>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key={selectedField.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-navy-800">
                    <h2 className="text-[12px] font-bold text-gray-700 dark:text-navy-200">{selectedField.field_label}</h2>
                    <p className="text-[10.5px] text-gray-400 dark:text-navy-500 font-mono">{selectedField.module} · {selectedField.field_name}</p>
                  </div>

                  {sortedValues.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-gray-300 dark:text-navy-600 text-[12.5px]">No values yet</div>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-navy-800/70">
                      {sortedValues.map((v, i) => (
                        <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="flex flex-col shrink-0">
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={() => moveValue(i, -1)}
                              className="text-gray-300 dark:text-navy-600 hover:text-gray-600 dark:hover:text-navy-300 disabled:opacity-20 disabled:hover:text-gray-300 transition-colors"
                              aria-label="Move up"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={i === sortedValues.length - 1}
                              onClick={() => moveValue(i, 1)}
                              className="text-gray-300 dark:text-navy-600 hover:text-gray-600 dark:hover:text-navy-300 disabled:opacity-20 disabled:hover:text-gray-300 transition-colors"
                              aria-label="Move down"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
                            <span className="font-mono text-[11.5px] text-gray-500 dark:text-navy-400 truncate">{v.value}</span>
                            <span className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-100 truncate">{v.label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(v)}
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                              v.is_active
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-gray-100 dark:bg-navy-800 text-gray-400 dark:text-navy-500'
                            }`}
                          >
                            {v.is_active ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteValue(v)}
                            className="shrink-0 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                            aria-label={`Delete ${v.label}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddValue} className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-navy-800">
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Value (e.g. Sameday)"
                      className={inputClass}
                    />
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Label (e.g. Sameday)"
                      className={inputClass}
                    />
                    <button
                      type="submit"
                      disabled={!newValue.trim() || !newLabel.trim() || isAdding}
                      className="shrink-0 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors inline-flex items-center gap-1"
                    >
                      <Plus size={12} strokeWidth={2.5} /> Add
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function MenuConfigurationPage() {
  return (
    <RequireRole role="admin">
      <MenuConfigurationPageContent />
    </RequireRole>
  );
}
