/* Midtrans: buat transaksi Snap, baca status, dan verifikasi notifikasi.
   Hanya status "pending" yang boleh diubah oleh pembayaran. */
const { MODE, SERVER_KEY, MT, basic } = require("./config");
const { sha, safeEq } = require("./security");
const { putOrder } = require("./orders");
const { HttpError } = require("./http");

const mapStatus = (transaction, fraud) =>
  transaction === "settlement" || (transaction === "capture" && fraud === "accept")
    ? "paid"
    : ["deny", "cancel", "expire", "failure"].includes(transaction)
      ? "failed"
      : null;

async function applyMidtrans(order, transaction, fraud) {
  const status = mapStatus(transaction, fraud);
  if (status && order.status === "pending") {
    order.status = status;
    await putOrder(order);
  }
  return order;
}

// Cek langsung ke Midtrans (server ke server), jadi status benar walau webhook telat
async function sync(order) {
  if (MODE === "mock" || order.status !== "pending") return order;
  try {
    const r = await fetch(MT.api + "/" + order.id + "/status", {
      headers: { Authorization: basic, Accept: "application/json" },
    });
    const j = await r.json();
    return await applyMidtrans(order, j.transaction_status, j.fraud_status);
  } catch (e) {
    return order;
  }
}

// Token pembayaran untuk pesanan baru. Mode mock tidak memanggil Midtrans.
async function createPaymentToken(order) {
  if (MODE === "mock") return "mock";
  const r = await fetch(MT.snap, {
    method: "POST",
    headers: {
      Authorization: basic,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: { order_id: order.id, gross_amount: order.total },
      item_details: order.items.map((i) => ({
        id: String(i.id) + (i.v ? "-" + i.v : ""),
        name: i.n.slice(0, 50),
        price: i.p,
        quantity: i.q,
      })),
      customer_details: { first_name: order.name },
      expiry: { unit: "minutes", duration: 15 },
    }),
  });
  const j = await r.json();
  if (!j.token) {
    console.error("midtrans", j.error_messages || j.status_message);
    throw new HttpError(502, "midtrans");
  }
  return j.token;
}

// Tanda tangan notifikasi: sha512(order_id + status_code + gross_amount + server_key)
const verifyNotification = (n) =>
  !!SERVER_KEY &&
  safeEq(
    sha(String(n.order_id) + n.status_code + n.gross_amount + SERVER_KEY),
    n.signature_key || "",
  );

module.exports = { applyMidtrans, sync, createPaymentToken, verifyNotification };
