/* Kerangka handler API: error HTTP lewat `throw`, satu try/catch untuk semua endpoint.

   module.exports = handle(async (req, res) => {
     allow(req, "GET", "POST");
     await requireAdmin(req);
     requireSameOrigin(req);        // untuk metode yang mengubah data
     throw new HttpError(409, "dupe");   // -> 409 {"error":"dupe"}
   });

   Opsi handle:
   - exposeDetail: sertakan pesan error di respons 500 (hanya untuk endpoint khusus admin)
   - text: balasan teks polos tanpa JSON (untuk webhook Midtrans) */
const { isAdmin } = require("./session");
const { sameOrigin, limit } = require("./security");

class HttpError extends Error {
  constructor(status, error, headers) {
    super(error || "HTTP " + status);
    this.status = status;
    this.error = error; // kosong = balasan tanpa isi
    this.headers = headers || {};
  }
}

const handle =
  (fn, { exposeDetail = false, text = false } = {}) =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof HttpError) {
        for (const [k, v] of Object.entries(e.headers)) res.setHeader(k, v);
        if (text) return e.error ? res.status(e.status).end(e.error) : res.status(e.status).end();
        return e.error
          ? res.status(e.status).json({ error: e.error })
          : res.status(e.status).end();
      }
      console.error(e.message);
      if (text) return res.status(500).end();
      res
        .status(500)
        .json(
          exposeDetail
            ? { error: "server", detail: String(e.message).slice(0, 160) }
            : { error: "server" },
        );
    }
  };

const allow = (req, ...methods) => {
  if (!methods.includes(req.method)) throw new HttpError(405);
};
const requireAdmin = async (req) => {
  if (!(await isAdmin(req))) throw new HttpError(401, "auth");
};
const requireSameOrigin = (req) => {
  if (!sameOrigin(req)) throw new HttpError(403, "origin");
};
const rateLimit = async (key, max, sec, headers) => {
  if (!(await limit(key, max, sec)))
    throw new HttpError(429, "too_many", headers);
};

module.exports = {
  HttpError,
  handle,
  allow,
  requireAdmin,
  requireSameOrigin,
  rateLimit,
};
