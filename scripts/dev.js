// Server uji lokal tanpa dependensi: node scripts/dev.js  ->  http://localhost:3000
const http = require("http"),
  fs = require("fs"),
  path = require("path");

/* Baca .env: tahan CRLF (Windows), BOM, spasi, tanda kutip, dan awalan "export" */
const envFile = path.join(__dirname, "../.env");
let envInfo = "";
try {
  const text = fs.readFileSync(envFile, "utf8").replace(/^\uFEFF/, "");
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const m = raw
      .trim()
      .match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || raw.trim().startsWith("#")) continue;
    let v = m[2].trim();
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (v && !(m[1] in process.env)) {
      process.env[m[1]] = v;
      n++;
    }
  }
  envInfo = ".env dibaca (" + n + " nilai terisi)";
} catch (e) {
  envInfo =
    "PERINGATAN: .env tidak ditemukan di " +
    envFile +
    " (salin dari .env.example)";
}

const root = path.join(__dirname, "../public"),
  types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };
const hdrs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"),
).headers[0].headers;
http
  .createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    hdrs.forEach((h) => res.setHeader(h.key, h.value));
    if (u.pathname.startsWith("/api/")) {
      const f = path.join(
        __dirname,
        "../api",
        path.basename(u.pathname) + ".js",
      );
      if (u.pathname.includes("_") || !fs.existsSync(f))
        return res.writeHead(404).end();
      let raw = "";
      for await (const c of req) raw += c;
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        req.body = {};
      }
      req.query = Object.fromEntries(u.searchParams);
      res.status = (c) => {
        res.statusCode = c;
        return res;
      };
      res.json = (o) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(o));
      };
      return require(f)(req, res);
    }
    let p = u.pathname === "/" ? "/index.html" : u.pathname;
    if (!path.extname(p)) p += ".html";
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root) || !fs.existsSync(file))
      return res.writeHead(404).end("404");
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  })
  .listen(process.env.PORT || 3000, () => {
    const port = process.env.PORT || 3000,
      L = require("../api/_lib");
    console.log("Qahwa: http://localhost:" + port + "  |  Admin: /admin");
    console.log(envInfo);
    console.log("Mode bayar : " + L.MODE);
    console.log(
      "Login admin: " +
        (L.authConfigured()
          ? "siap"
          : "BELUM DIATUR (isi ADMIN_PASSWORD atau ADMIN_PASSWORD_HASH di .env, simpan, lalu jalankan ulang server)"),
    );
  });
