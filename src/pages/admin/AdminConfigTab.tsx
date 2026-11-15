import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, reauthenticateWithPopup, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { Eye, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { auth, firebaseConfig } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import {
  adminAssignRole,
  adminRevokeRole,
  adminSaveSettings,
  adminUpdateListing,
  adminUpdateMarketplaceOrder,
  createMarketplaceListing,
} from '@/src/lib/firestoreService';
import { formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import {
  AdminRole,
  AuditLog,
  MarketplaceCategory,
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceSettings,
  OrderStatus,
  PaymentSettings,
  SiteSettings,
} from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

interface Props {
  activeSection: 'website' | 'payments' | 'marketplace' | 'adminSettings';
  listings: MarketplaceListing[];
  orders: MarketplaceOrder[];
  adminRoles: AdminRole[];
  auditLogs: AuditLog[];
  onPreviewImage: (url: string, title: string) => void;
}

export function AdminConfigTab({
  activeSection,
  listings,
  orders,
  adminRoles,
  auditLogs,
  onPreviewImage,
}: Props) {
  const { firebaseUser, siteSettings, paymentSettings, marketplaceSettings, showToast } = useApp();
  const adminUid = firebaseUser?.uid || '';
  const adminEmail = firebaseUser?.email || '';

  const [siteForm, setSiteForm] = useState<SiteSettings>(siteSettings);
  const [payForm, setPayForm] = useState<PaymentSettings>(paymentSettings);
  const [mktForm, setMktForm] = useState<MarketplaceSettings>(marketplaceSettings);

  useEffect(() => setSiteForm(siteSettings), [siteSettings]);
  useEffect(() => setPayForm(paymentSettings), [paymentSettings]);
  useEffect(() => setMktForm(marketplaceSettings), [marketplaceSettings]);

  // Direct catalog creation
  const [newCat, setNewCat] = useState<MarketplaceCategory>('tiktok');
  const [newHandle, setNewHandle] = useState('');
  const [newFollowers, setNewFollowers] = useState('0');
  const [newRegion, setNewRegion] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Admin role form
  const [roleUid, setRoleUid] = useState('');
  const [roleEmail, setRoleEmail] = useState('');
  const [roleType, setRoleType] = useState<AdminRole['role']>('moderator');
  const [adminNewPass, setAdminNewPass] = useState('');

  const [saving, setSaving] = useState(false);

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminSaveSettings('site', siteForm, adminUid, adminEmail);
      showToast('Website settings updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminSaveSettings(
        'payments',
        {
          ...payForm,
          minDeposit: Number(payForm.minDeposit),
          minWithdrawal: Number(payForm.minWithdrawal),
          maxWithdrawal: Number(payForm.maxWithdrawal),
          withdrawalChargePercent: Number(payForm.withdrawalChargePercent),
        },
        adminUid,
        adminEmail
      );
      showToast('Payment settings updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMarketplace = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminSaveSettings('marketplace', mktForm, adminUid, adminEmail);
      showToast('Marketplace settings updated.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createMarketplaceListing({
        category: newCat,
        listingType: 'buy_catalog',
        sellerId: adminUid,
        sellerName: 'Verified Escrow Desk',
        accountHandle: newHandle,
        followersCount: Number(newFollowers || 0),
        accountAgeOrRegion: newRegion,
        details: newDetails,
        price: Number(newPrice),
        isAdminCreated: true,
      });
      showToast('Catalog listing published.', 'success');
      setNewHandle('');
      setNewFollowers('0');
      setNewRegion('');
      setNewDetails('');
      setNewPrice('');
    } catch (err: any) {
      showToast(err?.message || 'Could not publish listing.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignAdminRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminAssignRole({
        targetUid: roleUid.trim(),
        targetEmail: roleEmail.trim(),
        role: roleType,
        permissions:
          roleType === 'super_admin'
            ? ['users', 'tasks', 'deposits', 'withdrawals', 'wallets', 'settings', 'marketplace', 'admins']
            : roleType === 'finance_admin'
            ? ['deposits', 'withdrawals', 'wallets']
            : ['tasks', 'marketplace', 'users'],
        adminUid,
        adminEmail,
      });
      showToast('Admin role assigned.', 'success');
      setRoleUid('');
      setRoleEmail('');
    } catch (err: any) {
      showToast(err?.message || 'Could not assign role.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdminPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || adminNewPass.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    try {
      await updatePassword(firebaseUser, adminNewPass);
      showToast('Admin password saved. You can now sign in at /admin with Gmail & Password.', 'success');
      setAdminNewPass('');
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        try {
          await reauthenticateWithPopup(firebaseUser, new GoogleAuthProvider());
          await updatePassword(firebaseUser, adminNewPass);
          showToast('Re-authenticated and admin password saved!', 'success');
          setAdminNewPass('');
          return;
        } catch (reErr: any) {
          showToast(reErr?.message || 'Re-authentication cancelled.', 'error');
          return;
        }
      }
      if (err?.code === 'auth/operation-not-allowed') {
        showToast(
          `Enable Email/Password in Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Sign-in method first.`,
          'error'
        );
        return;
      }
      showToast(err?.message || 'Could not update password.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 6. WEBSITE SETTINGS */}
      {activeSection === 'website' && (
        <form onSubmit={handleSaveSite} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Website Branding &amp; Status Settings</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website Brand Name</label>
              <input
                type="text"
                required
                value={siteForm.brandName}
                onChange={(e) => setSiteForm({ ...siteForm, brandName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Logo URL (Optional)</label>
              <input
                type="text"
                value={siteForm.logoUrl}
                onChange={(e) => setSiteForm({ ...siteForm, logoUrl: e.target.value })}
                placeholder="https://... (leave blank for built-in emblem)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Banner Headline</label>
              <input
                type="text"
                required
                value={siteForm.bannerTitle}
                onChange={(e) => setSiteForm({ ...siteForm, bannerTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Banner Subtitle</label>
              <input
                type="text"
                required
                value={siteForm.bannerSubtitle}
                onChange={(e) => setSiteForm({ ...siteForm, bannerSubtitle: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Website Notice / Announcement</label>
            <textarea
              rows={2}
              required
              value={siteForm.noticeText}
              onChange={(e) => setSiteForm({ ...siteForm, noticeText: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Support WhatsApp Number</label>
              <input
                type="text"
                required
                value={siteForm.whatsappNumber}
                onChange={(e) => setSiteForm({ ...siteForm, whatsappNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Support Link</label>
              <input
                type="text"
                value={siteForm.supportLink}
                onChange={(e) => setSiteForm({ ...siteForm, supportLink: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website Status</label>
              <select
                value={siteForm.websiteStatus}
                onChange={(e) => setSiteForm({ ...siteForm, websiteStatus: e.target.value as 'live' | 'maintenance' })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="live">Live</option>
                <option value="maintenance">Maintenance Mode</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Registrations</label>
              <select
                value={siteForm.registrationOpen ? 'open' : 'closed'}
                onChange={(e) => setSiteForm({ ...siteForm, registrationOpen: e.target.value === 'open' })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Website Settings'}</span>
          </button>
        </form>
      )}

      {/* 7. PAYMENT SETTINGS */}
      {activeSection === 'payments' && (
        <form onSubmit={handleSavePayments} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Payment Gateway &amp; Rules</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">bKash Number</label>
              <input
                type="text"
                required
                value={payForm.bkashNumber}
                onChange={(e) => setPayForm({ ...payForm, bkashNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nagad Number</label>
              <input
                type="text"
                required
                value={payForm.nagadNumber}
                onChange={(e) => setPayForm({ ...payForm, nagadNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rocket Number</label>
              <input
                type="text"
                required
                value={payForm.rocketNumber}
                onChange={(e) => setPayForm({ ...payForm, rocketNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Deposit (৳)</label>
              <input
                type="number"
                required
                value={payForm.minDeposit}
                onChange={(e) => setPayForm({ ...payForm, minDeposit: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Withdrawal (৳)</label>
              <input
                type="number"
                required
                value={payForm.minWithdrawal}
                onChange={(e) => setPayForm({ ...payForm, minWithdrawal: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Withdrawal (৳)</label>
              <input
                type="number"
                required
                value={payForm.maxWithdrawal}
                onChange={(e) => setPayForm({ ...payForm, maxWithdrawal: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Charge (%)</label>
              <input
                type="number"
                step="0.5"
                required
                value={payForm.withdrawalChargePercent}
                onChange={(e) => setPayForm({ ...payForm, withdrawalChargePercent: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Processing Time Label</label>
            <input
              type="text"
              required
              value={payForm.processingTime}
              onChange={(e) => setPayForm({ ...payForm, processingTime: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Instructions</label>
            <textarea
              rows={2}
              required
              value={payForm.depositInstructions}
              onChange={(e) => setPayForm({ ...payForm, depositInstructions: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Withdrawal Instructions</label>
            <textarea
              rows={2}
              required
              value={payForm.withdrawalInstructions}
              onChange={(e) => setPayForm({ ...payForm, withdrawalInstructions: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Payment Rules'}</span>
          </button>
        </form>
      )}

      {/* 8. MARKETPLACE SETTINGS & APPROVALS */}
      {activeSection === 'marketplace' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveMarketplace} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900">Marketplace Module Controls</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                { key: 'tiktokBuyEnabled', label: 'TikTok Buy' },
                { key: 'tiktokSellEnabled', label: 'TikTok Sell' },
                { key: 'gmailBuyEnabled', label: 'Gmail Buy' },
                { key: 'gmailSellEnabled', label: 'Gmail Sell' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(mktForm as any)[item.key]}
                    onChange={(e) => setMktForm({ ...mktForm, [item.key]: e.target.checked })}
                  />
                  <span className="font-medium text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Escrow Notice</label>
              <input
                type="text"
                value={mktForm.escrowNotice}
                onChange={(e) => setMktForm({ ...mktForm, escrowNotice: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-semibold">
              Save Marketplace Toggles
            </button>
          </form>

          {/* Add Catalog Item */}
          <form onSubmit={handleCreateCatalog} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-pink-600" />
              <span>Publish Verified Buy Listing</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value as MarketplaceCategory)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="tiktok">TikTok Account</option>
                <option value="gmail">Gmail ID</option>
              </select>
              <input
                type="text"
                required
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@handle or masked@gmail.com"
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
              <input
                type="number"
                required
                min={1}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Price (৳)"
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="number"
                value={newFollowers}
                onChange={(e) => setNewFollowers(e.target.value)}
                placeholder="Followers (for TikTok)"
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
              <input
                type="text"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="Age / Region / Niche"
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <textarea
              rows={2}
              required
              value={newDetails}
              onChange={(e) => setNewDetails(e.target.value)}
              placeholder="Account details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold">
              Publish Listing
            </button>
          </form>

          {/* Listings Approval Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">Marketplace Listings ({listings.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {listings.map((lst) => (
                <div key={lst.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold uppercase text-pink-600">{lst.category}</span>
                      <span className="font-bold text-sm text-slate-900">{lst.accountHandle}</span>
                      <StatusText status={lst.status} />
                    </div>
                    <p className="text-xs text-slate-600">
                      Seller: {lst.sellerName} · Price <span className="font-mono font-bold">{formatCurrency(lst.price)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lst.proofImageData && (
                      <button
                        type="button"
                        onClick={() => onPreviewImage(lst.proofImageData!, `Ownership Proof: ${lst.accountHandle}`)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Proof
                      </button>
                    )}
                    {lst.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          adminUpdateListing({ listingId: lst.id, status: 'approved', listing: lst, adminUid, adminEmail }).then(() =>
                            showToast('Listing approved', 'success')
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        Approve
                      </button>
                    )}
                    {lst.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          adminUpdateListing({
                            listingId: lst.id,
                            status: 'rejected',
                            rejectionReason: 'Did not meet verification criteria',
                            listing: lst,
                            adminUid,
                            adminEmail,
                          }).then(() => showToast('Listing rejected', 'info'))
                        }
                        className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Buy Orders Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">Purchase Orders ({orders.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {orders.map((ord) => (
                <div key={ord.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{ord.accountHandle}</span>
                      <StatusText status={ord.status} />
                    </div>
                    <p className="text-xs text-slate-600">
                      Buyer: {ord.buyerName} ({ord.contactMethod}) · <span className="font-mono font-bold">{formatCurrency(ord.price)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['verified', 'completed', 'cancelled'] as OrderStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          adminUpdateMarketplaceOrder({
                            order: ord,
                            status: st,
                            adminNote: `Order marked ${st} by admin`,
                            adminUid,
                            adminEmail,
                          }).then(() => showToast(`Order ${st}`, 'success'))
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold capitalize"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. ADMIN SETTINGS, ROLES & AUDIT LOGS */}
      {activeSection === 'adminSettings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleAdminPasswordUpdate} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-pink-600" />
                <span>Admin Security Profile</span>
              </h2>
              <p className="text-xs font-mono text-slate-500">Signed in as: {adminEmail}</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Set or update the login password for this admin Gmail so you can sign in directly at <span className="font-mono font-semibold">/admin</span> using Gmail + Password (requires Email/Password enabled in Firebase Console).
              </p>
              <input
                type="password"
                required
                minLength={6}
                value={adminNewPass}
                onChange={(e) => setAdminNewPass(e.target.value)}
                placeholder="New admin password (min 6 chars)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="px-4 py-2 rounded-xl bg-navy-900 text-white text-xs font-semibold min-h-[40px]">
                  Save / Update Password
                </button>
                <button
                  type="button"
                  onClick={() => sendPasswordResetEmail(auth, adminEmail).then(() => showToast('Reset link emailed', 'success'))}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold min-h-[40px]"
                >
                  Send Reset Email
                </button>
              </div>
            </form>

            <form onSubmit={handleAssignAdminRole} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-900">Assign Admin Role</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={roleUid}
                  onChange={(e) => setRoleUid(e.target.value)}
                  placeholder="User UID"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                />
                <input
                  type="email"
                  required
                  value={roleEmail}
                  onChange={(e) => setRoleEmail(e.target.value)}
                  placeholder="Admin email"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <select
                value={roleType}
                onChange={(e) => setRoleType(e.target.value as AdminRole['role'])}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              >
                <option value="super_admin">Super Admin (Full Access)</option>
                <option value="finance_admin">Finance Admin (Deposits / Withdrawals / Wallets)</option>
                <option value="moderator">Moderator (Tasks / Marketplace / Users)</option>
              </select>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-semibold">
                Grant Admin Role
              </button>

              <div className="pt-2 divide-y divide-slate-100 text-xs">
                {adminRoles.map((r) => (
                  <div key={r.uid} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-900">{r.email}</span> ·{' '}
                      <span className="font-mono text-pink-600">{r.role}</span>
                    </div>
                    {r.uid !== adminUid && (
                      <button
                        type="button"
                        onClick={() => adminRevokeRole(r.uid).then(() => showToast('Role revoked', 'info'))}
                        className="text-rose-600 hover:bg-rose-50 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">Admin Activity &amp; Audit Logs ({auditLogs.length})</h3>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.slice(0, 40).map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-navy-900">{log.action}</span>{' '}
                    <span className="text-slate-600">— {log.details}</span>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      By {log.actorEmail} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  {log.amountDelta !== 0 && (
                    <span className="font-mono font-bold text-pink-600 tabular-nums">
                      {log.amountDelta > 0 ? `+${formatCurrency(log.amountDelta)}` : formatCurrency(log.amountDelta)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
