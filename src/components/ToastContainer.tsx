import React from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '@/src/context/AppContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg bg-white text-slate-900 transition-all ${
            item.type === 'success'
              ? 'border-emerald-200'
              : item.type === 'error'
              ? 'border-rose-200'
              : 'border-slate-200'
          }`}
        >
          {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {item.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          {item.type === 'info' && <Info className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />}
          <p className="text-sm font-medium flex-1 leading-snug">{item.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label="Dismiss message"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg min-w-[28px] min-h-[28px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
