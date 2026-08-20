import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Sidebar({ children }) {
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  const menus = [
    {
      name: 'ODP Profiling',
      path: '/',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      name: 'Order & Fallout Trend',
      path: '/orders',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'ODP & Fulfillment Analysis',
      path: '/analysis',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] font-sans text-xs text-gray-800">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-[1001] lg:hidden backdrop-blur-xs"
        ></div>
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-[1002] bg-gradient-to-b from-[#161233] via-[#211c47] to-[#0f0c24] text-white flex flex-col transition-all duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isDesktopCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between min-h-[58px]">
          {!isDesktopCollapsed ? (
            <div className="overflow-hidden">
              <span className="font-black text-[11px] leading-tight tracking-wide uppercase bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-yellow-200 to-white block truncate">
                Fixed Broadband Dashboard
              </span>
              <span className="text-[9px] text-slate-300 font-bold tracking-wider uppercase block mt-0.5">
                Kalimantan - TELKOMSEL
              </span>
            </div>
          ) : (
            <span className="font-black text-xs text-center w-full text-red-400">TSEL</span>
          )}

          <button
            type="button"
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
            title={isDesktopCollapsed ? 'Buka Sidebar' : 'Sembunyikan Sidebar'}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${isDesktopCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {!isDesktopCollapsed && (
            <p className="text-[8px] uppercase font-black text-slate-400 px-2 py-1 tracking-wider">
              Main Menu
            </p>
          )}
          {menus.map((m) => {
            const isActive = router.pathname === m.path;
            return (
              <Link
                key={m.path}
                href={m.path}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                } ${isDesktopCollapsed ? 'justify-center px-2' : ''}`}
                title={isDesktopCollapsed ? m.name : ''}
              >
                <span>{m.icon}</span>
                {!isDesktopCollapsed && <span className="text-xs truncate">{m.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2.5 border-t border-white/10 text-[9px] text-slate-300 text-center leading-relaxed">
          {!isDesktopCollapsed ? (
            <span>&copy; 2026 | Created with ❤️ by Fauzi Ramdani - 97122</span>
          ) : (
            <span title="Created with ❤️ by Fauzi Ramdani - 97122">❤️</span>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isDesktopCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        }`}
      >
        <div className="lg:hidden bg-[#211c47] text-white p-2.5 flex items-center justify-between shadow sticky top-0 z-[1000]">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded flex items-center gap-1 text-xs font-bold"
          >
            <span>☰</span> Menu
          </button>
          <span className="font-extrabold text-[11px] uppercase tracking-wider text-purple-200 truncate">
            Fixed Broadband - TELKOMSEL
          </span>
        </div>

        <main className="flex-1 p-2 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
