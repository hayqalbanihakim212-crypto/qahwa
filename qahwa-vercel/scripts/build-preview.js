// Gabungkan index.html + ds.css + app.js jadi satu file pratinjau: node scripts/build-preview.js
const fs = require("fs"), p = (f) => fs.readFileSync(__dirname + "/../public/" + f, "utf8");
const out = p("index.html").replace('<link href="/ds.css" rel="stylesheet">', "<style>" + p("ds.css") + "</style>").replace('<script src="/app.js"></script>', "<script>" + p("app.js") + "</script>");
fs.writeFileSync(__dirname + "/../qahwa-preview.html", out);
console.log("qahwa-preview.html dibuat (hanya tampilan; tanpa server pembayaran)");
