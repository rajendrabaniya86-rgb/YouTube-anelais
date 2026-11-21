import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const requiredMigrations = [
  '001_initial_schema.sql',
  '002_security_hardening.sql',
  '003_payment_reminders.sql',
  '004_ledger_offline_idempotency.sql',
  '005_customer_account_foundation.sql',
  '006_protect_account_type.sql',
  '007_customer_link_invites.sql',
  '008_customer_link_claims.sql',
  '009_function_privilege_hardening.sql',
  '010_table_privilege_hardening.sql',
  '011_atomic_invites_and_policy_tuning.sql',
  '012_payment_reminder_fk_index.sql',
  '013_invoker_shop_owner_helper.sql',
  '014_customer_consent_write_lockdown.sql',
];
const requiredFunctions = [
  'create-customer-link-invite',
  'redeem-customer-link-invite',
  'list-customer-link-claims',
];
const failures = [];
const migrationsDir = 'supabase/migrations';
const found = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
for (const name of requiredMigrations) {
  if (!found.includes(name)) failures.push(`Missing migration: ${name}`);
}
for (const name of found) {
  if (!requiredMigrations.includes(name)) failures.push(`Unexpected/unreviewed migration in deployment set: ${name}`);
}

const config = await readFile('supabase/config.toml', 'utf8');
for (const name of requiredFunctions) {
  const folder = `supabase/functions/${name}`;
  if (!existsSync(`${folder}/index.ts`)) failures.push(`Missing Edge Function: ${name}/index.ts`);
  if (!config.includes(`[functions.${name}]\\nverify_jwt = true`) &&
      !config.includes(`[functions.${name}]\nverify_jwt = true`)) {
    failures.push(`JWT verification must be enabled for ${name}`);
  }
}

const envExample = await readFile('.env.example', 'utf8');
if (!envExample.includes('VITE_SUPABASE_URL=') || !envExample.includes('VITE_SUPABASE_ANON_KEY=')) {
  failures.push('Browser environment example must define Supabase URL and publishable/anon key');
}
if (/^\\s*(?:VITE_)?SUPABASE_SERVICE_ROLE_KEY\\s*=/im.test(envExample)) failures.push('Never place service-role credentials in .env.example');
const frontendFiles = ['src/lib/supabase.js', 'src/App.jsx', 'src/AuthGate.jsx'];
for (const file of frontendFiles) {
  const source = await readFile(file, 'utf8');
  if (/SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(source)) {
    failures.push(`Possible service-role credential/reference in browser file: ${file}`);
  }
}

if (failures.length) {
  console.error('Supabase preflight FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Supabase preflight OK: ${requiredMigrations.length} ordered migrations, ${requiredFunctions.length} JWT-protected Edge Functions, browser key separation.`);
