# IronProof

IronProof is a static diesel mechanic job log for documenting Caterpillar dealer service work. The current app stores job records and compressed photos in the browser with `localStorage`.

## Files

- `index.html` contains the app markup and form structure.
- `styles.css` contains the current visual design and responsive layout.
- `script.js` contains the local job storage, photo preview/compression, search/filter, edit/delete, and report behavior.
- `package.json` provides the Vercel build command.
- `vercel.json` tells Vercel to deploy the built static files from `dist`.

## Deploying To Vercel

Use these project settings if Vercel asks for them:

- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: default is fine

## Current Storage Behavior

The deployed app will still save records in each browser's `localStorage`. That keeps this version simple, but it means records are not shared between devices and can be lost if browser storage is cleared. Supabase should be added later for production job records and photo storage.
