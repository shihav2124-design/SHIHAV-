import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { submitWithdrawalRequest } from '@/src/lib/firestoreService';
import { formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import { WithdrawalMethod, WithdrawalRequest } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

export function WithdrawPage() {
  const { firebaseUser, profile, wallet, paymentSettings, tr, showToast } = useApp();
  const [method, setMethod] = useState<WithdrawalMethod>('bkash_personal');
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<WithdrawalRequest[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    return onSnapshot(
      query(collection(db, 'withdrawals'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setHistory(list);
      },
      () => {}
    );
  }, [firebaseUser]);

  const parsedAmount = Number(amount) || 0;
  const charge = Number(((parsedAmount * paymentSettings.withdrawalChargePercent) / 100).toFixed(2));
  const netPayable = Math.max(0, Number((parsedAmount - charge).toFixed(2)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile || !wallet) return;
    if (!firebaseUser.emailVerified) {
      showToast(tr('verifyEmailDesc'), 'error');
      return;
    }
    if (parsedAmount < paymentSettings.minWithdrawal) {
      showToast(`Minimum withdrawal is ${formatCurrency(paymentSettings.minWithdrawal)}`, 'error');
      return;
    }
    if (parsedAmount > paymentSettings.maxWithdrawal) {
      showToast(`Maximum withdrawal is ${formatCurrency(paymentSettings.maxWithdrawal)}`, 'error');
      return;
    }
    if (parsedAmount > wallet.availableBalance) {
      showToast('Insufficient available balance.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitWithdrawalRequest({
        user: profile,
        wallet,
        amount: parsedAmount,
        charge,
        method,
        accountNumber,
      });
      showToast('Withdrawal requested! Funds reserved securely until processed.', 'success');
      setAmount('');
      setAccountNumber('');
    } catch (err: any) {
      showToast(err?.message || 'Withdrawal request failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{tr('withdraw')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Requested funds are securely reserved in pending balance and refunded automatically if rejected.
        </p>
      </div>

      {/* Rules Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-navy-900 text-white rounded-2xl p-4">
          <p className="text-xs text-slate-300">{tr('availableBalance')}</p>
          <p className="font-mono text-lg font-bold tabular-nums mt-1">
            {formatCurrency(wallet?.availableBalance)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{tr('minWithdrawal')}</p>
          <p className="font-mono text-base font-bold text-slate-900 tabular-nums mt-1">
            {formatCurrency(paymentSettings.minWithdrawal)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{tr('maxWithdrawal')}</p>
          <p className="font-mono text-base font-bold text-slate-900 tabular-nums mt-1">
            {formatCurrency(paymentSettings.maxWithdrawal)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">{tr('withdrawalCharge')}</p>
          <p className="font-mono text-base font-bold text-pink-600 tabular-nums mt-1">
            {paymentSettings.withdrawalChargePercent}%
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500">{tr('processingTime')}</p>
          <p className="text-xs font-semibold text-slate-900 mt-1.5">{paymentSettings.processingTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-base font-bold text-slate-900">Withdrawal Request Form</h2>
          <p className="text-xs text-slate-500">{paymentSettings.withdrawalInstructions}</p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'bkash_personal', label: 'bKash Personal' },
                { id: 'nagad_personal', label: 'Nagad Personal' },
                { id: 'rocket_personal', label: 'Rocket Personal' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id as WithdrawalMethod)}
                  className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${
                    method === m.id
                      ? 'border-pink-600 bg-pink-50 text-pink-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Withdrawal Amount (৳)</label>
              <input
                type="number"
                required
                min={paymentSettings.minWithdrawal}
                max={paymentSettings.maxWithdrawal}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${paymentSettings.minWithdrawal}`}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Personal Account Number</label>
              <input
                type="tel"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs sm:text-sm">
            <div>
              <p className="text-slate-500">Fee ({paymentSettings.withdrawalChargePercent}%)</p>
              <p className="font-mono font-semibold text-slate-800 tabular-nums">{formatCurrency(charge)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">{tr('netPayable')}</p>
              <p className="font-mono text-base font-bold text-pink-600 tabular-nums">
                {formatCurrency(netPayable)}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 min-h-[44px]"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{submitting ? 'Processing...' : tr('submitWithdrawal')}</span>
          </button>

          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Protected by atomic balance reservation. Never share PIN or OTP.</span>
          </p>
        </form>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 h-fit">
          <h2 className="font-display text-base font-bold text-slate-900 mb-4">Withdrawal History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">{tr('noData')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div key={item.id} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(item.amount)} <span className="text-xs font-normal text-slate-500">(Net {formatCurrency(item.netAmount)})</span>
                    </span>
                    <StatusText status={item.status} />
                  </div>
                  <p className="text-xs text-slate-600 font-mono">
                    {item.method.replace('_', ' ').toUpperCase()} · {item.accountNumber}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">{formatDateTime(item.createdAt)}</p>
                  {item.adminNote && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-1">
                      Note: {item.adminNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
