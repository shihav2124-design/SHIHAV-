import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Check, Copy, ImagePlus, Send } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { submitDepositRequest } from '@/src/lib/firestoreService';
import {
  compressImageToDataUrl,
  copyText,
  formatCurrency,
  formatDateTime,
} from '@/src/lib/imageUtils';
import { DepositMethod, DepositRequest } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

export function DepositPage() {
  const { firebaseUser, profile, paymentSettings, tr, showToast } = useApp();
  const [method, setMethod] = useState<DepositMethod>('bkash');
  const [amount, setAmount] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);
  const [history, setHistory] = useState<DepositRequest[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    return onSnapshot(
      query(collection(db, 'deposits'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setHistory(list);
      },
      () => {}
    );
  }, [firebaseUser]);

  const paymentChannels: { id: DepositMethod; label: string; number: string; color: string }[] = [
    { id: 'bkash', label: 'bKash', number: paymentSettings.bkashNumber, color: 'text-pink-600' },
    { id: 'nagad', label: 'Nagad', number: paymentSettings.nagadNumber, color: 'text-orange-600' },
    { id: 'rocket', label: 'Rocket', number: paymentSettings.rocketNumber, color: 'text-purple-700' },
  ];

  const handleCopyNumber = async (id: string, num: string) => {
    await copyText(num);
    setCopiedMethod(id);
    showToast(`Copied: ${num}`, 'info');
    setTimeout(() => setCopiedMethod(null), 2000);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await compressImageToDataUrl(f);
      setProofImage(url);
    } catch (err: any) {
      showToast(err?.message || 'Could not process screenshot', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    if (!firebaseUser.emailVerified) {
      showToast(tr('verifyEmailDesc'), 'error');
      return;
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < paymentSettings.minDeposit) {
      showToast(`Minimum deposit is ${formatCurrency(paymentSettings.minDeposit)}`, 'error');
      return;
    }
    if (!proofImage) {
      showToast('Please upload your payment screenshot.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitDepositRequest({
        user: profile,
        amount: amt,
        method,
        senderNumber,
        transactionId,
        proofImageData: proofImage,
      });
      showToast('Deposit request submitted! Admin will verify shortly.', 'success');
      setAmount('');
      setSenderNumber('');
      setTransactionId('');
      setProofImage('');
    } catch (err: any) {
      showToast(err?.message || 'Deposit submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{tr('deposit')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Minimum deposit: <span className="font-mono font-semibold text-slate-800">{formatCurrency(paymentSettings.minDeposit)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Instructions & Payment Numbers + Deposit Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-navy-900 text-white rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-base font-bold">Payment Instructions</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {paymentSettings.depositInstructions}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {paymentChannels.map((ch) => (
                <div key={ch.id} className="bg-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-pink-300">{ch.label}</p>
                    <p className="font-mono text-xs sm:text-sm font-bold text-white mt-0.5 break-all">
                      {ch.number}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(ch.id, ch.number)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white"
                  >
                    {copiedMethod === ch.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMethod === ch.id ? 'Copied' : 'Copy Number'}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">Submit Deposit Proof</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-2.5">
                {paymentChannels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setMethod(ch.id)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-colors min-h-[44px] ${
                      method === ch.id
                        ? 'border-pink-600 bg-pink-50 text-pink-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Deposit Amount (৳)</label>
                <input
                  type="number"
                  required
                  min={paymentSettings.minDeposit}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min ${paymentSettings.minDeposit}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sender Number</label>
                <input
                  type="tel"
                  required
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Transaction ID (TrxID)</label>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. BKA94X21P0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Screenshot</label>
              <label className="block border-2 border-dashed border-slate-200 hover:border-pink-400 rounded-2xl p-4 text-center cursor-pointer transition-colors">
                {proofImage ? (
                  <img src={proofImage} alt="Deposit proof" className="max-h-48 mx-auto rounded-xl object-contain" />
                ) : (
                  <div className="py-4 space-y-1.5">
                    <ImagePlus className="w-7 h-7 text-pink-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">Upload transaction screenshot</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 min-h-[44px]"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : tr('submitDeposit')}</span>
            </button>
          </form>
        </div>

        {/* Right: Recent Deposit History */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 h-fit">
          <h2 className="font-display text-base font-bold text-slate-900 mb-4">Deposit Requests</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">{tr('noData')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item) => (
                <div key={item.id} className="py-3.5 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>
                    <StatusText status={item.status} />
                  </div>
                  <p className="text-xs text-slate-600 font-mono">
                    {item.method.toUpperCase()} · TrxID: {item.transactionId}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">{formatDateTime(item.createdAt)}</p>
                  {item.status === 'rejected' && item.rejectionReason && (
                    <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg mt-1">
                      Reason: {item.rejectionReason}
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
