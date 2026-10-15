const { MODE, MT, CLIENT_KEY, MENU, configError } = require("./_lib");

module.exports = (req, res) => {
  if (req.method !== "GET") return res.status(405).end();

  res.json({
    mode: MODE,
    snapUrl: MT.js,
    clientKey: CLIENT_KEY,
    menu: MENU,
  });
};
