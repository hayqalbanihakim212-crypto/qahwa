-- ARSIP PESANAN PERMANEN. Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run.
-- Aman dijalankan berulang. Tabel kv/kv_list tetap dipakai untuk antrian langsung dan sesi;
-- tabel ini menyimpan SEMUA pesanan selamanya (tidak ikut kedaluwarsa 30 hari).

create table if not exists orders (
  id         text primary key,                 -- nomor pesanan, mis. QHW-XXXX
  ts         bigint not null,                  -- waktu pesanan dibuat (milidetik, sama dengan kode aplikasi)
  status     text not null,                    -- pending | paid | making | ready | done | failed
  tbl        text,                             -- nama meja, atau "Bawa pulang"
  name       text,
  note       text,
  total      integer not null default 0,       -- rupiah
  items      jsonb not null default '[]',      -- [{id, v, n, q, p}, ...]
  updated_at timestamptz not null default now()
);
create index if not exists orders_ts on orders (ts desc);
create index if not exists orders_status_ts on orders (status, ts desc);

-- Keamanan: RLS menyala tanpa policy, kunci publik tidak bisa membaca apa pun.
alter table orders enable row level security;

-- Salin pesanan yang sudah ada di kv (yang belum kedaluwarsa) ke arsip.
insert into orders (id, ts, status, tbl, name, note, total, items)
select (v::jsonb)->>'id',
       ((v::jsonb)->>'ts')::bigint,
       (v::jsonb)->>'status',
       (v::jsonb)->>'table',
       (v::jsonb)->>'name',
       (v::jsonb)->>'note',
       coalesce(((v::jsonb)->>'total')::integer, 0),
       coalesce((v::jsonb)->'items', '[]'::jsonb)
from kv
where k like 'order:%' and (exp is null or exp > now())
on conflict (id) do nothing;