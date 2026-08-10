'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  Ellipsis,
  PackageCheck,
  Users,
  ShieldCheck,
  ListTree,
  UserPlus,
  LayoutDashboard,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react';
import Logo from './Logo';
import Tooltip from './Tooltip';
import { staggerContainer, staggerItem, slideLeft } from '@/lib/animations';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/services/authApi';
import { useTheme } from '@/providers/ThemeProvider';

const adminItems = [
  { icon: Users, label: 'Users', color: 'bg-blue-500 text-white', href: '/dashboard/users' },
  { icon: ShieldCheck, label: 'Roles', color: 'bg-purple-500 text-white', href: '/dashboard/roles' },
  { icon: ListTree, label: 'Configuration', color: 'bg-amber-500 text-white', href: '/dashboard/menu-configuration' },
  { icon: UserPlus, label: 'Nexus', color: 'bg-indigo-500 text-white', href: '/dashboard/nexus' },
];

const systemItems = [
  { icon: LayoutDashboard, label: 'Overview' },
];

export default function Sidebar({
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const dispatch  = useAppDispatch();
  const user      = useAppSelector(state => state.auth.user);
  const [logoutApi] = useLogoutMutation();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');

  const handleLogout = async () => {
    try { await logoutApi().unwrap(); } catch { /* ignore */ }
    dispatch(logout());
    router.push('/login');
  };

  const isActive = (href: string) => pathname.startsWith(href);

  const q = query.trim().toLowerCase();
  const showManifests = !q || 'manifests'.includes(q);
  const visibleAdminItems = user?.role === 'admin' ? adminItems : [];
  const filteredAdmin = visibleAdminItems.filter(({ label }) => !q || label.toLowerCase().includes(q));
  const filteredSystem = systemItems.filter(({ label }) => !q || label.toLowerCase().includes(q));
  const hasResults = showManifests || filteredAdmin.length > 0 || filteredSystem.length > 0;

  return (
    <motion.aside
      variants={slideLeft}
      initial="hidden"
      animate="visible"
      className={`${collapsed ? 'w-16' : 'w-56'} h-full min-h-screen bg-neutral-100 dark:bg-navy-900 border-r border-gray-100 dark:border-navy-800 flex flex-col transition-[width] duration-300 overflow-hidden`}
    >
      {/* Logo + collapse toggle */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className={`h-16 flex items-center justify-between border-b border-gray-100 dark:border-white/5 z-10 relative shrink-0 ${collapsed ? 'px-[6px]' : 'px-4'} transition-[padding] duration-300`}
      >
        <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'w-full justify-center' : ''}`}>
          {collapsed ? (
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="flex-shrink-0 flex items-center justify-center transition-all duration-300"
            >
              <Logo size={28} />
            </motion.div>
          ) : (
            <motion.div
              key="horizon-lockup"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-shrink-0 rounded-lg dark:bg-white dark:px-2 dark:py-1 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/HorizonLogo.png" alt="Horizon Express" className="h-12 w-auto block" />
            </motion.div>
          )}
        </div>

        {!collapsed && onToggleCollapse && (
          <Tooltip content="Collapse sidebar" side="bottom">
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-gray-300 dark:text-navy-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-navy-200 transition-colors shrink-0"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={17} strokeWidth={1.6} />
            </button>
          </Tooltip>
        )}
      </motion.div>

      {collapsed && onToggleCollapse && (
        <div className="hidden lg:flex justify-center py-1.5 border-b border-gray-100 dark:border-white/5 shrink-0">
          <Tooltip content="Expand sidebar" side="right">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-gray-300 dark:text-navy-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-navy-200 transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={17} strokeWidth={1.6} />
            </button>
          </Tooltip>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Search */}
        <div className={`pt-3 pb-1 ${collapsed ? 'px-1.5' : 'px-3'} transition-[padding] duration-300`}>
          {collapsed ? (
            <Tooltip content="Search" side="right">
              <button
                type="button"
                aria-label="Search"
                onClick={() => onToggleCollapse?.()}
                className="w-7 h-7 mx-auto flex items-center justify-center rounded-md text-gray-500 dark:text-navy-400 hover:bg-gray-200/70 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                <Search size={16} strokeWidth={1.6} />
              </button>
            </Tooltip>
          ) : (
            <div className="relative">
              <Search size={14} strokeWidth={1.8} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-navy-500 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search menu..."
                aria-label="Search menu"
                className="w-full h-8 pl-8 pr-2 bg-transparent border-0 border-b border-gray-200 dark:border-navy-700 text-[13px] text-gray-700 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>
          )}
        </div>

        {!collapsed && (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="px-3">

            {!hasResults && (
              <p className="px-1 pt-4 pb-2 text-[12px] text-gray-400 dark:text-navy-500 text-center">No matches found</p>
            )}

            {/* Operations */}
            {showManifests && (
              <>
                <div className="flex items-center justify-between px-1 pt-3 pb-1">
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-navy-500 uppercase tracking-wide">Operations</p>
                  <Ellipsis size={14} className="text-gray-300 dark:text-navy-500" />
                </div>
                <div className="space-y-0.5 pb-2">
                  <Link href="/dashboard/manifests" onClick={onClose} className="no-underline">
                    <motion.div
                      variants={staggerItem}
                      className={`relative flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-md transition-colors cursor-pointer ${
                        isActive('/dashboard/manifests')
                          ? 'bg-gray-200/70 dark:bg-white/10'
                          : 'hover:bg-gray-200/70 dark:hover:bg-white/5'
                      }`}
                    >
                      {isActive('/dashboard/manifests') && (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-emerald-500" />
                      )}
                      <span className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center bg-emerald-500 text-white">
                        <PackageCheck size={13} strokeWidth={2} />
                      </span>
                      <span className="flex-1 min-w-0 text-[13px] text-gray-700 dark:text-navy-200 truncate">Manifests</span>
                    </motion.div>
                  </Link>
                </div>
              </>
            )}

            {/* Administration */}
            {filteredAdmin.length > 0 && (
              <>
                <p className="px-1 pt-2 pb-1 text-[11px] font-semibold text-gray-400 dark:text-navy-500 uppercase tracking-wide">Administration</p>
                <div className="space-y-0.5 pb-2">
                  {filteredAdmin.map(({ icon: Icon, label, color, href }) => (
                    <Link key={label} href={href} onClick={onClose} className="no-underline">
                      <motion.div
                        variants={staggerItem}
                        className={`relative flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-md transition-colors cursor-pointer ${
                          isActive(href)
                            ? 'bg-gray-200/70 dark:bg-white/10'
                            : 'hover:bg-gray-200/70 dark:hover:bg-white/5'
                        }`}
                      >
                        {isActive(href) && (
                          <span className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-full ${color.split(' ')[0]}`} />
                        )}
                        <span className={`flex-shrink-0 w-[22px] h-[22px] rounded-md flex items-center justify-center ${color}`}>
                          <Icon size={13} strokeWidth={2} />
                        </span>
                        <span className="flex-1 min-w-0 text-[13px] text-gray-700 dark:text-navy-200 truncate">{label}</span>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {/* System */}
            {filteredSystem.length > 0 && (
              <>
                <p className="px-1 pt-2 pb-1 text-[11px] font-semibold text-gray-400 dark:text-navy-500 uppercase tracking-wide">System</p>
                <div className="space-y-0.5 pb-3">
                  {filteredSystem.map(({ icon: Icon, label }) => (
                    <motion.div
                      key={label}
                      variants={staggerItem}
                      className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-gray-200/70 dark:hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <span className="flex-shrink-0 w-[22px] h-[22px] flex items-center justify-center text-gray-400 dark:text-navy-500">
                        <Icon size={15} strokeWidth={1.6} />
                      </span>
                      <span className="flex-1 min-w-0 text-[13px] text-gray-700 dark:text-navy-200 truncate">{label}</span>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Theme toggle */}
      <div className={`${collapsed ? 'px-1.5' : 'px-3'} pb-1 shrink-0 transition-[padding] duration-300`}>
        <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} side={collapsed ? 'right' : 'top'} className="flex w-full">
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-2 py-1.5 rounded-lg text-gray-400 dark:text-navy-400 hover:bg-gray-200/70 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-navy-200 transition-colors`}
          >
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.6} /> : <Moon size={16} strokeWidth={1.6} />}
            {!collapsed && <span className="text-[12px] font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
        </Tooltip>
      </div>

      {/* User + Logout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className={`${collapsed ? 'px-1.5' : 'px-2.5'} pb-4 pt-2 border-t border-gray-100 dark:border-white/5 relative z-10 shrink-0 transition-[padding] duration-300`}
      >
        <Tooltip content={collapsed ? 'Logout' : undefined} side="right" className="flex w-full">
          <motion.button
            onClick={() => { handleLogout(); onClose?.(); }}
            whileTap={{ scale: 0.98 }}
            className={`group w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer hover:bg-gray-200/70 dark:hover:bg-white/5`}
          >
            <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-800 dark:bg-white/90 flex items-center justify-center text-white dark:text-navy-900 text-[11px] font-bold">
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-800 dark:text-white truncate">{user?.name ?? '—'}</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-navy-400 truncate capitalize">{user?.role ?? ''}</p>
                </div>
                <LogOut size={16} strokeWidth={1.6} className="flex-shrink-0 text-gray-300 dark:text-navy-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
              </>
            )}
          </motion.button>
        </Tooltip>
      </motion.div>
    </motion.aside>
  );
}
