// Payment Notification URL Midtrans: https://DOMAIN-KAMU/api/notify
const {
  MODE,
  handle,
  allow,
  HttpError,
  verifyNotification,
  getOrder,
  applyMidtrans,
  ID_RE,
} = require("./_lib");

module.exports = handle(
  async (req, res) => {
    if (MODE === "mock") throw new HttpError(404);
    allow(req, "POST");
    const n = req.body || {};
    if (!verifyNotification(n)) throw new HttpError(403, "invalid signature");
    const order = ID_RE.test(String(n.order_id)) ? await getOrder(n.order_id) : null;
    // jumlah harus cocok dengan total di server; kalau tidak, notifikasi diabaikan
    if (order && Number(n.gross_amount) === order.total)
      await applyMidtrans(order, n.transaction_status, n.fraud_status);
    res.status(200).end("ok");
  },
  { text: true },
);
