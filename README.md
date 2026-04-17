# IronProof

IronProofService is a technician job logger for heavy-duty equipment and automotive service work. Email/password accounts, user profiles, per-user job records, and job photos are stored in Supabase.

## Files

- `index.html` contains the app markup and form structure.
- `styles.css` contains the current visual design and responsive layout.
- `script.js` contains Supabase auth, profile loading, owner-scoped job loading/saving/editing/deleting, photo upload/delete, search/filter, detail rendering, and report behavior.
- `supabase-config.js` is a local fallback config file. Vercel generates the deployed version from environment variables during build.
- `supabase/schema.sql` contains the Supabase profiles/jobs/job_photos tables, storage bucket setup, auth profile trigger, ownership triggers, and Row Level Security policies.
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

Users sign up and log in with Supabase Auth. A profile is created for each auth user, jobs are scoped by `created_by`, and photos are stored in the private `job-photos` bucket with metadata in `job_photos`. The app does not add collaboration or teams yet.

Jobs support two form types:

- Heavy: machine, serial, meter, complaint, cause, correction, and parts.
- Automotive: year, make, model, VIN, mileage, customer concern, diagnosis, repair performed, and parts.

Both job types include customer name, customer phone, customer email, work order, date, summary, and photos. Existing jobs default to `Heavy`.
