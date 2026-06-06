import { readFileSync } from "fs";
import { resolve } from "path";

const requiredKeys = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "PINECONE_API_KEY",
];

let envContent = "";
const envPath = resolve(".env.local");

try {
  envContent = readFileSync(envPath, "utf-8");
} catch (err) {
  // .env.local not found or unreadable; proceed with empty content
}

const present = [];
const missing = [];

for (const key of requiredKeys) {
  // Check both process.env (from --env-file) and manually parsed env file
  const hasInProcess = process.env[key] !== undefined;
  const hasInFile = envContent.includes(`${key}=`);

  if (hasInProcess || hasInFile) {
    present.push(key);
  } else {
    missing.push(key);
  }
}

console.log("Environment variables:");
console.log("");

if (present.length > 0) {
  console.log("PRESENT:");
  present.forEach((key) => {
    console.log(`  ✓ ${key}`);
  });
  console.log("");
}

if (missing.length > 0) {
  console.log("MISSING:");
  missing.forEach((key) => {
    console.log(`  ✗ ${key}`);
  });
  console.log("");
  console.log(`Error: ${missing.length} required environment variable(s) missing.`);
  console.log("Please set them in .env.local before proceeding.");
  process.exit(1);
} else {
  console.log("All required environment variables are present.");
  process.exit(0);
}
