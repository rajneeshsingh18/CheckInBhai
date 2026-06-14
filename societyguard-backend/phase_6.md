# Phase 6: Visitor Management System

This document outlines the implementation of the core Visitor Management System, the operational heart of the Rakshak platform.

## Implemented Components

### 1. `otp.service.js` (Prompt 6.1)
- Implemented cryptographically secure 6-digit OTP generation using `crypto.randomInt()`.
- Built strict rate-limiting queries rejecting users requesting >5 OTPs per purpose per hour to mitigate SMS abuse.
- Established an automated `node-cron` background worker running every 15 minutes to delete expired tokens.

### 2. `notification.service.js` (Prompt 6.2)
- Stubbed out multi-channel alerting combining WhatsApp templated messages and fallback raw SMS logs.
- Wrote methods for Visitor Approvals, Deliveries, Staff Arrivals, and Emergency SOS broadcasts. Production code (via Axios and MSG91 API) is heavily commented and ready for live keys.

### 3. `visitor.service.js` (Prompt 6.3)
- Constructed the foundational business logic using Zod validation.
- All operations (`createEntry`, `approveEntry`, `rejectEntry`) are wrapped safely in Prisma `$transaction` blocks to prevent stranded or orphaned records.
- Heavy integration with `canAccess` RBAC rules so Guards cannot approve visitors, and Residents cannot manipulate society logs.

### 4. `upload.js` Middleware (Prompt 6.4)
- Developed a high-efficiency memory-storage strategy using `multer`.
- Used `sharp` to strip potentially insecure EXIF data from visitor photos, downscale to a maximum 800px width/height, and convert all files to bandwidth-friendly `.webp` format at 80% quality.

### 5. `visitor.routes.js` & `dashboard.routes.js` (Prompts 6.5 & 6.6)
- Deployed Express REST endpoints for all operational needs.
- Leveraged `Promise.all` inside the dashboard endpoints to dramatically speed up complex multi-table counting (such as pulling total visitors, active SOS alerts, and deliveries simultaneously).

### 6. `socket.js` (Prompt 6.7)
- Bootstrapped real-time duplex communication utilizing Socket.io.
- Implemented a custom handshake authorization middleware to reject unsigned websocket connection attempts.
- Established strict, hierarchical Socket.io "rooms" so that `visitor:new-entry` payloads are securely routed only to the target resident (`flat:{id}:residents`) and not broadcast to the whole complex.

## Server Integration
All features were successfully compiled into `index.js`, creating the primary HTTP server capable of handling Express HTTP requests and Socket.io upgrade requests simultaneously.