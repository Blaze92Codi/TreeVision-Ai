import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function credentialRule(text) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) return 'private-key';
  if (/\bAKIA[0-9A-Z]{16}\b/.test(text)) return 'aws-access-key';
  if (/\bsk_live_[a-zA-Z0-9]{20,}\b/.test(text)) return 'stripe-secret';
  if (/\bsk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{32,}\b/.test(text)) return 'model-api-secret';
  for (const jwt of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g)) {
    try { if (JSON.parse(Buffer.from(jwt[1], 'base64url').toString()).role === 'service_role') return 'supabase-service-key'; } catch {}
  }
  return null;
}

export function validatePolicy(p) {
  const errors = [];
  if (p.version !== 1) errors.push('unsupported policy version');
  if (!['business', 'personal'].includes(p.context)) errors.push('invalid context');
  if (p.county_access !== false) errors.push('County access must be excluded');
  if (p.agent_sensitive_actions_enabled !== false) errors.push('Sensitive agent actions require a separately reviewed runtime adapter; baseline forbids activation');
  if (p.external_authorization_required !== true || p.denied_means_stop !== true) errors.push('authorization boundary required');
  if (p.secrets_in_model_context !== false || p.secrets_in_logs !== false) errors.push('secret boundary required');
  if (p.restart_requires_owner_review !== true) errors.push('restart review required');
  if (!Array.isArray(p.approved_agent_destinations) || p.approved_agent_destinations.length) errors.push('baseline permits no agent egress destinations');
  if (!Number.isInteger(p.max_automatic_attempts) || p.max_automatic_attempts !== 1) errors.push('baseline permits one attempt only');
  return errors;
}

export function check(root) {
  const errors = [];
  try { errors.push(...validatePolicy(JSON.parse(fs.readFileSync(path.join(root, 'security/policy.json'), 'utf8')))); }
  catch { errors.push('missing or invalid security/policy.json'); }
  try {
    const rules = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    if (!rules.includes('Palmer application security requirements')) errors.push('build instructions missing');
  } catch { errors.push('AGENTS.md missing'); }
  let tracked;
  try { tracked = execFileSync('git', ['ls-files', '-z'], {cwd:root, encoding:'utf8'}).split('\0').filter(Boolean); }
  catch { return [...errors, 'Cannot enumerate tracked files; refusing incomplete scan']; }
  for (const name of tracked) {
    // Do not echo source lines or secret matches. Include vendor and environment files.
    const file = path.join(root, name);
    try {
      if (fs.lstatSync(file).isSymbolicLink()) { errors.push(`${name}: symlink requires review`); continue; }
      const bytes = fs.readFileSync(file);
      if (bytes.includes(0)) continue;
      const rule = credentialRule(bytes.toString('utf8'));
      if (rule) errors.push(`${name}: ${rule} detected (value redacted)`);
    } catch { errors.push(`${name}: could not inspect tracked file`); }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = check(process.cwd());
  if (errors.length) { for (const e of errors) console.error(e); process.exitCode = 1; }
  else console.log('PASS: baseline policy and tracked-file credential patterns. Runtime controls and deployment are not attested by this check.');
}
