const { MODE, MT, CLIENT_KEY, getMenu } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const { menu, closed } = await getMenu();
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=5, stale-while-revalidate=10",
    ); // stok habis dan kategori tutup harus langsung berlaku
    res.json({
      mode: MODE,
      snapUrl: MT.js,
      clientKey: CLIENT_KEY,
      menu,
      closed,
    });
  } catch (e) {
    res.status(500).json({ error: "server" });
  }
};
