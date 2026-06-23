# Phase 4: Advanced Staff Management & Notifications

This document outlines the advanced staff management features implemented in Phase 4.

## 1. Real-Time Web Push Notifications
- **Backend Infrastructure**: Integrated `web-push` library with VAPID keys for secure communication with browser push services.
- **Database**: Added `PushSubscription` model to Prisma to store user notification endpoints and keys securely.
- **Frontend Integration**: Created a Service Worker (`sw.js`) and a React hook (`usePushNotifications.ts`) to manage browser permissions and push events.
- **Functionality**: 
  - Residents can opt-in to receive push notifications via the "Enable Notifications" button on the Resident Dashboard.
  - When a Guard checks a staff member IN or OUT, the backend instantly pushes a native OS-level notification directly to the resident's device, regardless of whether the tab is actively focused.

## 2. Dedicated Staff Detail Page & Visual Calendar
- **Interactive Calendar**: Integrated `react-day-picker` to create a beautiful, full-month visual calendar for each staff member.
- **Color-Coded Status**: 
  - 🟢 Green: Present & On Time
  - 🟡 Yellow: Late Arrival
  - 🔴 Red: Absent
- **Monthly Summary**: Aggregated statistics displaying total present days, absent days, late days, and total hours worked for the selected month.
- **Shift Details**: Displays the expected working days and required check-in/check-out time windows for the staff.

## 3. Salary & Payment Calculator
- **Flexible Payment Types**: When adding a staff member, residents can choose between a Fixed Monthly Salary or an Hourly Rate.
- **Automated Engine**:
  - **Monthly Basis**: Calculates daily rate based on configured working days and mathematically deducts a penalty for late arrivals or absences.
  - **Hourly Basis**: Multiplies the exact hours tracked by the gate scans by the set hourly rate.
- **Live UI Widget**: A premium "Salary Estimate" widget on the staff detail page updates in real-time as the staff checks in and out throughout the month.

## Upcoming Pending Features
- **Guard Action Requests**: Allow residents to attach daily notes for the guard (e.g., "Give keys to maid today", or "Do not allow driver in").
- **Automated "Absent" Workflows**: Background CRON jobs to automatically mark expected staff as "ABSENT" if they fail to show up by a certain time, sending an automatic alert to the resident.
