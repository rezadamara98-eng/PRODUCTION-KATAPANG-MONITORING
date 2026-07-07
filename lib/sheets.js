import { google } from "googleapis";

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Konfigurasi Google belum lengkap. Pastikan GOOGLE_CLIENT_EMAIL dan GOOGLE_PRIVATE_KEY sudah diset."
    );
  }

  return new google.auth.JWT(clientEmail, undefined, privateKey, [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
}

function toNumber(val) {
  return Number(String(val ?? "0").replace(/[^0-9.-]/g, "")) || 0;
}

// Membaca satu tab tertentu dari spreadsheet, mengembalikan array row
// dengan format: Tanggal | Lini/Mesin | Output | Target | Reject
async function readTab(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A:E`,
  });

  const rows = res.data.values || [];
  const [, ...body] = rows; // baris pertama = header, dilewati

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row, idx) => ({
      id: `${tabName}-${idx}`,
      sumber: tabName,
      tanggal: row[0] || "",
      lini: row[1] || tabName, // fallback ke nama tab kalau kolom lini kosong
      output: toNumber(row[2]),
      target: toNumber(row[3]),
      reject: toNumber(row[4]),
    }));
}

// Membaca dan menggabungkan beberapa tab produksi sekaligus.
// Nama tab diambil dari env GOOGLE_SHEET_TABS, dipisah koma.
// Contoh: GOOGLE_SHEET_TABS="STRONG PONT LINE,PA"
export async function getProductionData() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabsEnv = process.env.GOOGLE_SHEET_TABS || "STRONG PONT LINE,PA";
  const tabNames = tabsEnv.split(",").map((t) => t.trim()).filter(Boolean);

  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID belum diset.");
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const results = await Promise.all(
    tabNames.map((tab) =>
      readTab(sheets, spreadsheetId, tab).catch((err) => {
        console.error(`Gagal membaca tab "${tab}":`, err.message);
        return [];
      })
    )
  );

  return results.flat();
}
