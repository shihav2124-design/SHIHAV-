import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import { TaskSubmission, TransactionRecord } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

export function HistoryPage() {
  const { firebaseUser, tr } = useApp();
  const [tab, setTab] = useState<'tasks' | 'transactions'>('tasks');
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const u1 = onSnapshot(
      query(collection(db, 'taskSubmissions'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskSubmission));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setSubmissions(list);
      },
      () => {}
    );
    const u2 = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TransactionRecord));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setTransactions(list);
      },
      () => {}
    );
    return () => {
      u1();
      u2();
    };
  }, [firebaseUser]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{tr('history')}</h1>
          <p className="text-sm text-slate-500 mt-1">Complete record of submitted tasks and wallet transactions.</p>
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'tasks' ? 'bg-navy-900 text-white' : 'text-slate-600'
            }`}
          >
            Task History ({submissions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('transactions')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${
              tab === 'transactions' ? 'bg-navy-900 text-white' : 'text-slate-600'
            }`}
          >
            Transactions ({transactions.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {tab === 'tasks' ? (
          submissions.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">{tr('noData')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.map((sub) => (
                <div key={sub.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{sub.taskTitle}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {sub.groupName ? `${sub.groupName} · ` : ''}{sub.tiktokUsername} · {formatDateTime(sub.createdAt)}
                    </p>
                    {sub.rejectionReason && (
                      <p className="text-xs text-rose-700">Reason: {sub.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-pink-600 tabular-nums">
                      {formatCurrency(sub.commission)}
                    </span>
                    <StatusText status={sub.status} />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : transactions.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{tr('noData')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{tx.description}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    {tx.txCode} · {tx.type.replace(/_/g, ' ')} · {formatDateTime(tx.createdAt)}
                  </p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      tx.amount >= 0 ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                  </span>
                  <StatusText status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
