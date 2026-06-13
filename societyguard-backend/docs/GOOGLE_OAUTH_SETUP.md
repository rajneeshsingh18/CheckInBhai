# Google OAuth Setup Guide

Follow these step-by-step instructions to configure Google OAuth for the Rakshak (SocietyGuard) application.

1. **Go to Google Cloud Console**
   - Navigate to [Google Cloud Console](https://console.cloud.google.com/).

2. **Create a New Project**
   - Click the project drop-down and select "New Project".
   - Name it "Rakshak" (or your preferred name) and click "Create".

3. **Enable APIs**
   - Go to "APIs & Services" > "Library".
   - Search for and enable the **Google+ API** and **People API**.

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen".
   - Choose **Internal** or **External** based on your target audience.
   - Set the App name to: `"Rakshak - Society Security"`.
   - Provide your support email.
   - Add authorized domains (if deploying to production).
   - Save and continue. Add scopes: `.../auth/userinfo.email` and `.../auth/userinfo.profile`.

5. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials".
   - Click "Create Credentials" > "OAuth client ID".
   - Select **Web application** as the application type.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `http://localhost:5173` (Vite Default)
     - `https://yourdomain.com` (Production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/google/callback`
   - Click "Create".

6. **Note Client ID and Client Secret**
   - Copy the generated `Client ID` and `Client Secret`.
   - Add them to your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

7. **Test Users**
   - While your app is in "Testing" mode (on the consent screen page), ensure you add your email address under "Test users" so you can log in during development.