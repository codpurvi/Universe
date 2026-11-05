# Our Little Universe ♡

A vintage scrapbook-style website preview and project starter. The included HTML keeps the existing cream-and-burgundy scrapbook design, navigation, Spotify playlist embed, and all page sections. The photobook has a two-page spread, animated 3D page turns, and controls for adding photos, editing captions, reordering pages, and removing photos.

## Current status

The site preview runs locally without a Supabase project. The photobook's Supabase client and setup files are included as an integration scaffold, but no project credentials or deployed backend are included. Shared cloud editing is **not configured or verified** in this package. Until setup is complete, the photobook will show a setup-needed message instead of syncing photos between people or devices.

## View the HTML preview

Open `index.html` directly in a browser to inspect the page design and sections. For the full local app workflow below, use the Vite server.

## Run locally

1. Install Node.js (LTS).
2. Open a terminal in this project folder and install dependencies:

   ```bash
   npm install
   ```

3. Start the local preview:

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite. The page and non-cloud sections are available; cloud photobook sign-in and syncing need the later setup below.

## Configure Supabase later

When you're ready to enable shared photobook editing:

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the included `supabase/schema.sql`. It creates the photobook table, private photo bucket, access policies, and realtime publication entry.
3. Invite the two intended users in Supabase Authentication. The included policies grant editing to signed-in users, so disable public sign-ups and only invite the intended accounts.
4. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable (or legacy anon) key. Keep secret and `service_role` keys out of browser code.
5. Restart Vite and sign in using the invited accounts. Then confirm uploads, caption edits, page ordering, and removal work as expected.

The app accepts JPEG, PNG, and WebP photo uploads up to 10 MB each. This integration has not been connected to a real Supabase project in this package.

## Deploy to Vercel later

1. Put the project in a Git repository and import it into Vercel.
2. Vercel should detect Vite. Use `npm run build` as the build command and `dist` as the output directory.
3. In Vercel project settings, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the same browser-safe values as the local environment.
4. Deploy, then add the Vercel site URL under Supabase Authentication URL Configuration.
5. Test sign-in and photobook editing on both devices. Cloud sharing is active only after Supabase is configured, the schema and invitations are in place, and the deployed app has been verified.

Do not commit `.env.local` or place a Supabase secret/service-role key in Vercel's client-exposed `VITE_` variables.
