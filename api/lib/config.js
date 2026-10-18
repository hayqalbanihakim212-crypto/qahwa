/* Mode pembayaran dan kunci Midtrans.
   PAYMENT_MODE: mock | sandbox | production (default mock, paling aman). */
const REQ_MODE = ["mock", "sandbox", "production"].includes(
  process.env.PAYMENT_MODE,
)
  ? process.env.PAYMENT_MODE
  : "mock";

// Mode mock dikunci di production kecuali ALLOW_MOCK=1
const MODE =
  REQ_MODE === "mock" &&
  process.env.VERCEL_ENV === "production" &&
  process.env.ALLOW_MOCK !== "1"
    ? "locked"
    : REQ_MODE;

const PROD = MODE === "production";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "";
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || "";

const APP_HOST = PROD ? "app.midtrans.com" : "app.sandbox.midtrans.com";
const API_HOST = PROD ? "api.midtrans.com" : "api.sandbox.midtrans.com";
const MT = {
  snap: `https://${APP_HOST}/snap/v1/transactions`,
  api: `https://${API_HOST}/v2`,
  js: `https://${APP_HOST}/snap/snap.js`,
};
const basic = "Basic " + Buffer.from(SERVER_KEY + ":").toString("base64");

// Cegah salah pasang kunci: sandbox wajib kunci SB-, production wajib kunci non-SB
const configError = () => {
  if (MODE === "locked") return "Mode mock dikunci di production.";
  if (MODE === "mock") return null;
  if (!SERVER_KEY || !CLIENT_KEY) return "Kunci Midtrans belum diisi.";
  const sandboxKeys = SERVER_KEY.startsWith("SB-") && CLIENT_KEY.startsWith("SB-");
  if ((MODE === "sandbox") !== sandboxKeys)
    return "Kunci Midtrans tidak cocok dengan PAYMENT_MODE.";
  return null;
};

module.exports = { MODE, PROD, SERVER_KEY, CLIENT_KEY, MT, basic, configError };
