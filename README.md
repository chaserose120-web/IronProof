# IronProof

IronProof is a static diesel mechanic job log for documenting Caterpillar dealer service work. Job records are stored in Supabase, while photo upload is not connected yet.

## Files

- `index.html` contains the app markup and form structure.
- `styles.css` contains the current visual design and responsive layout.
- `script.js` contains Supabase job loading/saving/editing/deleting, search/filter, detail rendering, and report behavior.
- `supabase-config.js` is a local fallback config file. Vercel generates the deployed version from environment variables during build.
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

Jobs are loaded from and saved to the Supabase `jobs` table. The app does not add authentication or photo upload yet, so Supabase Row Level Security policies need to allow the intended anonymous access until authentication is added.
