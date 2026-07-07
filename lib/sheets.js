import { google } from "googleapis";

// Mengambil data mentah dari Google Sheets dan mengubahnya
// menjadi array object yang siap dipakai dashboard.
// Format kolom yang diharapkan di Sheet (baris pertama = header):
// Tanggal | Lini/Mesin | Output | Target | Reject
export async function getProductionData() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || "Sheet1!A:E";

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error(
      "Konfigurasi Google Sheets belum lengkap. Pastikan GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, dan GOOGLE_SHEET_ID sudah diset."
    );
  }

  const auth = new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  );

  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values || [];
  const [, ...body] = rows; // baris pertama dianggap header, dilewati

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row, idx) => {
      const output = Number(String(row[2] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
      const target = Number(String(row[3] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
      const reject = Number(String(row[4] ?? "0").replace(/[^0-9.-]/g, "")) || 0;

      return {
        id: idx,
        tanggal: row[0] || "",
        lini: row[1] || "Tidak diketahui",
        output,
        target,
        reject,
      };
    });
}
