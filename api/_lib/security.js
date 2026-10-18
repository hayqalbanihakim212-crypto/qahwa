/* Utilitas keamanan: hash, perbandingan aman, ID acak, rahasia pesanan, pembatas percobaan. */
const crypto = require("crypto");
const { kv } = require("./store");

const sha = (s, alg = "sha512") =>
  crypto.createHash(alg).update(s).digest("hex");
const safeEq = (a, b) => {
  a = Buffer.from(String(a));
  b = Buffer.from(String(b));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// 32 karakter tanpa I, O, 0, 1 supaya mudah dibaca. 256 % 32 == 0, jadi `byte % 32` tidak bias.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = (n) =>
  Array.from(crypto.randomBytes(n), (b) => ALPHABET[b % 32]).join("");

const ID_RE = /^QHW-[A-Z2-9]{8}$/;
const newId = () => "QHW-" + randomCode(8);

// Buang karakter kontrol, rapikan spasi, batasi panjang
const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Rahasia per pesanan: hanya hash-nya yang disimpan di server
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
const newSecret = () => crypto.randomBytes(24).toString("base64url"); // 32 karakter
const secOk = (order, secret) =>
  SEC_RE.test(String(secret || "")) &&
  !!order.sh &&
  safeEq(sha(String(secret), "sha256"), order.sh);

const ip = (req) =>
  String(
    req.headers["x-real-ip"] ||
      (req.headers["x-forwarded-for"] || "").split(",")[0] ||
      req.socket?.remoteAddress ||
      "?",
  )
    .trim()
    .slice(0, 45);

// Permintaan yang mengubah data wajib datang dari halaman situs ini sendiri (anti CSRF)
const sameOrigin = (req) => {
  const sf = req.headers["sec-fetch-site"];
  if (sf && sf !== "same-origin") return false;
  try {
    return new URL(req.headers.origin).host === req.headers.host;
  } catch (e) {
    return false;
  }
};

// true kalau masih di bawah batas (max percobaan per `sec` detik)
const limit = async (key, max, sec) => (await kv("INCREX", key, sec)) <= max;

module.exports = {
  sha,
  safeEq,
  randomCode,
  ID_RE,
  newId,
  clean,
  newSecret,
  secOk,
  ip,
  sameOrigin,
  limit,
};
