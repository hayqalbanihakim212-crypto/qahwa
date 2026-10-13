// Payment Notification URL Midtrans: https://DOMAIN-KAMU/api/notify
const { MODE, SERVER_KEY, sha, safeEq, getOrder, applyMidtrans, ID_RE } = require("./_lib");
module.exports = async (req, res) => {
  try {
    if (MODE === "mock") return res.status(404).end();
    if (req.method !== "POST") return res.status(405).end();
    const n = req.body || {};
    if (!SERVER_KEY || !safeEq(sha(String(n.order_id) + n.status_code + n.gross_amount + SERVER_KEY), n.signature_key || ""))
      return res.status(403).end("invalid signature");
    const o = ID_RE.test(String(n.order_id)) ? await getOrder(n.order_id) : null;
    if (o && Number(n.gross_amount) === o.total) await applyMidtrans(o, n.transaction_status, n.fraud_status);
    res.status(200).end("ok");
  } catch (e) { res.status(500).end(); }
};
