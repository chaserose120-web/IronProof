# IronProof

IronProof is a static diesel mechanic job log for documenting Caterpillar dealer service work. Email/password accounts, user profiles, and per-user job records are stored in Supabase, while photo upload is not connected yet.

## Files

- `index.html` contains the app markup and form structure.
- `styles.css` contains the current visual design and responsive layout.
- `script.js` contains Supabase auth, profile loading, owner-scoped job loading/saving/editing/deleting, search/filter, detail rendering, and report behavior.
- `supabase-config.js` is a local fallback config file. Vercel generates the deployed version from environment variables during build.
- `supabase/schema.sql` contains the Supabase profiles/jobs tables, auth profile trigger, ownership triggers, and Row Level Security policies.
- `scripts/build.js` copies static files to `dist` and writes the Supabase browser config from `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- `package.json` provides the Vercel build command.
- `vercel.json` tells Vercel to deploy the built static files from `dist`.

## Deploying To Vercel

Use these project settings if Vercel asks for them:

- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: default is fine

Set these Vercel environment variables before deploying:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Current Storage Behavior

Users sign up and log in with Supabase Auth. A profile is created for each auth user, and jobs are scoped by `created_by` so users only see their own job records. The app does not add collaboration, teams, or photo upload yet.
