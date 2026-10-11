// Dev-only helper: prints a pbkdf2-sha256 password hash compatible with src/auth.ts
// so a local D1 admin password can be reset. Usage:
//   node scripts/dev-hash.mjs [password]
// Then apply with:
//   npx wrangler d1 execute church-members-db --local --command "UPDATE users SET password_hash='<hash>' WHERE username='admin'"
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2] ?? "admin123";
const iterations = 10000;
const salt = randomBytes(16);
const dk = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const hash = `pbkdf2-sha256$${iterations}$${salt.toString("base64")}$${dk.toString("base64")}`;
console.log(hash);
