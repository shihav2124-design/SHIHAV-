# PayTasker — Firebase Setup, Architecture & Deployment Guide

## 1. Firebase Project Configuration
This application connects to the provisioned Firebase project via `firebase-applet-config.json` (`shihav-52e67`, Firestore database `ai-studio-89167e5a-2db5-4020-82ee-7ade31cf4b4a`).

### Firebase Console Steps
1. Open the [Firebase Console](https://console.firebase.google.com/) and select project **`shihav-52e67`**.
2. **Authentication**:
   - **Google Sign-In** is enabled automatically.
   - To also allow **Email/Password** registration, login, forgot password, and email verification, go to **Build -> Authentication -> Sign-in method**, click **Email/Password**, enable it, and save.
   - Under **Authentication -> Settings -> Authorized domains**, verify your preview and production domains are listed.
3. **Cloud Firestore & Rules**:
   - `firestore.rules` is deployed to database `ai-studio-89167e5a-2db5-4020-82ee-7ade31cf4b4a`.
4. **Accessing `/admin` & Super Admin Login**:
   - Main domain `/` serves the User Interface (`/user.html` / `/login.html`).
   - Navigating directly to `/admin` (or `/admin.html`) opens the dedicated Admin Panel Login (`smmservicehelpcentre@gmail.com`).
   - You can sign in directly at `/admin` via **Google Sign-In**, or enable **Email/Password** in Firebase Console -> Authentication -> Sign-in method, set your admin password (in Firebase Console -> Users or under **Admin & Audit Logs -> Admin Security Profile** after Google sign-in), and sign in with Gmail + Password.
   - Open **Overview -> Initialize Starter Data** once to seed default settings, sample group tasks, and catalog items.

## 2. Firestore Database Structure
- `/users/{userId}` — Private user profiles (`uid`, `fullName`, `username`, `mobile`, `email`, `status`, `emailVerified`, `language`)
- `/admins/{adminId}` — Role-based admin registry (`super_admin`, `finance_admin`, `moderator`)
- `/wallets/{userId}` — Financial balances (`availableBalance`, `pendingBalance`, `totalEarned`, `totalWithdrawn`, `totalDeposited`)
- `/tasks/{taskId}` — Admin-created TikTok engagement tasks (`assignMode`: `'all'` | `'specific'`)
- `/taskSubmissions/{taskId}_{userId}` — Deterministic proof submissions preventing duplicate payouts
- `/deposits/{depositId}` — bKash / Nagad / Rocket deposit proofs
- `/withdrawals/{withdrawalId}` — Personal bKash / Nagad / Rocket withdrawal queue with reserved balance lock
- `/transactions/{txId}` — Immutable financial ledger (`txCode`, `userId`, `amount`, `type`, `status`)
- `/marketplaceListings/{listingId}` — Verified TikTok & Gmail ID buy/sell listings (zero passwords stored)
- `/marketplaceOrders/{orderId}` — Escrow purchase requests
- `/notifications/{notifId}` — Real-time user notifications
- `/settings/{settingId}` — `site`, `payments`, and `marketplace` configuration documents
- `/auditLogs/{logId}` — Admin financial & security audit logs

## 3. Build & Deployment
```bash
npm install
npm run dev
npm run lint
npm run build
```
