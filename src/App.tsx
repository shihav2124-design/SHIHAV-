import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from '@/src/context/AppContext';
import { ToastContainer } from '@/src/components/ToastContainer';
import { AppShell } from '@/src/components/AppShell';
import { LoginPage } from '@/src/pages/LoginPage';
import { RegisterPage } from '@/src/pages/RegisterPage';
import { UserDashboardPage } from '@/src/pages/UserDashboardPage';
import { TasksPage } from '@/src/pages/TasksPage';
import { WalletPage } from '@/src/pages/WalletPage';
import { DepositPage } from '@/src/pages/DepositPage';
import { WithdrawPage } from '@/src/pages/WithdrawPage';
import { ProfilePage } from '@/src/pages/ProfilePage';
import { AdminPage } from '@/src/pages/AdminPage';
import { MarketplacePage } from '@/src/pages/MarketplacePage';
import { HistoryPage } from '@/src/pages/HistoryPage';
import { AdminAuthGate } from '@/src/components/AdminAuthGate';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-pink-600 mx-auto animate-pulse" />
        <p className="text-xs font-semibold text-slate-500">Loading PayTasker...</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authReady, firebaseUser } = useApp();
  if (!authReady) return <LoadingScreen />;
  if (!firebaseUser) return <Navigate to="/login.html" replace />;
  return <AppShell>{children}</AppShell>;
}

function AdminRoute() {
  const { authReady, firebaseUser, isAdmin } = useApp();
  if (!authReady) return <LoadingScreen />;
  if (!firebaseUser || !isAdmin) return <AdminAuthGate />;
  return (
    <AppShell>
      <AdminPage />
    </AppShell>
  );
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { authReady, firebaseUser } = useApp();
  if (!authReady) return <LoadingScreen />;
  if (firebaseUser) return <Navigate to="/user.html" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/user.html" replace />} />
      <Route path="/index.html" element={<Navigate to="/user.html" replace />} />

      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/login.html" element={<GuestOnly><LoginPage /></GuestOnly>} />

      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/register.html" element={<GuestOnly><RegisterPage /></GuestOnly>} />

      <Route path="/user" element={<RequireAuth><UserDashboardPage /></RequireAuth>} />
      <Route path="/user.html" element={<RequireAuth><UserDashboardPage /></RequireAuth>} />

      <Route path="/tasks" element={<RequireAuth><TasksPage /></RequireAuth>} />
      <Route path="/tasks.html" element={<RequireAuth><TasksPage /></RequireAuth>} />

      <Route path="/wallet" element={<RequireAuth><WalletPage /></RequireAuth>} />
      <Route path="/wallet.html" element={<RequireAuth><WalletPage /></RequireAuth>} />

      <Route path="/deposit" element={<RequireAuth><DepositPage /></RequireAuth>} />
      <Route path="/deposit.html" element={<RequireAuth><DepositPage /></RequireAuth>} />

      <Route path="/withdraw" element={<RequireAuth><WithdrawPage /></RequireAuth>} />
      <Route path="/withdraw.html" element={<RequireAuth><WithdrawPage /></RequireAuth>} />

      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/profile.html" element={<RequireAuth><ProfilePage /></RequireAuth>} />

      <Route path="/admin" element={<AdminRoute />} />
      <Route path="/admin/" element={<AdminRoute />} />
      <Route path="/admin.html" element={<AdminRoute />} />

      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/marketplace/tiktok" element={<RequireAuth><MarketplacePage category="tiktok" /></RequireAuth>} />
      <Route path="/marketplace/gmail" element={<RequireAuth><MarketplacePage category="gmail" /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/user.html" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </AppProvider>
  );
}
