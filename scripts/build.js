const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const requiredFiles = ["index.html", "styles.css", "script.js", "manifest.webmanifest", "sw.js", "offline.html"];
const requiredDirectories = ["icons"];
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable.");
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of requiredFiles) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

for (const directory of requiredDirectories) {
  fs.cpSync(path.join(root, directory), path.join(dist, directory), { recursive: true });
}

const config = `window.IRONPROOF_SUPABASE = {
  url: ${JSON.stringify(SUPABASE_URL)},
  anonKey: ${JSON.stringify(SUPABASE_ANON_KEY)},
};
`;

fs.writeFileSync(path.join(dist, "supabase-config.js"), config);
