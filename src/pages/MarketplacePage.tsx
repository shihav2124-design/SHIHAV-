import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  CheckCircle2,
  ImagePlus,
  Mail,
  PlaySquare,
  ShieldAlert,
  ShoppingBag,
  X,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { createMarketplaceListing, createMarketplaceOrder } from '@/src/lib/firestoreService';
import { compressImageToDataUrl, formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import { MarketplaceCategory, MarketplaceListing, MarketplaceOrder } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

export function MarketplacePage({ category }: { category: MarketplaceCategory }) {
  const { firebaseUser, profile, marketplaceSettings, tr, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'sell' ? 'sell' : searchParams.get('tab') === 'orders' ? 'orders' : 'buy';
  const [tab, setTab] = useState<'buy' | 'sell' | 'orders'>(initialTab);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [myOrders, setMyOrders] = useState<MarketplaceOrder[]>([]);

  // Buy modal
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [contactMethod, setContactMethod] = useState('');
  const [buyerNote, setBuyerNote] = useState('');
  const [ordering, setOrdering] = useState(false);

  // Sell form
  const [accountHandle, setAccountHandle] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [followersCount, setFollowersCount] = useState('');
  const [accountAgeOrRegion, setAccountAgeOrRegion] = useState('');
  const [details, setDetails] = useState('');
  const [price, setPrice] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [selling, setSelling] = useState(false);

  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (qTab === 'sell' || qTab === 'buy' || qTab === 'orders') setTab(qTab);
  }, [searchParams]);

  useEffect(() => {
    if (!firebaseUser) return;

    const u1 = onSnapshot(
      query(collection(db, 'marketplaceListings'), where('status', '==', 'approved')),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MarketplaceListing))
          .filter((item) => item.category === category);
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setListings(list);
      },
      () => {}
    );

    const u2 = onSnapshot(
      query(collection(db, 'marketplaceListings'), where('sellerId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MarketplaceListing))
          .filter((item) => item.category === category);
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setMyListings(list);
      },
      () => {}
    );

    const u3 = onSnapshot(
      query(collection(db, 'marketplaceOrders'), where('buyerId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MarketplaceOrder))
          .filter((item) => item.category === category);
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setMyOrders(list);
      },
      () => {}
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [firebaseUser, category]);

  const buyEnabled = category === 'tiktok' ? marketplaceSettings.tiktokBuyEnabled : marketplaceSettings.gmailBuyEnabled;
  const sellEnabled = category === 'tiktok' ? marketplaceSettings.tiktokSellEnabled : marketplaceSettings.gmailSellEnabled;

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await compressImageToDataUrl(f);
      setProofImage(url);
    } catch (err: any) {
      showToast(err?.message || 'Could not process image', 'error');
    }
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    if (!firebaseUser.emailVerified) {
      showToast(tr('verifyEmailDesc'), 'error');
      return;
    }

    // Security guard against password/recovery code disclosure in public forms
    const lowerCombined = `${details} ${accountHandle} ${accountAgeOrRegion}`.toLowerCase();
    if (/password|pass:|recovery code|backup code|secret key|2fa code/.test(lowerCombined)) {
      showToast(
        'Security rule: Never enter passwords, 2FA backup codes, or recovery codes in listing forms.',
        'error'
      );
      return;
    }

    setSelling(true);
    try {
      await createMarketplaceListing({
        category,
        listingType: 'sell_offer',
        sellerId: profile.uid,
        sellerName: profile.fullName,
        accountHandle,
        profileUrl,
        followersCount: category === 'tiktok' ? Number(followersCount || 0) : 0,
        accountAgeOrRegion,
        details,
        price: Number(price),
        proofImageData: proofImage,
      });
      showToast('Submitted for admin ownership review!', 'success');
      setAccountHandle('');
      setProfileUrl('');
      setFollowersCount('');
      setAccountAgeOrRegion('');
      setDetails('');
      setPrice('');
      setProofImage('');
    } catch (err: any) {
      showToast(err?.message || 'Submission failed.', 'error');
    } finally {
      setSelling(false);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !profile || !firebaseUser) return;
    if (!firebaseUser.emailVerified) {
      showToast(tr('verifyEmailDesc'), 'error');
      return;
    }
    setOrdering(true);
    try {
      await createMarketplaceOrder({
        listing: selectedListing,
        buyer: profile,
        contactMethod,
        buyerNote,
      });
      showToast('Purchase request submitted! Admin Escrow will contact you shortly.', 'success');
      setSelectedListing(null);
      setContactMethod('');
      setBuyerNote('');
      setTab('orders');
    } catch (err: any) {
      showToast(err?.message || 'Purchase request failed.', 'error');
    } finally {
      setOrdering(false);
    }
  };

  const switchTab = (next: 'buy' | 'sell' | 'orders') => {
    setTab(next);
    setSearchParams({ tab: next });
  };

  return (
    <div className="space-y-6">
      {/* Editorial Marketplace Header */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-pink-600">
              {category === 'tiktok' ? <PlaySquare className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              <span>{category === 'tiktok' ? 'TikTok Account Exchange' : 'Verified Gmail Exchange'}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              {category === 'tiktok' ? 'TikTok ID Buy & Sell' : 'Gmail ID Buy & Sell'}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              {marketplaceSettings.escrowNotice}
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => switchTab('buy')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'buy' ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {category === 'tiktok' ? tr('tiktokBuy') : tr('gmailBuy')}
            </button>
            <button
              type="button"
              onClick={() => switchTab('sell')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'sell' ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {category === 'tiktok' ? tr('tiktokSell') : tr('gmailSell')}
            </button>
            <button
              type="button"
              onClick={() => switchTab('orders')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'orders' ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Requests ({myOrders.length + myListings.length})
            </button>
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-4 relative min-h-[200px]">
          <img
            src="/src/assets/images/marketplace_creator_card_1794590210733.jpg"
            alt="Verified digital creator exchange"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Privacy & Security Safeguard Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs sm:text-sm text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p>{tr('securityPrivacyWarning')}</p>
      </div>

      {/* BUY TAB */}
      {tab === 'buy' && (
        !buyEnabled ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Buying is currently paused by the administrator.
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            No verified {category === 'tiktok' ? 'TikTok' : 'Gmail'} listings available right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((item) => (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-bold text-slate-900 truncate">
                        {item.accountHandle}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {category === 'tiktok'
                          ? `${item.followersCount.toLocaleString()} Followers`
                          : item.accountAgeOrRegion || 'Verified Gmail ID'}
                        {item.accountAgeOrRegion && category === 'tiktok' ? ` · ${item.accountAgeOrRegion}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-lg font-bold text-pink-600 tabular-nums shrink-0">
                      {formatCurrency(item.price)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.details}</p>

                  {item.verificationNote && (
                    <p className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{item.verificationNote}</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedListing(item);
                    setContactMethod(profile?.mobile || profile?.email || '');
                    setBuyerNote('');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{tr('buyNow')}</span>
                </button>
              </article>
            ))}
          </div>
        )
      )}

      {/* SELL TAB */}
      {tab === 'sell' && (
        !sellEnabled ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            Selling submissions are currently paused by the administrator.
          </div>
        ) : (
          <form onSubmit={handleSellSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {category === 'tiktok' ? 'Submit TikTok Account for Sale' : 'Submit Gmail Account for Sale'}
            </h2>
            <p className="text-xs text-slate-500">
              Provide public handle/masked label and analytics details only. Admin will verify ownership before publishing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {category === 'tiktok' ? 'TikTok Username' : 'Masked Gmail Label (e.g. us.2020***@gmail.com)'}
                </label>
                <input
                  type="text"
                  required
                  value={accountHandle}
                  onChange={(e) => setAccountHandle(e.target.value)}
                  placeholder={category === 'tiktok' ? '@creator_handle' : 'aged.bd.2021***@gmail.com'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Asking Price (৳)</label>
                <input
                  type="number"
                  required
                  min={10}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>

            {category === 'tiktok' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Profile URL</label>
                  <input
                    type="url"
                    required
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@handle"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Followers Count</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={followersCount}
                    onChange={(e) => setFollowersCount(e.target.value)}
                    placeholder="10500"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {category === 'tiktok' ? 'Niche / Country' : 'Account Age / Country / Recovery Status'}
              </label>
              <input
                type="text"
                required
                value={accountAgeOrRegion}
                onChange={(e) => setAccountAgeOrRegion(e.target.value)}
                placeholder={category === 'tiktok' ? 'Bangladesh · Comedy Niche' : '2020 Created · USA · Clean Recovery'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Account Details (Do NOT include passwords or recovery codes)
              </label>
              <textarea
                required
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe organic reach, monetization status, or clean history..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ownership Proof Screenshot</label>
              <label className="block border-2 border-dashed border-slate-200 hover:border-pink-400 rounded-2xl p-4 text-center cursor-pointer">
                {proofImage ? (
                  <img src={proofImage} alt="Ownership proof" className="max-h-44 mx-auto rounded-xl object-contain" />
                ) : (
                  <div className="py-3 space-y-1">
                    <ImagePlus className="w-6 h-6 text-pink-600 mx-auto" />
                    <p className="text-xs font-semibold text-slate-700">Upload analytics or dashboard screenshot</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleUploadProof} className="hidden" />
              </label>
            </div>

            <button
              type="submit"
              disabled={selling}
              className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold min-h-[44px]"
            >
              {selling ? 'Submitting...' : tr('submitForReview')}
            </button>
          </form>
        )
      )}

      {/* MY ORDERS & SUBMISSIONS TAB */}
      {tab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-slate-900 mb-4">My Buy Requests</h2>
            {myOrders.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">{tr('noData')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myOrders.map((ord) => (
                  <div key={ord.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">{ord.accountHandle}</p>
                      <StatusText status={ord.status} />
                    </div>
                    <p className="font-mono text-xs text-pink-600 font-semibold">{formatCurrency(ord.price)}</p>
                    <p className="text-xs text-slate-500 font-mono">{formatDateTime(ord.createdAt)}</p>
                    {ord.adminNote && <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">{ord.adminNote}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <h2 className="font-display text-base font-bold text-slate-900 mb-4">My Sell Listings</h2>
            {myListings.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">{tr('noData')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myListings.map((lst) => (
                  <div key={lst.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">{lst.accountHandle}</p>
                      <StatusText status={lst.status} />
                    </div>
                    <p className="font-mono text-xs text-pink-600 font-semibold">{formatCurrency(lst.price)}</p>
                    <p className="text-xs text-slate-500 font-mono">{formatDateTime(lst.createdAt)}</p>
                    {lst.rejectionReason && (
                      <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg">{lst.rejectionReason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Buy Request Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">Escrow Purchase Request</h3>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 mb-4">
              <p className="text-sm font-bold text-slate-900">{selectedListing.accountHandle}</p>
              <p className="font-mono text-base font-bold text-pink-600 mt-1">
                {formatCurrency(selectedListing.price)}
              </p>
            </div>
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your WhatsApp / Contact for Escrow Handover
                </label>
                <input
                  type="text"
                  required
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                  placeholder="+88017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Note (Optional)</label>
                <textarea
                  rows={2}
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Preferred handover time..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
              <button
                type="submit"
                disabled={ordering}
                className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold min-h-[44px]"
              >
                {ordering ? 'Sending Request...' : 'Submit Purchase Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
