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
