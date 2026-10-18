/* Helper bersama ($, rp, esc, TAKE, tl, stepsHtml) ada di common.js */
const hm = (t) =>
    new Date(t).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  dm = (t) =>
    new Date(t).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
/* Kategori yang dianggap makanan; kategori lain dianggap minuman. Sesuaikan dengan menu kamu. */
const FOOD_BASE = [
    "Nasi Goreng",
    "Nasi Goreng Kampung",
    "Nasi Goreng Ijo",
    "Nasi Goreng Pataya",
    "Snack",
    "Chicken Katsu",
    "Martabak",
    "Kue/Mie Tiaw",
    "Toom Yum",
    "Roti Canai",
    "Roti Bakar",
    "Burgers",
  ],
  FOOD = [...FOOD_BASE];
/* Kategori makanan buatan admin disimpan di server (stock.food) dan digabung ke daftar FOOD. */
const syncFood = () =>
  FOOD.splice(
    0,
    FOOD.length,
    ...FOOD_BASE,
    ...((stock && stock.food) || []).filter((c) => !FOOD_BASE.includes(c)),
  );
const NEXT = {
    paid: ["making", "Mulai buat"],
    making: ["ready", "Pesanan siap"],
    ready: ["done", "Selesaikan"],
  },
  LBL = {
    pending: "Menunggu bayar",
    paid: "Dibayar",
    making: "Dibuat",
    ready: "Siap",
    done: "Selesai",
    failed: "Gagal",
  },
  PAID = ["paid", "making", "ready", "done"],
  RNG = { today: "Hari ini", 7: "7 hari", 30: "30 hari", all: "Semua" },
  MODE_TXT = {
    mock: "MODE SIMULASI: pesanan berasal dari pembayaran palsu",
    sandbox: "MODE UJI MIDTRANS: tidak ada uang sungguhan",
  },
  num = (v) => Number(v) || 0;
const RANGE_DAYS = { today: 0, 7: 6, 30: 29 }; // rentang Statistik: berapa hari ke belakang dari hari ini
let orders = [], // gabungan antrian langsung + arsip (untuk statistik, riwayat, pendapatan)
  live = [], // 100 pesanan terbaru dari server, diperbarui tiap 5 detik
  arch = [], // arsip permanen dari tabel orders
  archKey = "",
  archAt = 0,
  seen = null,
  timer = null,
  mode = "",
  tab = ["#meja", "#stat", "#hist", "#stok"].includes(location.hash)
    ? location.hash.slice(1)
    : "queue",
  tables = null,
  base = "",
  rng = "today",
  qf = "all",
  hq = "",
  hs = "paidall",
  open = new Set(),
  stock = null,
  sq = "",
  sf = "all",
  lastOk = 0,
  failed = false,
  nf = { n: "", c: "", p: "", j: "drink", t: "one", h: "", d: "", f: "" },
  ef = null, // menu yang sedang diubah: { id, t, p, h, d, f }
  printChain = Promise.resolve();
try {
  base = localStorage.getItem("qahwa_qr_base") || "";
} catch (e) {}
/* Sesi ada di cookie HttpOnly dari server; halaman ini tidak menyimpan password atau token apa pun. */
async function api(method, body, url = "/api/admin") {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if ([401, 429, 503].includes(r.status)) throw r.status;
  return r.json();
}
function beep() {
  try {
    const a = new AudioContext(),
      o = a.createOscillator();
    o.connect(a.destination);
    o.frequency.value = 880;
    o.start();
    o.stop(a.currentTime + 0.25);
  } catch (e) {}
}
function loginV(m) {
  clearInterval(timer);
  $("#out").hidden = true;
  $("#tabs").hidden = true;
  $("#mode").hidden = true;
  tables = null;
  $("#app").innerHTML =
    `<h2>Masuk admin</h2><p class="muted">Halaman ini khusus pemilik dan staf.</p>${m ? `<div class="alert" role="alert">${esc(m)}</div>` : ""}<label>Password<input id="pw" type="password" autocomplete="current-password" maxlength="200"></label><button class="btn" id="go">Masuk</button>`;
}

// 401 dari server = sesi habis: tampilkan layar masuk. Mengembalikan true kalau itu yang terjadi.
function sessionLost(e) {
  if (e !== 401) return false;
  loginV("Sesi berakhir. Silakan masuk lagi.");
  return true;
}
// pembuat fungsi pesan sukses/gagal di elemen dengan id tertentu
const flash = (sel) => (t, bad) => {
  const e = $(sel);
  if (e)
    e.innerHTML = `<div class="${bad ? "alert" : "okmsg"}" role="status">${esc(t)}</div>`;
};

/* ---------- Hitung data: semua angka dihitung ulang dari daftar pesanan terbaru ---------- */
const startOf = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};
const inRange = (o, r) =>
  r == "all" ||
  num(o.ts) >=
    startOf(Date.now()) - (RANGE_DAYS[r] || 0) * 864e5;
const paidIn = (r) =>
  orders.filter((o) => PAID.includes(o.status) && inRange(o, r));
const sum = (l) => l.reduce((s, o) => s + num(o.total), 0);
const mins = (o) => Math.max(0, Math.floor((Date.now() - num(o.ts)) / 6e4));
const units = (l) =>
  l.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + num(i.q), 0), 0);
const sub = (t) => `<span class="sub">${t}</span>`;
const stat = (l, v, s) =>
  `<div class="card"><span class="muted">${l}</span><b>${v}</b>${s ? sub(s) : ""}</div>`;
const pills = (attr, map, cur) =>
  `<div class="pills no">${Object.entries(map)
    .map(
      ([k, v]) =>
        `<button ${attr}="${k}" class="${k == cur ? "on" : ""}">${v}</button>`,
    )
    .join("")}</div>`;
function rank(rows, fmt) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return rows.length
    ? rows
        .map(
          (r) =>
            `<div class="rk"><span>${esc(r[0])}</span><b>${fmt(r[1])}</b><div class="bg"><i style="width:${(r[1] / mx) * 100}%"></i></div></div>`,
        )
        .join("")
    : '<p class="muted">Belum ada data.</p>';
}

/* ---------- Tab Antrian ---------- */
function queueV() {
  const act = live.filter((o) => NEXT[o.status]).sort((a, b) => a.ts - b.ts),
    td = paidIn("today"),
    show = act.filter((o) => qf == "all" || o.status == qf),
    cnt = (s) => act.filter((o) => o.status == s).length;
  $("#app").innerHTML =
    `<div class="stats s4">${stat("Pendapatan hari ini", rp(sum(td)))}${stat("Item dibayar hari ini", units(td), td.length + " transaksi, " + live.length + " pesanan dimuat")}${stat("Menunggu bayar", live.filter((o) => o.status == "pending").length)}${stat("Rata-rata pesanan", rp(td.length ? sum(td) / td.length : 0))}</div>
<h2>Antrian dapur</h2>${pills("data-f", { all: "Semua " + act.length, paid: "Dibayar " + cnt("paid"), making: "Dibuat " + cnt("making"), ready: "Siap " + cnt("ready") }, qf)}` +
    (show.length
      ? show
          .map((o) => {
            const m = mins(o),
              late = o.status == "paid" && m >= 10;
            return `<div class="card${late ? " late" : ""}"><div class="split"><b class="tbl">${esc(tl(o.table))}</b><span class="chip ${o.status}">${LBL[o.status]}</span></div><div class="muted">${esc(o.id)}, ${esc(o.name)}, ${hm(o.ts)} <span class="age">(${m} mnt)</span></div><div>${(o.items || []).map((i) => i.q + "× " + vName(i)).join("<br>")}</div>${o.note ? `<div class="muted">Catatan: ${esc(o.note)}</div>` : ""}<div class="split"><b>${rp(o.total)}</b><span class="acts no"><button class="btn ghost sm" data-pr="${esc(o.id)}">Cetak</button><button class="btn sm" data-id="${esc(o.id)}" data-s="${NEXT[o.status][0]}">${NEXT[o.status][1]}</button></span></div></div>`;
          })
          .join("")
      : `<p class="muted">Tidak ada pesanan di antrian ini.</p>`);
}
function note() {
  // bunyi saat ada pesanan baru dibayar, dan jumlah antrian di tab
  const ids = new Set(live.filter((o) => o.status == "paid").map((o) => o.id));
  if (seen && [...ids].some((i) => !seen.has(i))) beep();
  seen = ids;
  const n = live.filter((o) => NEXT[o.status]).length;
  $("#t-queue").textContent = "Antrian" + (n ? " (" + n + ")" : "");
}

/* ---------- Tab Statistik ---------- */
function statV() {
  const l = paidIn(rng),
    rev = sum(l),
    items = {},
    tbs = {},
    vc = {};
  l.forEach((o) => {
    tbs[tl(o.table)] = (tbs[tl(o.table)] || 0) + 1;
    (o.items || []).forEach((i) => {
      if (i.v) vc[i.v] = (vc[i.v] || 0) + num(i.q);
      items[i.n] = items[i.n] || [0, 0];
      items[i.n][0] += num(i.q);
      items[i.n][1] += num(i.q) * num(i.p);
    });
  });
  const top = Object.entries(items)
      .sort((a, b) => b[1][0] - a[1][0])
      .slice(0, 6),
    tb = Object.entries(tbs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  // grafik: per jam untuk hari ini, per hari untuk rentang lain
  let bars, lab;
  if (rng == "today") {
    bars = Array(24).fill(0);
    l.forEach((o) => (bars[new Date(o.ts).getHours()] += num(o.total)));
    lab = ["00:00", "12:00", "23:00"];
  } else {
    const d = rng == "7" ? 7 : 30,
      s0 = startOf(Date.now()) - (d - 1) * 864e5;
    bars = Array(d).fill(0);
    l.forEach((o) => {
      const k = Math.floor((startOf(o.ts) - s0) / 864e5);
      if (k >= 0 && k < d) bars[k] += num(o.total);
    });
    lab = [
      dm(s0),
      dm(s0 + (((d - 1) / 2) | 0) * 864e5),
      dm(s0 + (d - 1) * 864e5),
    ];
  }
  const mx = Math.max(1, ...bars),
    peak = bars.indexOf(Math.max(...bars));
  $("#app").innerHTML = `<h2>Statistik</h2>${pills("data-r", RNG, rng)}
<div class="stats s4">${stat("Pendapatan", rp(rev))}${stat("Item terjual", units(l), l.length + " transaksi")}${stat("Rata-rata pesanan", rp(l.length ? rev / l.length : 0))}${stat("Transaksi", l.length)}</div>
<div class="card"><b>Pendapatan ${rng == "today" ? "per jam" : "per hari"}</b>${rev ? sub(rng == "today" ? "Jam tersibuk: " + String(peak).padStart(2, "0") + ":00" : "Hari terbaik: " + rp(mx)) : ""}<div class="bars" role="img" aria-label="Grafik pendapatan">${bars.map((v, i) => `<i class="${v ? "" : "z"}" style="height:${(v / mx) * 100}%" title="${rp(v)}"></i>`).join("")}</div><div class="axis">${lab.map((x) => `<span>${x}</span>`).join("")}</div></div>
<div class="card"><b>Menu terlaris</b>${rank(
    top.map(([n, v]) => [n, v[0]]),
    (v) => v + "×",
  )}</div>
<div class="card"><b>Panas, Dingin, Float</b>${rank(
    Object.entries(vc).sort((a, b) => b[1] - a[1]),
    (v) => v + "×",
  )}</div>
<div class="card"><b>Meja paling aktif</b>${rank(tb, (v) => v + " pesanan")}</div>`;
}

/* ---------- Tab Riwayat: cari, saring, ekspor ---------- */
function histV() {
  $("#app").innerHTML =
    `<h2>Riwayat pesanan</h2><div class="toolbar no"><label>Cari<input id="hq" value="${esc(hq)}" placeholder="Nama, nomor pesanan, atau meja" autocomplete="off"></label><label>Status<select id="hs">${["paidall", "all", ...Object.keys(LBL)].map((k) => `<option value="${k}"${k == hs ? " selected" : ""}>${k == "all" ? "Semua status" : k == "paidall" ? "Sudah dibayar" : LBL[k]}</option>`).join("")}</select></label><button class="btn ghost" id="pdf">Ekspor PDF</button></div><div id="hl"></div>`;
  histList();
}
const histRows = () =>
  orders
    .filter(
      (o) =>
        hs == "all" ||
        (hs == "paidall" ? PAID.includes(o.status) : o.status == hs),
    )
    .filter(
      (o) =>
        !hq ||
        [o.id, o.name, tl(o.table)].some((x) =>
          String(x || "")
            .toLowerCase()
            .includes(hq.toLowerCase()),
        ),
    )
    .sort((a, b) => b.ts - a.ts);
function detail(o) {
  const k = PAID.indexOf(o.status),
    it = o.items || [];
  return `<div class="dt"><div class="meta"><span>Nomor</span><b>${esc(o.id)}</b><span>Pemesan</span><b>${esc(o.name || "-")}</b><span>Tempat</span><b>${esc(tl(o.table))}</b><span>Waktu</span><b>${new Date(o.ts).toLocaleString("id-ID")}</b>${o.note ? `<span>Catatan</span><b>${esc(o.note)}</b>` : ""}</div>${it.map((i) => `<div class="row"><span>${num(i.q)}× ${esc(i.n)}${num(i.p) ? ` <span class="muted">@ ${rp(i.p)}</span>` : ""}</span><b>${num(i.p) ? rp(num(i.q) * num(i.p)) : ""}</b></div>`).join("")}<div class="row"><b>Total (${units([o])} item)</b><b>${rp(o.total)}</b></div>${k >= 0 ? stepsHtml(k + 1) : ""}<button class="btn ghost sm no" data-pr="${esc(o.id)}">Cetak struk</button></div>`;
}
function histList() {
  const el = $("#hl");
  if (!el) return;
  const all = histRows(),
    l = all.slice(0, 100);
  let day = "";
  el.innerHTML = l.length
    ? `<p class="muted">${all.length} transaksi, ${units(all)} item, ${rp(sum(all.filter((o) => PAID.includes(o.status))))} dibayar. Ketuk pesanan untuk melihat detail.</p>` +
      l
        .map((o) => {
          const d = startOf(o.ts);
          let h = "";
          if (d != day) {
            day = d;
            const g = all.filter((x) => startOf(x.ts) == d);
            h = `<h3 class="dh">${new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}<span class="muted"> ${g.length} transaksi, ${units(g)} item, ${rp(sum(g.filter((x) => PAID.includes(x.status))))}</span></h3>`;
          }
          return `${h}<details class="card hd" data-o="${esc(o.id)}"${open.has(o.id) ? " open" : ""}><summary class="hrow"><b>${esc(tl(o.table))}</b><span class="muted">${esc(o.name)}, ${hm(o.ts)}<br>${units([o])} item</span><span><span class="chip ${o.status}">${LBL[o.status] || esc(o.status)}</span> <b>${rp(o.total)}</b></span></summary>${detail(o)}</details>`;
        })
        .join("") +
      (all.length > 100
        ? '<p class="muted">Menampilkan 100 terbaru. Persempit pencarian atau ekspor CSV.</p>'
        : "")
    : '<p class="muted">Tidak ada pesanan yang cocok.</p>';
}
/* ---------- Ekspor PDF riwayat (jsPDF dimuat hanya saat tombol ditekan) ---------- */
const loadJs = (src) =>
  new Promise((ok, no) => {
    if (document.querySelector('script[src="' + src + '"]')) return ok();
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => {
      s.remove();
      no(new Error(src));
    };
    document.head.appendChild(s);
  });
async function exportPdf() {
  const b = $("#pdf"),
    label = b.textContent;
  b.disabled = true;
  b.textContent = "Membuat PDF...";
  try {
    await loadJs("/vendor/jspdf.umd.min.js");
    await loadJs("/vendor/jspdf.plugin.autotable.min.js");
    const rows = histRows(),
      paid = rows.filter((o) => PAID.includes(o.status)),
      doc = new window.jspdf.jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      }),
      st =
        hs == "all"
          ? "Semua status"
          : hs == "paidall"
            ? "Sudah dibayar"
            : LBL[hs];
    doc.setFontSize(16);
    doc.text("Riwayat Pesanan Qahwa", 40, 40);
    doc.setFontSize(9);
    doc.text(
      "Dicetak " +
        new Date().toLocaleString("id-ID") +
        "  |  Status: " +
        st +
        (hq ? "  |  Cari: " + hq : ""),
      40,
      56,
    );
    doc.text(
      rows.length +
        " pesanan, " +
        units(rows) +
        " item, " +
        rp(sum(paid)) +
        " dibayar",
      40,
      70,
    );
    doc.autoTable({
      startY: 84,
      head: [
        ["Waktu", "ID", "Nama", "Meja", "Status", "Item", "Catatan", "Total"],
      ],
      body: rows.map((o) => [
        new Date(o.ts).toLocaleString("id-ID"),
        o.id,
        o.name || "-",
        tl(o.table),
        LBL[o.status] || o.status,
        (o.items || []).map((i) => i.q + "x " + i.n).join(", "),
        o.note || "",
        rp(o.total),
      ]),
      foot: [["", "", "", "", "", "", "Total dibayar", rp(sum(paid))]],
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [233, 166, 59], textColor: 20 },
      footStyles: { fillColor: [240, 240, 240], textColor: 20 },
      columnStyles: { 5: { cellWidth: 190 }, 7: { halign: "right" } },
      showFoot: "lastPage",
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.text(
          "Halaman " + doc.internal.getNumberOfPages(),
          doc.internal.pageSize.getWidth() - 80,
          doc.internal.pageSize.getHeight() - 20,
        );
      },
    });
    doc.save("qahwa-pesanan-" + new Date().toLocaleDateString("sv") + ".pdf");
  } catch (e) {
    alert(
      "Gagal membuat PDF (" +
        String((e && e.message) || e).slice(0, 80) +
        "). Pastikan file vendor/jspdf.umd.min.js dan vendor/jspdf.plugin.autotable.min.js ada di server.",
    );
  }
  b.disabled = false;
  b.textContent = label;
}

/* ---------- Cetak struk / tiket dapur (kertas thermal 80mm) ---------- */
const RCPT_CSS =
  '@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{width:72mm;margin:4mm;font:12px/1.35 "Courier New",monospace;color:#000}h1{font-size:18px;text-align:center;margin:0}.c{text-align:center}.t{font-size:24px;font-weight:700;text-align:center;margin:6px 0}hr{border:0;border-top:1px dashed #000;margin:6px 0}.r{display:flex;justify-content:space-between;gap:8px}.b{font-weight:700}.r span:last-child{white-space:nowrap}';
function receiptHtml(o) {
  const items = (o.items || [])
    .map(
      (i) =>
        `<div class="r"><span>${num(i.q)}x ${esc(i.n)}</span><span>${rp(num(i.q) * num(i.p))}</span></div>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.id)}</title><style>${RCPT_CSS}</style></head><body>
<h1>QAHWA</h1><div class="c">est 2019</div><hr>
<div class="t">${esc(tl(o.table))}</div>
<div class="r"><span>No</span><span>${esc(o.id)}</span></div>
<div class="r"><span>Nama</span><span>${esc(o.name || "-")}</span></div>
<div class="r"><span>Waktu</span><span>${new Date(o.ts).toLocaleString("id-ID")}</span></div><hr>
${items}<hr>
<div class="r b"><span>TOTAL</span><span>${rp(o.total)}</span></div>
<div class="c">${PAID.includes(o.status) ? "LUNAS (QRIS)" : "BELUM DIBAYAR"}${mode == "mock" ? "<br>MODE SIMULASI" : ""}</div>
${o.note ? `<hr><div>Catatan: ${esc(o.note)}</div>` : ""}<hr><div class="c">Terima kasih</div></body></html>`;
}
// cetak satu per satu lewat antrian, supaya beberapa pesanan sekaligus tidak saling menimpa
function printReceipt(o) {
  return (printChain = printChain.then(
    () =>
      new Promise((ok) => {
        const f = document.createElement("iframe");
        f.style.cssText =
          "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
        f.onload = () => {
          try {
            f.contentWindow.focus();
            f.contentWindow.print();
          } catch (e) {}
          setTimeout(() => {
            f.remove();
            ok();
          }, 800);
        };
        f.srcdoc = receiptHtml(o);
        document.body.appendChild(f);
      }),
  ));
}

/* ---------- Varian Panas / Dingin / Float ---------- */
const VT = {
  one: "Satu harga",
  hd: "Panas & Dingin",
  hdf: "Panas, Dingin & Float",
};
// nama dasar tanpa akhiran " (Panas)" yang ditambahkan server pada item pesanan bervarian
const vBase = (i) =>
  i.v ? String(i.n).replace(new RegExp("\\s*\\(" + i.v + "\\)$"), "") : i.n;
// nama item + penanda varian berwarna (dipakai di antrian dapur)
const vName = (i) =>
  esc(vBase(i)) +
  (i.v
    ? ` <span class="chip v-${esc(String(i.v).toLowerCase())}">${esc(i.v)}</span>`
    : "");
const vList = (s) =>
  s.t == "one"
    ? null
    : [
        { k: "Panas", p: Math.round(Number(s.h)) },
        { k: "Dingin", p: Math.round(Number(s.d)) },
        ...(s.t == "hdf" ? [{ k: "Float", p: Math.round(Number(s.f)) }] : []),
      ];
const vOk = (v) => v.every((z) => z.p >= 1 && z.p <= 1e6);
// kolom harga: satu harga atau per varian. a = awalan id ("a" tambah, "e" ubah)
const priceBox = (s, a) =>
  `<label>Jenis harga<select id="${a}t">${Object.entries(VT)
    .map(
      ([k, v]) =>
        `<option value="${k}"${k == s.t ? " selected" : ""}>${v}</option>`,
    )
    .join("")}</select></label>` +
  (s.t == "one"
    ? `<label>Harga (Rp${a == "a" ? ', isi 0 untuk "Segera"' : ""})<input id="${a}p" type="number" min="0" max="1000000" inputmode="numeric" value="${esc(s.p)}" placeholder="20000"></label>`
    : `<div class="vgrid"><label>Panas (Rp)<input id="${a}h" type="number" min="1" max="1000000" inputmode="numeric" value="${esc(s.h)}" placeholder="17000"></label><label>Dingin (Rp)<input id="${a}d" type="number" min="1" max="1000000" inputmode="numeric" value="${esc(s.d)}" placeholder="20000"></label>${s.t == "hdf" ? `<label>Float (Rp)<input id="${a}f" type="number" min="1" max="1000000" inputmode="numeric" value="${esc(s.f)}" placeholder="25000"></label>` : ""}</div>`);
const fromItem = (m) => {
  const g = (k) => ((m.v || []).find((z) => z.k == k) || {}).p;
  return {
    id: m.id,
    t: m.v ? (g("Float") ? "hdf" : "hd") : "one",
    p: m.v ? "" : String(m.p || 0),
    h: g("Panas") ?? "",
    d: g("Dingin") ?? "",
    f: g("Float") ?? "",
  };
};
const priceTxt = (m) =>
  m.v
    ? m.v.map((z) => `${z.k} ${rp(z.p)}`).join(" · ")
    : m.p > 0
      ? rp(m.p)
      : "Segera";

/* ---------- Tab Stok: menu habis, tutup kategori, tutup semua makanan atau minuman ---------- */
async function loadStock() {
  try {
    const r = await fetch("/api/stock");
    if (r.status == 401) throw 401;
    let j = null;
    try {
      j = await r.json();
    } catch (x) {}
    if (!r.ok || !j || !Array.isArray(j.menu))
      throw (
        "HTTP " +
        r.status +
        (j && j.error ? ", " + j.error : "") +
        (j && j.detail ? ": " + j.detail : "")
      );
    stock = j;
    syncFood();
  } catch (e) {
    if (sessionLost(e)) return;
    stock = { menu: [], closed: [], err: String((e && e.message) || e || "?") };
  }
  if (tab == "stok") stokV();
}
const closedSet = () => new Set(stock.closed || []);
function stokV() {
  if (!stock) {
    $("#app").innerHTML = '<p class="muted">Memuat...</p>';
    return loadStock();
  }
  if (stock.err)
    return ($("#app").innerHTML =
      `<h2>Stok</h2><div class="alert" role="alert">Data stok tidak bisa dimuat (${esc(stock.err)}).<br>${/404|405/.test(stock.err) ? "Endpoint /api/stock belum terdaftar di server. Pastikan api/stock.js sudah ada dan server sudah dijalankan ulang atau di-deploy ulang." : /500/.test(stock.err) ? "Server menemukan error. Cek log server dan koneksi Supabase." : "Periksa koneksi dan server, lalu coba lagi."}</div><button class="btn" id="srt">Coba lagi</button>`);
  const cl = closedSet(),
    cats = [...new Set(stock.menu.map((m) => m.c))],
    off = stock.menu.filter((m) => m.off).length,
    grp = (k, nm, cs) => {
      const c = cs.length && cs.every((x) => cl.has(x));
      return `<div class="card"><div class="split"><b>${nm}</b><span class="chip ${c ? "" : "ready"}">${c ? "Ditutup" : "Buka"}</span></div><button class="btn ghost sm" data-grp="${k}" data-cl="${c ? 0 : 1}"${cs.length ? "" : " disabled"}>${c ? "Buka semua " + nm.toLowerCase() : "Tutup semua " + nm.toLowerCase()}</button></div>`;
    };
  $("#app").innerHTML =
    `<h2>Stok &amp; buka tutup</h2><p class="muted">Menu habis atau kategori ditutup langsung hilang dari tombol pesan pelanggan.</p>
<div class="stats">${stat("Tersedia", stock.menu.length - off)}${stat("Habis", off)}${stat("Kategori ditutup", cl.size)}</div>
${grp(
  "food",
  "Makanan",
  cats.filter((c) => FOOD.includes(c)),
)}${grp(
      "drink",
      "Minuman",
      cats.filter((c) => !FOOD.includes(c)),
    )}
<h2>Tambah menu baru</h2>
<div class="card"><label>Nama menu<input id="an" maxlength="60" value="${esc(nf.n)}" placeholder="Contoh: Kopi Susu Gula Aren" autocomplete="off"></label>
<label>Kategori<input id="ac" list="cl" maxlength="30" value="${esc(nf.c)}" placeholder="Pilih atau ketik kategori baru" autocomplete="off"></label><datalist id="cl">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
<label>Jenis (dipakai untuk kategori baru)<select id="aj"><option value="drink"${nf.j == "drink" ? " selected" : ""}>Minuman</option><option value="food"${nf.j == "food" ? " selected" : ""}>Makanan</option></select></label>
${priceBox(nf, "a")}
<button class="btn" id="addm">Tambah menu</button><div id="smsg"></div></div>
<h2>Daftar menu</h2>
<label>Cari menu<input id="sq" value="${esc(sq)}" placeholder="Nama menu" autocomplete="off"></label>${pills("data-sf", { all: "Semua", ok: "Tersedia", off: "Habis" }, sf)}<div id="sl"></div>`;
  sList();
}
const smsg = flash("#smsg");
async function addMenu() {
  const n = nf.n.trim().replace(/\s+/g, " "),
    c = nf.c.trim().replace(/\s+/g, " "),
    v = vList(nf),
    p = Math.round(Number(nf.p === "" ? NaN : nf.p));
  if (!n) return smsg("Nama menu wajib diisi.", 1);
  if (!c) return smsg("Kategori wajib diisi.", 1);
  if (v ? !vOk(v) : !(p >= 0 && p <= 1e6))
    return smsg(
      v
        ? "Harga tiap varian harus angka 1 sampai 1.000.000."
        : "Harga harus angka 0 sampai 1.000.000.",
      1,
    );
  const dupe = stock.menu.some(
    (m) =>
      m.c.toLowerCase() == c.toLowerCase() &&
      m.n.toLowerCase() == n.toLowerCase(),
  );
  if (dupe)
    return smsg("Menu dengan nama itu sudah ada di kategori tersebut.", 1);
  const b = $("#addm");
  b.disabled = true;
  try {
    const j = await api(
      "POST",
      { action: "add", n, c, food: nf.j == "food", ...(v ? { v } : { p }) },
      "/api/stock",
    );
    if (!Array.isArray(j.menu)) throw 0;
    stock = { ...stock, ...j };
    syncFood();
    nf = { n: "", c: "", p: "", j: nf.j, t: "one", h: "", d: "", f: "" };
    stokV();
    smsg('Menu "' + n + '" ditambahkan ke ' + c + ".");
  } catch (e) {
    if (sessionLost(e)) return;
    b.disabled = false;
    smsg("Gagal menambah menu. Coba lagi.", 1);
  }
}
async function saveEdit() {
  const m = ef && stock.menu.find((x) => x.id == ef.id);
  if (!m) return;
  const v = vList(ef),
    p = Math.round(Number(ef.p === "" ? NaN : ef.p));
  if (v ? !vOk(v) : !(p >= 0 && p <= 1e6))
    return alert(
      v
        ? "Harga tiap varian harus angka 1 sampai 1.000.000."
        : "Harga harus angka 0 sampai 1.000.000.",
    );
  try {
    const j = await api(
      "POST",
      { action: "edit", id: m.id, ...(v ? { v } : { p }) },
      "/api/stock",
    );
    if (!Array.isArray(j.menu)) throw 0;
    stock = { ...stock, ...j };
    ef = null;
    stokV();
    smsg('Harga "' + m.n + '" disimpan.');
  } catch (e) {
    if (sessionLost(e)) return;
    alert("Gagal menyimpan harga. Coba lagi.");
  }
}
async function delMenu(id) {
  const m = stock.menu.find((x) => x.id == id);
  if (!m) return;
  if (
    !confirm(
      'Hapus menu "' +
        m.n +
        '" secara permanen? Riwayat pesanan lama tetap tersimpan.',
    )
  )
    return;
  try {
    const j = await api("POST", { action: "del", id }, "/api/stock");
    if (!Array.isArray(j.menu)) throw 0;
    stock = { ...stock, ...j };
    syncFood();
    stokV();
    smsg('Menu "' + m.n + '" dihapus.');
  } catch (e) {
    if (sessionLost(e)) return;
    stock = null;
    stokV();
    alert("Gagal menghapus menu. Data dimuat ulang.");
  }
}
function sList() {
  const el = $("#sl");
  if (!el) return;
  const cl = closedSet(),
    q = sq.toLowerCase(),
    anyOff = (m) => !!m.off || (m.v || []).some((z) => z.off),
    ok = (m) =>
      (sf == "all" || (sf == "off") == anyOff(m)) &&
      (!q || m.n.toLowerCase().includes(q)),
    cats = [...new Set(stock.menu.map((m) => m.c))],
    acts = (m) =>
      `<button class="del" data-ed="${m.id}" aria-label="Ubah harga ${esc(m.n)}">${ef && ef.id == m.id ? "Tutup" : "Ubah"}</button><button class="del" data-del="${m.id}" aria-label="Hapus ${esc(m.n)}">Hapus</button>`,
    editBox = (m) =>
      ef && ef.id == m.id
        ? `<div class="ebox">${priceBox(ef, "e")}<div class="acts"><button class="btn sm" id="edsave">Simpan harga</button><button class="btn ghost sm" id="edcancel">Batal</button></div></div>`
        : "",
    row = (m, x) =>
      m.v
        ? `<div class="vgrp${m.off || x ? " offr" : ""}"><div class="split"><b>${esc(m.n)}</b><span class="acts">${acts(m)}</span></div>${m.v
            .map(
              (z) =>
                `<div class="srow${z.off || x ? " offr" : ""}"><span>${esc(z.k)} <span class="muted">${rp(z.p)}</span></span><button class="tg${z.off ? "" : " on"}" data-st="${m.id}" data-k="${esc(z.k)}" data-off="${z.off ? 0 : 1}" aria-pressed="${!z.off}">${z.off ? "Habis" : "Tersedia"}</button></div>`,
            )
            .join("")}${editBox(m)}</div>`
        : `<div class="srow${m.off || x ? " offr" : ""}"><span>${esc(m.n)} <span class="muted">${priceTxt(m)}</span></span><button class="tg${m.off ? "" : " on"}" data-st="${m.id}" data-off="${m.off ? 0 : 1}" aria-pressed="${!m.off}">${m.off ? "Habis" : "Tersedia"}</button>${acts(m)}</div>${editBox(m)}`;
  el.innerHTML =
    cats
      .map((c) => {
        const l = stock.menu.filter((m) => m.c == c && ok(m)),
          x = cl.has(c);
        return l.length || (!q && sf == "all")
          ? `<div class="split"><h3 class="dh">${esc(c)}${x ? ' <span class="chip">Ditutup</span>' : ""}</h3><button class="btn ghost sm" data-cat="${esc(c)}" data-cl="${x ? 0 : 1}">${x ? "Buka kategori" : "Tutup kategori"}</button></div><div class="card">${l.map((m) => row(m, x)).join("") || '<p class="muted">Tidak ada menu.</p>'}</div>`
          : "";
      })
      .join("") || '<p class="muted">Tidak ada menu yang cocok.</p>';
}
async function setStock(body) {
  const cl = closedSet();
  if (body.cats)
    body.cats.forEach((c) => (body.closed ? cl.add(c) : cl.delete(c)));
  if (body.id != null)
    stock.menu.forEach((m) => {
      if (m.id != body.id) return;
      if (body.k) {
        (m.v || []).forEach((z) => {
          if (z.k == body.k) body.off ? (z.off = true) : delete z.off;
        });
        m.off = (m.v || []).every((z) => z.off);
      } else m.off = !!body.off;
    });
  stock.closed = [...cl];
  stokV();
  try {
    await api("POST", body, "/api/stock");
  } catch (e) {
    if (sessionLost(e)) return;
    stock = null;
    stokV();
    alert("Gagal menyimpan stok. Data dimuat ulang.");
  }
}
function render() {
  if (tab == "stok") return;
  if (tab == "queue") queueV();
  else if (tab == "stat") statV();
  else if (tab == "hist") $("#hl") ? histList() : histV();
}
/* Arsip permanen: antrian langsung hanya memuat 100 pesanan terbaru, jadi Statistik dan Riwayat
   mengambil sisanya dari tabel orders (maks 5000 pesanan, diperbarui paling cepat tiap 90 detik). */
const mergeOrders = () => {
  const m = new Map(arch.map((o) => [o.id, o]));
  live.forEach((o) => m.set(o.id, o)); // data langsung lebih baru daripada arsip
  return [...m.values()];
};
const archSince = () =>
  tab == "hist" || (tab == "stat" && rng == "all")
    ? 0
    : startOf(Date.now()) -
      (RANGE_DAYS[tab == "stat" ? rng : "today"] || 0) * 864e5;
async function loadArch() {
  if (!["queue", "stat", "hist"].includes(tab)) return;
  const key = String(archSince());
  if (key == archKey && Date.now() - archAt < 9e4) return;
  archKey = key;
  archAt = Date.now();
  try {
    const j = await api("GET", null, "/api/admin?hist=1&since=" + key);
    if (Array.isArray(j.orders)) {
      arch = j.orders;
      orders = mergeOrders();
      render();
    } else archAt = Date.now() - 6e4;
  } catch (e) {
    if (sessionLost(e)) return;
    archAt = Date.now() - 6e4; // gagal: coba lagi sekitar 30 detik kemudian
  }
}
async function load() {
  try {
    const j = await api("GET");
    live = Array.isArray(j.orders) ? j.orders : [];
    orders = mergeOrders();
    lastOk = Date.now();
    failed = false;
    if (j.mode != mode) {
      mode = j.mode;
      $("#mode").textContent = MODE_TXT[mode] || "";
      $("#mode").hidden = !MODE_TXT[mode];
    }
    note();
    render();
    loadArch();
  } catch (e) {
    if (sessionLost(e)) return;
    failed = true;
    $("#mode").textContent =
      "Koneksi terputus. Data mungkin tidak terbaru, mencoba lagi...";
    $("#mode").hidden = false;
  }
}

/* ---------- Tab Meja & QR: pemilik menentukan jumlah meja, tiap meja dapat QR sendiri ---------- */
async function loadTables() {
  try {
    tables = (await api("GET", null, "/api/table")).tables || [];
  } catch (e) {
    if (sessionLost(e)) return;
    tables = [];
  }
  if (tab == "meja") mejaV();
}
function mejaV() {
  if (tables === null) {
    $("#app").innerHTML = '<p class="muted">Memuat...</p>';
    return loadTables();
  }
  const n = tables.filter((x) => x.t != TAKE).length,
    tk = tables.some((x) => x.t == TAKE);
  $("#app").innerHTML =
    `<h2 class="no">Meja &amp; QR</h2><p class="muted no">Atur jumlah meja. Setiap meja punya QR sendiri. Pelanggan yang scan langsung tahu mejanya dan disambut "Selamat datang, pelanggan Meja N", tanpa memilih meja.</p>
  <div class="card no"><label>Jumlah meja (1 sampai 60)<input id="cnt" type="number" min="1" max="60" inputmode="numeric" value="${n || 10}"></label>
  <label class="chk"><input type="checkbox" id="tk" ${tk ? "checked" : ""}>Sediakan QR "Bawa pulang"</label>
  <label>Alamat situs di dalam QR<input id="base" value="${esc(base || location.origin)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
  <p class="muted">Di komputer sendiri, ganti dengan alamat jaringan agar QR bisa dibuka dari HP, contoh http://192.168.1.5:3000</p>
  <button class="btn" id="svt">${tables.length ? "Simpan perubahan" : "Buat meja"}</button>${tables.length ? `<button class="btn ghost" id="prt">Cetak QR</button>` : ""}</div>
  <div id="qmsg" class="no"></div><div class="qrs" id="qg"></div>`;
  drawQR();
}
function drawQR() {
  const g = $("#qg");
  if (!g) return;
  if (!tables.length) {
    g.innerHTML =
      '<p class="muted">Belum ada meja. Isi jumlah meja lalu tekan "Buat meja".</p>';
    return;
  }
  let b;
  try {
    const u = new URL(($("#base").value || "").trim());
    if (!/^https?:$/.test(u.protocol)) throw 0;
    b = u.origin;
  } catch (e) {
    g.innerHTML =
      '<div class="alert no" role="alert">Alamat situs tidak valid. Contoh: https://qahwa.vercel.app</div>';
    return;
  }
  g.innerHTML = tables
    .map((x) => {
      const q = qrcode(0, "M");
      q.addData(b + "/?m=" + x.k);
      q.make();
      return `<div class="card"><div class="qr">${q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div><h2>${esc(tl(x.t))}</h2><small class="muted">Qahwa: scan untuk pesan</small></div>`;
    })
    .join("");
}
const qmsg = flash("#qmsg");
async function saveTables() {
  const n = Math.floor(+$("#cnt").value),
    tk = $("#tk").checked;
  if (!(n >= 1 && n <= 60))
    return qmsg("Jumlah meja harus antara 1 dan 60.", 1);
  const gone =
    tables.filter((x) => x.t != TAKE && +x.t > n).length +
    (tables.some((x) => x.t == TAKE) && !tk ? 1 : 0);
  if (
    gone &&
    !confirm(gone + " QR akan dihapus dan tidak berlaku lagi. Lanjutkan?")
  )
    return;
  const b = $("#svt");
  b.disabled = true;
  try {
    const j = await api("POST", { count: n, takeaway: tk }, "/api/table");
    if (!j.tables) throw 0;
    tables = j.tables;
    mejaV();
    qmsg(
      "Tersimpan: " + tables.length + " QR. Cetak, lalu tempel di tiap meja.",
    );
  } catch (e) {
    if (sessionLost(e)) return;
    b.disabled = false;
    qmsg("Gagal menyimpan. Coba lagi.", 1);
  }
}

/* ---------- Tab dan masuk ---------- */
function setTab(t) {
  tab = t;
  history.replaceState(
    null,
    "",
    location.pathname + (t == "queue" ? "" : "#" + t),
  );
  document
    .querySelectorAll("#tabs button")
    .forEach((b) => b.classList.toggle("on", b.dataset.tab == t));
  if (t == "meja") mejaV();
  else if (t == "stok") stock ? stokV() : ((stock = null), stokV());
  else if (t == "hist") histV();
  else render();
  loadArch();
}
function start() {
  $("#out").hidden = false;
  $("#tabs").hidden = false;
  tables = null;
  document
    .querySelectorAll("#tabs button")
    .forEach((b) => b.classList.toggle("on", b.dataset.tab == tab));
  if (tab == "meja") mejaV();
  else $("#app").innerHTML = '<p class="muted">Memuat...</p>';
  load();
  clearInterval(timer);
  timer = setInterval(load, 5000);
}
async function login() {
  const b = $("#go"),
    pw = $("#pw").value;
  if (!pw) return;
  b.disabled = true;
  b.textContent = "Memeriksa...";
  try {
    await api("POST", { password: pw }, "/api/auth");
    start();
  } catch (e) {
    loginV(
      e == 429
        ? "Terlalu banyak percobaan. Coba lagi 15 menit lagi."
        : e == 503
          ? "Login belum diatur di server. Isi ADMIN_PASSWORD_HASH (atau ADMIN_PASSWORD untuk uji lokal) di file .env, simpan, lalu jalankan ulang server."
          : "Password salah.",
    );
  }
}
document.addEventListener("click", async (e) => {
  const t = e.target,
    b = t.closest("[data-id]"),
    tb = t.closest("[data-tab]"),
    r = t.closest("[data-r]"),
    f = t.closest("[data-f]"),
    st = t.closest("[data-st]"),
    cc = t.closest("[data-cat]"),
    gp = t.closest("[data-grp]"),
    dl = t.closest("[data-del]"),
    pr = t.closest("[data-pr]"),
    sfb = t.closest("[data-sf]");
  if (b) {
    b.disabled = true;
    try {
      await api("POST", { id: b.dataset.id, status: b.dataset.s });
    } catch (x) {}
    load();
  } else if (pr) {
    const o = orders.find((x) => x.id == pr.dataset.pr);
    if (o) printReceipt(o);
  } else if (tb) setTab(tb.dataset.tab);
  else if (r) {
    rng = r.dataset.r;
    statV();
    loadArch();
  } else if (f) {
    qf = f.dataset.f;
    queueV();
  } else if (st)
    setStock({
      id: +st.dataset.st,
      ...(st.dataset.k ? { k: st.dataset.k } : {}),
      off: st.dataset.off == "1",
    });
  else if (t.closest("[data-ed]")) {
    const id = +t.closest("[data-ed]").dataset.ed,
      m = stock.menu.find((x) => x.id == id);
    ef = ef && ef.id == id ? null : m ? fromItem(m) : null;
    sList();
  } else if (t.id == "edsave") saveEdit();
  else if (t.id == "edcancel") {
    ef = null;
    sList();
  } else if (cc)
    setStock({ cats: [cc.dataset.cat], closed: cc.dataset.cl == "1" });
  else if (gp) {
    const cats = [...new Set(stock.menu.map((m) => m.c))].filter(
      (c) => (gp.dataset.grp == "food") == FOOD.includes(c),
    );
    setStock({ cats, closed: gp.dataset.cl == "1" });
  } else if (dl) delMenu(dl.dataset.del);
  else if (sfb) {
    sf = sfb.dataset.sf;
    stokV();
  } else if (t.id == "addm") addMenu();
  else if (t.id == "srt") {
    stock = null;
    stokV();
  } else if (t.id == "go") login();
  else if (t.id == "svt") saveTables();
  else if (t.id == "prt") print();
  else if (t.id == "pdf") exportPdf();
  else if (t.id == "out") {
    try {
      await api("DELETE", null, "/api/auth");
    } catch (x) {}
    loginV();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id == "base") {
    base = e.target.value.trim();
    try {
      localStorage.setItem("qahwa_qr_base", base);
    } catch (x) {}
    drawQR();
  }
  if (e.target.id == "at") {
    nf.t = e.target.value;
    stokV();
  }
  if (e.target.id == "et" && ef) {
    ef.t = e.target.value;
    sList();
  }
  if (e.target.id == "hs") {
    hs = e.target.value;
    histList();
  }
});
document.addEventListener("input", (e) => {
  const k = { an: "n", ac: "c", ap: "p", aj: "j", ah: "h", ad: "d", af: "f" }[
      e.target.id
    ],
    k2 = { ep: "p", eh: "h", ed: "d", ef: "f" }[e.target.id];
  if (k) nf[k] = e.target.value;
  if (k2 && ef) ef[k2] = e.target.value;
  if (e.target.id == "sq") {
    sq = e.target.value.trim();
    sList();
  }
  if (e.target.id == "hq") {
    hq = e.target.value.trim();
    histList();
  }
});
document.addEventListener(
  "toggle",
  (e) => {
    const d = e.target.closest && e.target.closest("details[data-o]");
    if (d) d.open ? open.add(d.dataset.o) : open.delete(d.dataset.o);
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (e.key == "Enter" && e.target.id == "pw") login();
});
api("GET", null, "/api/auth").then(start, () => loginV());
