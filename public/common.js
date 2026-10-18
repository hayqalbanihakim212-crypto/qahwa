/* Helper yang dipakai bersama oleh halaman pelanggan (app.js) dan admin (admin.js).
   Dimuat lebih dulu lewat <script src="/common.js">; semuanya global. */
const $ = (s) => document.querySelector(s);
const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

// Nama meja khusus untuk pesanan dibawa pulang (sama dengan TAKEAWAY di server)
const TAKE = "Bawa pulang";
const tl = (t) => (t == TAKE ? TAKE : "Meja " + t);

// Garis langkah pesanan; `done` = jumlah langkah yang sudah tercapai (0 sampai 4)
const STEP_LABELS = ["Dibayar", "Dibuat", "Siap", "Selesai"];
const stepsHtml = (done) =>
  `<ol class="steps">${STEP_LABELS.map((t, k) => `<li class="${done > k ? "on" : ""}">${t}</li>`).join("")}</ol>`;
