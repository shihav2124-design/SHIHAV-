import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export function StatusText({ status }: { status: string }) {
  const s = (status || '').toLowerCase();

  if (['approved', 'paid', 'completed', 'active'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 capitalize whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{status.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  if (['rejected', 'blocked', 'expired', 'failed', 'cancelled', 'inactive'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 capitalize whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{status.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  if (['processing', 'under_review', 'verified', 'submitted', 'paused'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 capitalize whitespace-nowrap">
        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
        <span>{status.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  if (['pending', 'pending_review', 'refunded', 'claimed'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 capitalize whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{s === 'claimed' ? 'In Progress' : status.replace(/_/g, ' ')}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 capitalize whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
}
