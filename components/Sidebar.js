import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Sidebar({ children }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const menus = [
    {
      name: 'ODP Profiling',
      path: '/',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      name: 'Order & Fallout Trend',
      path: '/orders',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#f1f5f9] font-sans text-xs text-gray-800">
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-[1001] lg:hidden backdrop-blur-xs"
        ></div>
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-[1002] w-60 bg-gradient-to-b from-[#161233] via-[#211c47] to-[#0f0c24] text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="font-black text-sm tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-300 block">
              TELKOM FBB
            </span>
            <span className="text-[9px] text-slate-400 font-semibold tracking-wide block">
              KALIMANTAN DASHBOARD
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="text-[8.5px] uppercase font-extrabold text-slate-400 px-2 py-1 tracking-wider">
            Main Menu
          </p>
          {menus.map((m) => {
            const isActive = router.pathname === m.path;
            return (
              <Link
                key={m.path}
                href={m.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{m.icon}</span>
                <span className="text-xs">{m.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-white/10 text-[9.5px] text-slate-400 text-center">
          Branch Palangkaraya &copy; 2026
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-60 min-w-0">
        {/* Mobile Header Bar */}
        <div className="lg:hidden bg-[#211c47] text-white p-3 flex items-center justify-between shadow sticky top-0 z-[1000]">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded flex items-center gap-1 text-xs font-bold"
          >
            <span>☰</span> Menu
          </button>
          <span className="font-extrabold text-xs uppercase tracking-wider text-purple-200">
            FBB Dashboard
          </span>
        </div>

        <main className="flex-1 p-2 sm:p-4">{children}</main>
      </div>
    </div>
  );
}
