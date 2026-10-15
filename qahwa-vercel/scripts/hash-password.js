// Pakai: node scripts/hash-password.js "password-kuat-kamu"
const crypto = require("crypto");
const p = process.argv[2];
if (!p || p.length < 12) { console.error('Password minimal 12 karakter. Contoh: node scripts/hash-password.js "kalimat sandi panjang 2026"'); process.exit(1); }
const salt = crypto.randomBytes(16);
console.log("ADMIN_PASSWORD_HASH=scrypt:" + salt.toString("hex") + ":" + crypto.scryptSync(p, salt, 64).toString("hex"));
