// Hanya aktif saat PAYMENT_MODE=mock. Di sandbox/production endpoint ini tidak ada.
const {
  MODE,
  handle,
  allow,
  HttpError,
  requireSameOrigin,
  rateLimit,
  getOrder,
  putOrder,
  secOk,
  ip,
  ID_RE,
} = require("./_lib");

module.exports = handle(async (req, res) => {
  if (MODE !== "mock") throw new HttpError(404);
  allow(req, "POST");
  requireSameOrigin(req);
  await rateLimit("rl:mock:" + ip(req), 60, 600);

  const { id, result } = req.body || {};
  const order = ID_RE.test(String(id)) ? await getOrder(id) : null;
  const valid =
    order &&
    secOk(order, req.headers["x-order-token"]) &&
    order.status === "pending" &&
    ["paid", "failed"].includes(result);
  if (!valid) throw new HttpError(400, "bad");

  order.status = result;
  await putOrder(order);
  res.json({ ok: 1 });
});
