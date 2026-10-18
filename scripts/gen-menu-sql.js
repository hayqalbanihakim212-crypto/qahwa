// Membuat sql/supabase_menu.sql dari api/_menu.js, jadi daftar menu cukup dirawat di SATU tempat.
// Pakai:  node scripts/gen-menu-sql.js
const fs = require("fs");
const path = require("path");
const menu = require("../api/_menu");

const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'"; // kutip SQL
const row = (m, i) =>
  `(${m.id},${sq(m.c)},${sq(m.n)},${m.p},${m.v ? sq(JSON.stringify(m.v)) + "::jsonb" : "null"},false,${i + 1})`;

const sql = `-- MENU DI DATABASE. Jalankan sekali: SQL Editor -> New query -> paste -> Run. Aman diulang (tidak menimpa perubahan admin).
-- FILE INI DIHASILKAN dari api/_menu.js oleh scripts/gen-menu-sql.js. Jangan diedit tangan; ubah _menu.js lalu jalankan ulang skripnya.
create table if not exists menu_items (
  id  integer primary key,          -- sama dengan ID lama, jadi riwayat pesanan tetap cocok
  c   text not null,                -- kategori
  n   text not null,                -- nama
  p   integer not null default 0,   -- harga (untuk menu bervarian: harga termurah)
  v   jsonb,                        -- varian: [{"k":"Panas","p":17000,"off":false}, ...] atau null
  off boolean not null default false, -- true = habis
  pos integer not null default 0,   -- urutan tampil
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_pos on menu_items (pos, id);
alter table menu_items enable row level security;

insert into menu_items (id,c,n,p,v,off,pos) values
${menu.map(row).join(",\n")}
on conflict (id) do nothing;
`;
const out = path.join(__dirname, "..", "sql", "supabase_menu.sql");
fs.writeFileSync(out, sql);
console.log(`${menu.length} menu -> ${path.relative(process.cwd(), out)}`);
