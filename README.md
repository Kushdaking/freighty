# Freight Flow — Carrier App

Mobile app for carriers to manage vehicle transport loads.

## Stack
- **Expo** (SDK 51) + **Expo Router** (file-based navigation)
- **Supabase** (auth, database, storage, realtime)
- **TypeScript**

## Screens
- **Login** — Email/password auth via Supabase
- **My Loads** — Active loads assigned to this carrier
- **Available Loads** — Open loads to browse and accept
- **Load Detail** — Full load info, status updates, quick actions
- **Photos** — Pickup/delivery photo upload (camera or library)
- **Documents** — BOL, inspection reports, customs docs
- **Exception Report** — Report damage, delays, access issues
- **Messages** — Real-time chat with dispatcher
- **Profile** — Carrier profile, credentials, sign out

## Setup
```bash
npm install
npx expo start
```

## Supabase Storage Buckets Required
- `carrier-pod` — vehicle photos and POD images
- `carrier-docs` — documents (BOL, inspection, customs)

Set both buckets to public read or configure RLS as needed.

## Environment
Supabase URL and anon key are in `lib/supabase.ts`.
Move to env vars before production.
