import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import { DepositRequest, TransactionRecord, WithdrawalRequest } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

export function WalletPage() {
  const { firebaseUser, wallet, tr } = useApp();
  const [tab, setTab] = useState<'all' | 'deposits' | 'withdrawals' | 'commissions'>('all');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;

    const u1 = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TransactionRecord));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setTransactions(list);
      },
      () => {}
    );

    const u2 = onSnapshot(
      query(collection(db, 'deposits'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setDeposits(list);
      },
      () => {}
    );

    const u3 = onSnapshot(
      query(collection(db, 'withdrawals'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setWithdrawals(list);
      },
      () => {}
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [firebaseUser]);

  const commissionTxs = transactions.filter((t) => t.type === 'task_commission');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{tr('wallet')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Verified wallet balances and immutable transaction ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/deposit.html"
            className="px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{tr('deposit')}</span>
          </Link>
          <Link
            to="/withdraw.html"
            className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{tr('withdraw')}</span>
          </Link>
        </div>
      </div>

      {/* Wallet Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: tr('availableBalance'), val: wallet?.availableBalance, accent: 'text-pink-600' },
          { label: tr('pendingEarnings'), val: wallet?.pendingBalance, accent: 'text-amber-700' },
          { label: tr('totalEarnings'), val: wallet?.totalEarned, accent: 'text-emerald-700' },
          { label: tr('totalWithdrawals'), val: wallet?.totalWithdrawn, accent: 'text-slate-900' },
          { label: tr('totalDeposits'), val: wallet?.totalDeposited, accent: 'text-slate-900' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className={`font-mono text-xl sm:text-2xl font-bold tabular-nums mt-1.5 ${item.accent}`}>
              {formatCurrency(item.val)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabbed Ledgers */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {[
              { id: 'all', label: 'All Transactions' },
              { id: 'deposits', label: 'Deposit History' },
              { id: 'withdrawals', label: 'Withdrawal History' },
              { id: 'commissions', label: 'Task Commissions' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === item.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {tab === 'all' || tab === 'commissions' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {(tab === 'all' ? transactions : commissionTxs).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      {tr('noData')}
                    </td>
                  </tr>
                ) : (
                  (tab === 'all' ? transactions : commissionTxs).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {tx.txCode}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700 capitalize whitespace-nowrap">
                        {tx.type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 text-xs sm:text-sm text-slate-800 max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={tx.status} />
                      </td>
                      <td
                        className={`py-3 px-4 font-mono text-sm font-bold text-right tabular-nums whitespace-nowrap ${
                          tx.amount >= 0 ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : tab === 'deposits' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">TrxID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      {tr('noData')}
                    </td>
                  </tr>
                ) : (
                  deposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold uppercase text-xs">{dep.method}</td>
                      <td className="py-3 px-4 font-mono text-xs">{dep.senderNumber}</td>
                      <td className="py-3 px-4 font-mono text-xs">{dep.transactionId}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{formatDateTime(dep.createdAt)}</td>
                      <td className="py-3 px-4">
                        <StatusText status={dep.status} />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-right tabular-nums text-emerald-700">
                        +{formatCurrency(dep.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Charge</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      {tr('noData')}
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((wd) => (
                    <tr key={wd.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-xs font-semibold uppercase">{wd.method.replace('_', ' ')}</td>
                      <td className="py-3 px-4 font-mono text-xs">{wd.accountNumber}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        {formatCurrency(wd.charge)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{formatDateTime(wd.createdAt)}</td>
                      <td className="py-3 px-4">
                        <StatusText status={wd.status} />
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-right tabular-nums">
                        {formatCurrency(wd.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
