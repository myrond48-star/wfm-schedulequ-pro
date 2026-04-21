import React from 'react';

export const Logo: React.FC<{ className?: string, centered?: boolean }> = ({ className, centered }) => {
  return (
    <div className={`flex flex-col ${centered ? 'items-center text-center' : 'items-start text-left'} ${className}`}>
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center shrink-0">
          <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14h.01" />
              <path d="M12 14h.01" />
              <path d="M16 14h.01" />
              <path d="M8 18h.01" />
              <path d="M12 18h.01" />
              <path d="M16 18h.01" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
        </div>
        <span className="font-black text-slate-800 text-4xl tracking-tighter">Schedule<span className="text-indigo-600">Qu</span></span>
      </div>
      <span className="text-[10px] text-slate-400 font-bold tracking-[2px] uppercase mt-1.5 ml-0.5">Workforce Management System</span>
    </div>
  );
};
