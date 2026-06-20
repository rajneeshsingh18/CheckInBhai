# 🛡️ Rakshak (SocietyGuard)

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-indigo?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-black?style=for-the-badge&logo=socket.io)](https://socket.io/)

Rakshak (SocietyGuard) is a comprehensive, production-grade SaaS platform designed to modernize society security, visitor management, delivery tracking, and emergency response. Tailored specifically for dense housing societies and gated communities in the Asia-Pacific region, the application enforces high-contrast UI visibility for outdoor guards, rapid PIN logins, and zero-latency real-time synchronization.

---

## 🏗️ Architecture Overview

The workspace is split into two decoupled packages:

```
Saas Projects/
├── societyguard-backend/     # Express API, Prisma ORM, Neon PostgreSQL
└── societyguard-frontend/    # Next.js (App Router), Tailwind CSS, Socket.io
```

### System Workflows
```mermaid
sequenceDiagram
    autonumber
    actor G as Security Guard
    actor R as Flat Resident
    participant B as Express API
    participant DB as PostgreSQL
    participant S as Socket.io Server

    G->>B: Post Visitor Log /api/visitors/entry
    B->>DB: Save Entry (Status: PENDING)
    B->>S: Emit "visitor:new-entry"
    S-->>R: Push Real-time Approval Dialog
    R->>B: Put Approve Request /api/visitors/approve/:id
    B->>DB: Update Entry (Status: APPROVED)
    B->>S: Emit "visitor:approved"
    S-->>G: Instantly Notify Guard (Display Entry OK)
```

---

## 🌟 Core Features

### 1. Guard Portal & Gates (`/guard`)
*   **Rapid Authentication**: Authenticate directly at the gate using a unique **Society ID + Guard ID + 6-Digit PIN** (hashed with bcrypt).
*   **Visitor Logging**: Interactive, single-column forms with Indian mobile format validation (`+91`) and combobox directory lookup.
*   **Visual Check-ins**: In-browser camera capture using `react-webcam` with client-side image compression ($\le$ 800px) before upload.
*   **QR Pass Scanning**: Instant guest validation via device camera using `html5-qrcode` with manual verification fallbacks.
*   **Delivery Registry**: Large touch-target category selectors (Amazon, Flipkart, Zomato, Swiggy, Courier) with package counters.
*   **Staff Attendance**: Split tabs for arriving and departing daily staff (maids, drivers, cooks) with calculated hours worked.

### 2. Resident Experience (`/resident`)
*   **One-Tap SOS Button**: Emergency sirens with a 3-second press-and-hold countdown (to avoid accidental triggers) and instant guard room alerts.
*   **Visitor Approvals**: Real-time pop-ups with sound alerts and swipe-to-approve/reject capabilities for arriving guests.
*   **Guest Pass Generator**: Create temporary passes with encrypted QR tokens.
*   **Staff Registry**: Search, assign, and monitor staff check-in times.

### 3. Society Administration (`/admin`)
*   **Guard & Shift Management**: Manage guard rosters, active shift statuses, and PIN configurations.
*   **Real-time Operations**: Monitor gate statistics, active visitor volumes, and delivery status logs.
*   **Detailed Analytics**: Export chronological audit trails and security analytics.

---

## 🛠️ Technology Stack

### Backend
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: PostgreSQL (Neon Serverless PostgreSQL)
*   **ORM**: Prisma v7.8.0
*   **Authentication**: JSON Web Tokens (JWT) with secure cookie rotation & Google OAuth2
*   **Real-Time**: Socket.io

### Frontend
*   **Framework**: Next.js 15+ (App Router)
*   **Styling**: Tailwind CSS & Base UI
*   **State Management**: Zustand
*   **Data Fetching**: TanStack React Query v5 (stale time cache optimization)
*   **Form Management**: React Hook Form + Zod validation

---

## ⚡ Setup & Installation

### 1. Database Configuration
Ensure your database connection string is placed in the backend's environmental configuration:
```env
# societyguard-backend/.env
DATABASE_URL="postgresql://neondb_owner:...@ep-pooler.neon.tech/neondb?sslmode=require"
JWT_SECRET="your_jwt_secret"
REFRESH_SECRET="your_refresh_secret"
```

Run migrations and seed the database with testing data:
```bash
cd societyguard-backend
npm install
npx prisma db push
npm run db:seed
```

### 2. Run the Applications
Open two terminals to launch both development servers simultaneously:

*   **Terminal 1 (Backend)**:
    ```bash
    cd societyguard-backend
    npm run dev
    # Runs on http://localhost:3000
    ```
*   **Terminal 2 (Frontend)**:
    ```bash
    cd societyguard-frontend
    npm install
    npm run dev
    # Runs on http://localhost:5173
    ```

---

## 🔑 Test Credentials (Green Valley Apartments)

Use these seeded database credentials to verify standard workflows:

### Guard Station Login
*   **URL**: `http://localhost:5173/guard-login`
*   **Society ID**: `cmqi12n6h0001is77i1mv68gq`
*   **Guard ID**: `cmqi12nkt0005is77rguzkfmr`
*   **6-Digit PIN**: `123456`

### Resident Login
*   **URL**: `http://localhost:5173/login`
*   **Email**: `res_101_towera@green.com`
*   **Password**: `Test@123`

---

## 🚀 Guard Onboarding Walkthrough

If registering a new guard from scratch:

1.  **Register**: Go to `http://localhost:5173/register` and fill out the details. Select **Guard** as the role, enter the Society ID `cmqi12n6h0001is77i1mv68gq`, and click register.
2.  **Configure PIN**: Log in to the guard's account using email/password at `http://localhost:5173/login`. Navigate to the **"More"** tab and enter a 6-digit PIN under **PIN Security**. 
3.  **Retrieve ID**: Under **Guard Station Profile** on the same tab, click the **Guard ID** badge to copy the guard CUID to your clipboard.
4.  **Go On Duty**: Navigate to `http://localhost:5173/logout` and open the Guard Portal (`http://localhost:5173/guard-login`). Log in using the Society ID, your copied Guard ID, and the PIN you configured.
