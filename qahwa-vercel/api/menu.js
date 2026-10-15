const { MENU, MT, MODE, CLIENT_KEY } = require("./_lib");
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=60");
  res.json({ menu: MENU, mode: MODE, clientKey: MODE === "mock" ? "" : CLIENT_KEY, snapUrl: MT.js });
};
