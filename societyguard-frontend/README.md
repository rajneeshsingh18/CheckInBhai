This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


 Prerequisites
  You need to have both the backend and frontend servers running simultaneously.
   1. Start Backend: In the societyguard-backend terminal: npm run dev (Runs on port 3000).
   2. Start Frontend: In the societyguard-frontend terminal: npm run dev (Runs on port 5173).

  ---

  Test 1: Resident Registration & Routing
   1. Open your browser and navigate to http://localhost:5173/register.
   2. Fill out the form with test data:
      - Name: John Resident
      - Email: resident1@example.com
      - Role: Resident
      - Password: Password123
      - Confirm Password: Password123
   3. Click "Create account".
   4. Verification: 
      - You should see a green success toast in the top center.
      - You should be immediately redirected to the Resident Dashboard (http://localhost:5173/resident).
      - The UI should display the desktop sidebar (if on a large screen) or the mobile bottom nav, with a red SOS button in the bottom right.

  Test 2: Middleware & Route Protection
   1. While logged in as the Resident, try to manually change the URL back to http://localhost:5173/login.
   2. Verification: The Next.js middleware should intercept this and instantly bounce you back to /resident.
   3. Try to manually change the URL to http://localhost:5173/admin.
   4. Verification: The useRequireRole hook should detect that you are a Resident (not an Admin) and bounce you back to the /login screen.

  Test 3: Logout & Local Login
   1. On your dashboard, click your Avatar circle in the top right corner and click Logout.
   2. You will be redirected to the Login page. 
   3. Fill out the login form with the credentials you just registered (resident1@example.com / Password123).
   4. Click "Sign in".
   5. Verification: You should see a success toast and be redirected back to /resident.
   6. Open your browser's Developer Tools (F12), go to Application -> Cookies. Verify that accessToken and refreshToken are stored securely.

  Test 4: The Guard Portal Experience
   1. Log out again using the Avatar dropdown.
   2. From the Login page, click the grey "Guard Login Portal ->" link at the very bottom.
   3. If you have seeded your database, use the seeded guard details. Otherwise, you can quickly register a Guard account at /register.
     (If you ran npm run db:seed in the backend, try: Society ID: SOC123, Guard ID: GRD456, PIN: 123456).
   4. Verification: 
      - The UI should transition to the specialized Guard Interface. 
      - The Sidebar should be hidden. 
      - You should see the prominent Bottom Navigation Bar with the elevated orange QR Scanner button in the center, as requested in your DESIGN.md.
      - Your Avatar in the top left should have an "On Duty" badge next to it.

  Test 5: Google OAuth Integration
   1. Log out again. 
   2. Go to http://localhost:5173/login and click "Sign in with Google".
   3. Verification: 
      - You should be redirected to the Google Consent screen.
      - After selecting an account, you should land briefly on an orange loading screen (/auth/callback).
      - You should then be smoothly redirected to your dashboard, and the user data should be successfully parsed from the URL hash.

  Test 6: Forgot Password (OTP Flow)
   1. Log out and navigate to http://localhost:5173/forgot-password.
   2. Enter the email address you registered earlier and click "Send OTP".
   3. Look at your backend terminal window. Since we are in MVP mode, the backend should be logging the simulated email out to the console. Look for a 6-digit number.
   4. Back in the browser, the UI should have shifted to Step 2. Enter the 6-digit OTP from the terminal and a new password.
   5. Click "Reset Password".
   6. Verification: You should see a success toast, be redirected to /login, and be able to successfully sign in with your brand new password.



# Rakshak (SocietyGuard) - Project Development & Phase 2 Walkthrough

Welcome to the central repository for **Rakshak (SocietyGuard)**. This workspace comprises two main projects:
1. **`societyguard-backend`**: Node.js/Express with Prisma ORM and Neon PostgreSQL database.
2. **`societyguard-frontend`**: Next.js 15+ React application optimized for mobile-first deployments.

---

## Technical Features & Architectural Improvements (Phase 2)

During Phase 2, we completed the **Guard Portal Experience & Core Features** to provide secure gate logging for visitors, deliveries, and staff. Since security guards use varying levels of mobile hardware in outdoor settings, all UIs are designed with high contrast, sunlight readability, and large touch targets ($\ge$ 48px).

Below is the detailed list of changes implemented across both repositories.

### 1. Backend Core & Database Changes (`societyguard-backend`)

#### A. Society Flats Directory Lookup API
* **New Service Method**: Added `getSocietyFlats` in `src/services/visitor.service.js` which queries all flats under a society, including their floor numbers and associated tower names.
* **New Route**: Exposed `GET /api/visitors/flats` in `src/routes/visitor.routes.js` to allow combobox autocompletion of flats on the frontend.

#### B. Guard Auto-Provisioning on Sign-Up
* **Service Modification**: Updated `registerWithEmail` in `src/services/auth.service.js`. When a user registers with the `role: "GUARD"`, the system automatically provisions the associated `Guard` database model record (holding shift times and duty status) using the supplied `societyId`.

#### C. Invalid Society ID Validation
* **Service Modification**: Added validation in `registerWithEmail` to check if the supplied `societyId` exists in the database. This prevents unhandled Prisma database constraint crashes (ForeignKeyConstraintViolation) and cleanly returns:
  > `"Invalid Society ID. Please check and try again."`

#### D. Auth Session & Token Synchronization
* **Database Includes**: Updated the query relationships in the following authentication routines in `auth.service.js` to include the `guard` model object:
  * Local Login: `loginWithEmail`
  * Token Rotation: `refreshToken`
  * PIN Portal Login: `guardLoginWithPin`
* **Result**: Ensures the frontend state always retains the guard's database profile (including `guardId` and `pinCode`) across logins and token refreshes.

---

### 2. Frontend Components & Pages (`societyguard-frontend`)

#### A. Guard Form Components (`src/components/forms/`)
* **VisitorEntryForm.tsx**: Single-column form with validation using `react-hook-form` + `zod`. Includes a flat search combobox, vehicle details, purpose selector, and a webcam stream module (`react-webcam`) to capture and compress photos.
* **QRScanner.tsx**: Built-in camera scanning using the `html5-qrcode` library, complete with scanning crosshairs and sound/haptic success feedback. Includes a fallback field for manual token validation.
* **DeliveryForm.tsx**: Large card-button provider selectors (Amazon, Flipkart, Swiggy, Zomato, etc.), package count steppers, and optional delivery agent details.
* **StaffAttendanceForm.tsx**: Split check-in search filters and quick one-tap check-out lists for currently checked-in staff members.

#### B. Guard Dashboard Views (`src/app/(dashboard)/guard/`)
* **page.tsx**: Guard dashboard featuring a shift status indicator, horizontal scrollable status counters (Pending, Visitors, Deliveries, Staff), a quick action button grid (Log Visitor, Scan QR, Log Delivery, etc.), and recent gate logs. Uses WebSockets (`socket.ts`) to instantly sync visitor statuses, approvals, and emergency SOS banners without page reloads.
* **entry/page.tsx**: Renders the Visitor Entry Form.
* **deliveries/page.tsx**: Renders the Delivery Logging Form.
* **scanner/page.tsx**: Renders the QR code scanner.
* **staff/page.tsx**: Renders the Staff Attendance sheets.
* **activity/page.tsx**: Full scrollable logs of today's gate activity.
* **more/page.tsx**: View shift profiles, society details, copy Guard IDs, setup PINs, and logout.

#### C. Guard PIN Configuration UI
* Added a **PIN Security** setup card to the profile settings page (`/guard/more`). Guards can enter a new 6-digit PIN which is securely hashed and stored in the database via the `/api/auth/setup-pin` endpoint, enabling PIN-based rapid logins.

#### D. Guard ID Display & Copy Feature
* Fixed a bug on `/guard/more` that displayed the `User ID` instead of the actual `Guard ID` CUID. It now displays the correct `user.guard.id` in a clean monospaced font badge. Clicking the badge copies the ID to the clipboard with visual toast feedback.

#### E. Framework & Library Build Compatibility
* **React Day Picker v10**: Mapped CSS layouts in `calendar.tsx` to the upgraded `month_grid` class structure to resolve Next.js build type errors.
* **Base UI Dropdown Nests**: Wrapped trigger styles directly inside trigger elements to prevent nested button trigger crashes.
* **Next.js Compilation**: Verified that the entire project compiles successfully (`npm run build`) with zero warnings or errors.

---

## Developer Guide & Getting Started

### 1. Prerequisites
Start both servers simultaneously in separate terminals:
* **Backend Dev Server**: `npm run dev` in `societyguard-backend` (runs on `http://localhost:3000`)
* **Frontend Dev Server**: `npm run dev` in `societyguard-frontend` (runs on `http://localhost:5173`)

### 2. Guard Onboarding & Login Tutorial

#### Step 1: Register as a New Guard
1. Go to **`http://localhost:5173/register`**.
2. Enter your details and select **Guard** under the Role dropdown.
3. In the conditional **Society ID** field that appears, enter a valid Society ID (e.g. Green Valley society ID: `cmqi12n6h0001is77i1mv68gq`).
4. Click **Create account**.

#### Step 2: Set Up Your 6-Digit PIN
1. You will be redirected to the dashboard. Click the **"More"** tab in the bottom navigation.
2. Under **PIN Security** (which will read *PIN Not Configured*), enter a 6-digit PIN of your choice (e.g. `123456`) and click **Save PIN**.
3. Under **Guard Station Profile**, click the **Guard ID** monospaced badge to copy your unique Guard ID (e.g. `cmqlpqc...`) to your clipboard.

#### Step 3: Log In to the Guard Portal
1. Clear your session by going to **`http://localhost:5173/logout`**.
2. Go to **`http://localhost:5173/guard-login`**.
3. Enter your login details:
   * **Society ID**: `cmqi12n6h0001is77i1mv68gq`
   * **Guard ID**: *Paste the Guard ID you copied earlier*
   * **6-Digit PIN**: The PIN you saved in Step 2.
4. Click **Login & Start Duty** to access the Guard Dashboard.

---

## Seed Test Credentials (Out of the Box)

If you have populated your database with `npm run db:seed` in the backend, you can use these test accounts:

### **Green Valley Apartments**
* **Society ID**: `cmqi12n6h0001is77i1mv68gq`
* **Guard 1 (Ramesh Guard 1)**:
  * **Guard ID**: `cmqi12nkt0005is77rguzkfmr`
  * **PIN**: `123456`
* **Resident 1 (Rahul Resident 101)**:
  * **Email**: `res_101_towera@green.com`
  * **Password**: `Test@123`

### **Sunshine Heights**
* **Society ID**: `cmqi12t5o0020is77iwa54wsa`
* **Guard 1 (Ramesh Guard 1)**:
  * **Guard ID**: `cmqi12tjl0024is77ri06ebvn`
  * **PIN**: `123456`

