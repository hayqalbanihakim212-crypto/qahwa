const { MODE, MT, CLIENT_KEY, handle, allow, getMenu } = require("./_lib");

module.exports = handle(async (req, res) => {
  allow(req, "GET");
  const { menu, closed } = await getMenu();
  // stok habis dan kategori tutup harus langsung berlaku
  res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
  res.json({ mode: MODE, snapUrl: MT.js, clientKey: CLIENT_KEY, menu, closed });
});
