const $=s=>document.querySelector(s),rp=n=>"Rp "+Number(n).toLocaleString("id-ID"),
esc=s=>String(s??"").replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";"),
hm=t=>new Date(t).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
const NEXT={paid:["making","Mulai buat"],making:["ready","Pesanan siap"],ready:["done","Selesaikan"]},LBL={paid:"Dibayar",making:"Dibuat",ready:"Siap"},
MODE_TXT={mock:"MODE SIMULASI: pesanan berasal dari pembayaran palsu",sandbox:"MODE UJI MIDTRANS: tidak ada uang sungguhan"},
TAKE="Bawa pulang",tl=t=>t==TAKE?TAKE:"Meja "+t;
let orders=[],seen=null,timer=null,mode="",tab=location.hash=="#meja"?"meja":"queue",tables=null,base="";
try{base=localStorage.getItem("qahwa_qr_base")||""}catch(e){}
/* Sesi ada di cookie HttpOnly dari server; halaman ini tidak menyimpan password atau token apa pun. */
async function api(method,body,url="/api/admin"){
  const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  if(r.status==401)throw 401;if(r.status==429)throw 429;if(r.status==503)throw 503;
  return r.json();
}
function beep(){try{const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.25)}catch(e){}}
function loginV(m){
  clearInterval(timer);$("#out").hidden=true;$("#tabs").hidden=true;$("#mode").hidden=true;tables=null;
  $("#app").innerHTML=`<h2>Masuk admin</h2><p class="muted">Halaman ini khusus pemilik dan staf.</p>${m?`<div class="alert" role="alert">${esc(m)}</div>`:""}<label>Password<input id="pw" type="password" autocomplete="current-password" maxlength="200"></label><button class="btn" id="go">Masuk</button>`;
}

/* ---------- Tab Antrian ---------- */
function queueV(){
  const act=orders.filter(o=>NEXT[o.status]).sort((a,b)=>a.ts-b.ts);
  const d=new Date().toDateString(),td=orders.filter(o=>["paid","making","ready","done"].includes(o.status)&&new Date(o.ts).toDateString()==d),rev=td.reduce((s,o)=>s+o.total,0);
  $("#app").innerHTML=`<div class="stats"><div class="card"><span class="muted">Pendapatan hari ini</span><b>${rp(rev)}</b></div><div class="card"><span class="muted">Pesanan dibayar</span><b>${td.length}</b></div><div class="card"><span class="muted">Menunggu bayar</span><b>${orders.filter(o=>o.status=="pending").length}</b></div></div><h2>Antrian dapur</h2>`+
  (act.length?act.map(o=>`<div class="card"><div class="split"><b class="tbl">${esc(tl(o.table))}</b><span class="chip ${o.status}">${LBL[o.status]}</span></div><div class="muted">${esc(o.id)}, ${esc(o.name)}, ${hm(o.ts)}</div><div>${o.items.map(i=>i.q+"× "+esc(i.n)).join("<br>")}</div>${o.note?`<div class="muted">Catatan: ${esc(o.note)}</div>`:""}<div class="split"><b>${rp(o.total)}</b><button class="btn sm" data-id="${esc(o.id)}" data-s="${NEXT[o.status][0]}">${NEXT[o.status][1]}</button></div></div>`).join(""):`<p class="muted">Belum ada pesanan masuk.</p>`);
}
function note(){ // bunyi saat ada pesanan baru dibayar, dan jumlah antrian di tab
  const ids=new Set(orders.filter(o=>o.status=="paid").map(o=>o.id));
  if(seen&&[...ids].some(i=>!seen.has(i)))beep();seen=ids;
  const n=orders.filter(o=>NEXT[o.status]).length;$("#t-queue").textContent="Antrian"+(n?" ("+n+")":"");
}
async function load(){
  try{const j=await api("GET");orders=j.orders;if(j.mode!=mode){mode=j.mode;$("#mode").textContent=MODE_TXT[mode]||"";$("#mode").hidden=!MODE_TXT[mode]}note();if(tab=="queue")queueV()}
  catch(e){if(e===401)loginV("Sesi berakhir. Silakan masuk lagi.")}
}

/* ---------- Tab Meja & QR: pemilik menentukan jumlah meja, tiap meja dapat QR sendiri ---------- */
async function loadTables(){
  try{tables=(await api("GET",null,"/api/table")).tables||[]}catch(e){if(e===401)return loginV("Sesi berakhir. Silakan masuk lagi.");tables=[]}
  if(tab=="meja")mejaV();
}
function mejaV(){
  if(tables===null){$("#app").innerHTML='<p class="muted">Memuat...</p>';return loadTables()}
  const n=tables.filter(x=>x.t!=TAKE).length,tk=tables.some(x=>x.t==TAKE);
  $("#app").innerHTML=`<h2 class="no">Meja &amp; QR</h2><p class="muted no">Atur jumlah meja. Setiap meja punya QR sendiri. Pelanggan yang scan langsung tahu mejanya dan disambut "Selamat datang, pelanggan Meja N", tanpa memilih meja.</p>
  <div class="card no"><label>Jumlah meja (1 sampai 60)<input id="cnt" type="number" min="1" max="60" inputmode="numeric" value="${n||10}"></label>
  <label class="chk"><input type="checkbox" id="tk" ${tk?"checked":""}>Sediakan QR "Bawa pulang"</label>
  <label>Alamat situs di dalam QR<input id="base" value="${esc(base||location.origin)}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
  <p class="muted">Di komputer sendiri, ganti dengan alamat jaringan agar QR bisa dibuka dari HP, contoh http://192.168.1.5:3000</p>
  <button class="btn" id="svt">${tables.length?"Simpan perubahan":"Buat meja"}</button>${tables.length?`<button class="btn ghost" id="prt">Cetak QR</button>`:""}</div>
  <div id="qmsg" class="no"></div><div class="qrs" id="qg"></div>`;
  drawQR();
}
function drawQR(){
  const g=$("#qg");if(!g)return;
  if(!tables.length){g.innerHTML='<p class="muted">Belum ada meja. Isi jumlah meja lalu tekan "Buat meja".</p>';return}
  let b;try{const u=new URL(($("#base").value||"").trim());if(!/^https?:$/.test(u.protocol))throw 0;b=u.origin}catch(e){g.innerHTML='<div class="alert no" role="alert">Alamat situs tidak valid. Contoh: https://qahwa.vercel.app</div>';return}
  g.innerHTML=tables.map(x=>{const q=qrcode(0,"M");q.addData(b+"/?m="+x.k);q.make();
    return `<div class="card"><div class="qr">${q.createSvgTag({cellSize:4,margin:0,scalable:true})}</div><h2>${esc(tl(x.t))}</h2><small class="muted">Qahwa: scan untuk pesan</small></div>`}).join("");
}
const qmsg=(t,bad)=>{const e=$("#qmsg");if(e)e.innerHTML=`<div class="${bad?"alert":"okmsg"}" role="status">${esc(t)}</div>`};
async function saveTables(){
  const n=Math.floor(+$("#cnt").value),tk=$("#tk").checked;
  if(!(n>=1&&n<=60))return qmsg("Jumlah meja harus antara 1 dan 60.",1);
  const gone=tables.filter(x=>x.t!=TAKE&&+x.t>n).length+(tables.some(x=>x.t==TAKE)&&!tk?1:0);
  if(gone&&!confirm(gone+" QR akan dihapus dan tidak berlaku lagi. Lanjutkan?"))return;
  const b=$("#svt");b.disabled=true;
  try{const j=await api("POST",{count:n,takeaway:tk},"/api/table");if(!j.tables)throw 0;tables=j.tables;mejaV();qmsg("Tersimpan: "+tables.length+" QR. Cetak, lalu tempel di tiap meja.")}
  catch(e){if(e===401)return loginV("Sesi berakhir. Silakan masuk lagi.");b.disabled=false;qmsg("Gagal menyimpan. Coba lagi.",1)}
}

/* ---------- Tab dan masuk ---------- */
function setTab(t){
  tab=t;history.replaceState(null,"",location.pathname+(t=="meja"?"#meja":""));
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab==t));
  if(t=="meja")mejaV();else queueV();
}
function start(){
  $("#out").hidden=false;$("#tabs").hidden=false;tables=null;
  document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab==tab));
  if(tab=="meja")mejaV();else $("#app").innerHTML='<p class="muted">Memuat...</p>';
  load();clearInterval(timer);timer=setInterval(load,5000);
}
async function login(){
  const b=$("#go"),pw=$("#pw").value;if(!pw)return;b.disabled=true;b.textContent="Memeriksa...";
  try{await api("POST",{password:pw},"/api/auth");start()}
  catch(e){loginV(e==429?"Terlalu banyak percobaan. Coba lagi 15 menit lagi.":e==503?"Login belum diatur di server. Isi ADMIN_PASSWORD_HASH (atau ADMIN_PASSWORD untuk uji lokal) di file .env, simpan, lalu jalankan ulang server.":"Password salah.")}
}
document.addEventListener("click",async e=>{
  const t=e.target,b=t.closest("[data-id]"),tb=t.closest("[data-tab]");
  if(b){b.disabled=true;try{await api("POST",{id:b.dataset.id,status:b.dataset.s})}catch(x){}load()}
  else if(tb)setTab(tb.dataset.tab);
  else if(t.id=="go")login();
  else if(t.id=="svt")saveTables();
  else if(t.id=="prt")print();
  else if(t.id=="out"){try{await api("DELETE",null,"/api/auth")}catch(x){}loginV()}
});
document.addEventListener("change",e=>{if(e.target.id=="base"){base=e.target.value.trim();try{localStorage.setItem("qahwa_qr_base",base)}catch(x){}drawQR()}});
document.addEventListener("keydown",e=>{if(e.key=="Enter"&&e.target.id=="pw")login()});
api("GET",null,"/api/auth").then(start,()=>loginV());
