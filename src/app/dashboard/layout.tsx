'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import DashboardGuard from '@/components/DashboardGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ErrorBoundary>
      <DashboardGuard>
        <div className="flex h-full overflow-hidden bg-white dark:bg-navy-900">

          {/* Desktop sidebar — inline in flex flow at lg+ */}
          <div className="hidden lg:block shrink-0">
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(v => !v)}
            />
          </div>

          {/* Mobile/tablet overlay sidebar — only mounts when open */}
          <AnimatePresence>
            {sidebarOpen && (
              <div className="lg:hidden fixed inset-0 z-50">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute inset-y-0 left-0"
                >
                  <Sidebar onClose={() => setSidebarOpen(false)} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Mobile-only menu trigger — sidebar is hidden below lg, so this is its only entry point */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 shadow-sm text-gray-500 dark:text-navy-400 hover:text-gray-800 dark:hover:text-navy-100 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <main id="main-scroll" className="flex-1 overflow-y-auto p-3 md:p-4 pt-14 lg:pt-4">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>

        </div>
      </DashboardGuard>
    </ErrorBoundary>
  );
}
