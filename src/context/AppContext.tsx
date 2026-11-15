import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db, firebaseConfig, testFirestoreConnection } from '@/src/lib/firebase';
import {
  AppNotification,
  Language,
  MarketplaceSettings,
  PaymentSettings,
  SiteSettings,
  UserProfile,
  Wallet,
} from '@/src/types';
import {
  DEFAULT_MARKETPLACE_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  t,
} from '@/src/lib/defaults';
import { ensureUserAndWallet, updateUserProfileFields } from '@/src/lib/firestoreService';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  profile: UserProfile | null;
  wallet: Wallet | null;
  isAdmin: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  siteSettings: SiteSettings;
  paymentSettings: PaymentSettings;
  marketplaceSettings: MarketplaceSettings;
  language: Language;
  setLanguage: (lang: Language) => void;
  tr: (key: string) => string;
  toasts: ToastItem[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  refreshAuthUser: () => Promise<boolean>;
  logout: () => Promise<void>;
  firebaseRulesNotice: string | null;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [marketplaceSettings, setMarketplaceSettings] = useState<MarketplaceSettings>(DEFAULT_MARKETPLACE_SETTINGS);
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pt_lang') : null;
    return saved === 'bn' ? 'bn' : 'en';
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [firebaseRulesNotice, setFirebaseRulesNotice] = useState<string | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    testFirestoreConnection();
    const unsubSite = onSnapshot(
      doc(db, 'settings', 'site'),
      (snap) => {
        if (snap.exists() && snap.data()?.data) {
          setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...snap.data().data });
        }
        setFirebaseRulesNotice(null);
      },
      (err) => {
        if (err.message?.includes('permission') || err.code === 'permission-denied') {
          setFirebaseRulesNotice(
            `Firestore rules have not been deployed to project "${firebaseConfig.projectId}" yet. Publish firestore.rules in Firebase Console.`
          );
        }
      }
    );

    const unsubPay = onSnapshot(
      doc(db, 'settings', 'payments'),
      (snap) => {
        if (snap.exists() && snap.data()?.data) {
          setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...snap.data().data });
        }
      },
      () => {}
    );

    const unsubMkt = onSnapshot(
      doc(db, 'settings', 'marketplace'),
      (snap) => {
        if (snap.exists() && snap.data()?.data) {
          setMarketplaceSettings({ ...DEFAULT_MARKETPLACE_SETTINGS, ...snap.data().data });
        }
      },
      () => {}
    );

    return () => {
      unsubSite();
      unsubPay();
      unsubMkt();
    };
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await ensureUserAndWallet(user);
        } catch (err) {
          console.error('Initialization sync:', err);
        }
      } else {
        setProfile(null);
        setWallet(null);
        setIsAdminDoc(false);
        setNotifications([]);
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          if (data.language && (data.language === 'en' || data.language === 'bn')) {
            setLanguageState(data.language);
            localStorage.setItem('pt_lang', data.language);
          }
        }
      },
      (err) => {
        console.error('User snapshot error:', err);
      }
    );

    const unsubWallet = onSnapshot(
      doc(db, 'wallets', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setWallet(snap.data() as Wallet);
        }
      },
      (err) => {
        console.error('Wallet snapshot error:', err);
      }
    );

    const unsubAdmin = onSnapshot(
      doc(db, 'admins', firebaseUser.uid),
      (snap) => {
        setIsAdminDoc(snap.exists());
      },
      () => {
        setIsAdminDoc(false);
      }
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
        items.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        setNotifications(items);
      },
      () => {}
    );

    return () => {
      unsubUser();
      unsubWallet();
      unsubAdmin();
      unsubNotifs();
    };
  }, [firebaseUser]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('pt_lang', lang);
      if (firebaseUser) {
        updateUserProfileFields(firebaseUser.uid, { language: lang }).catch(() => {});
      }
    },
    [firebaseUser]
  );

  const tr = useCallback((key: string) => t(language, key), [language]);

  const refreshAuthUser = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setFirebaseUser(updated ? ({ ...updated } as User) : null);
    if (updated?.emailVerified) {
      await ensureUserAndWallet(updated);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    showToast(language === 'bn' ? 'সফলভাবে লগআউট হয়েছে' : 'Signed out successfully', 'info');
  }, [language, showToast]);

  const isAdmin =
    Boolean(firebaseUser?.emailVerified && firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL) ||
    Boolean(firebaseUser?.emailVerified && isAdminDoc);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        authReady,
        firebaseUser,
        profile,
        wallet,
        isAdmin,
        notifications,
        unreadCount,
        siteSettings,
        paymentSettings,
        marketplaceSettings,
        language,
        setLanguage,
        tr,
        toasts,
        showToast,
        dismissToast,
        refreshAuthUser,
        logout,
        firebaseRulesNotice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
