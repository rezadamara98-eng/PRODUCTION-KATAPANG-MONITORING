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

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

// Parse angka format Indonesia: koma = desimal, titik = pemisah ribuan.
// Contoh: "100,65" -> 100.65 | "1.234,5" -> 1234.5
function parseIdNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Tab "PA": Tanggal, PA Supply, PA Sewing, PA Gudang Jadi, PA Factory
 * Nilai berupa persentase pencapaian per departemen, per hari.
 */
export async function getPaData() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_PA || "PA";
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID belum diset.");

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A:E`,
  });

  const rows = res.data.values || [];
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      supply: parseIdNumber(row[1]),
      sewing: parseIdNumber(row[2]),
      gudangJadi: parseIdNumber(row[3]),
      factory: parseIdNumber(row[4]),
    }));
}

/**
 * Tab "STRONG POINT LINE": tabel detail per Buyer/Style/Line.
 * Baris 1 = judul gabungan (dilewati), baris 2 = header asli, baris 3+ = data.
 * Kolom: BUYER, STYLE, NOTE, PA PAF, LINE,
 *        TARGET Kanan, TARGET Kiri, MP Direct, MP Indirect,
 *        ACTUAL Kanan, ACTUAL Kiri, EFFISIENSI Kanan, EFFISIENSI Kiri
 * Dikelompokkan per Style -> daftar Line yang mengerjakan style itu.
 */
export async function getStrongPointData() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_STRONG_POINT || "STRONG POINT LINE";
  if (!spreadsheetId) throw new Error("GOOGLE_SHEET_ID belum diset.");

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A:M`,
  });

  const rows = res.data.values || [];
  // Baris index 0 = judul gabungan, index 1 = header kolom asli, index 2+ = data
  const body = rows.slice(2);

  const rawRows = body
    .filter((row) => row && row.length > 0 && (row[1] || row[4]))
    .map((row) => ({
      buyer: row[0] || "",
      style: row[1] || "(Tanpa nama style)",
      note: row[2] || "",
      paPaf: parseIdNumber(row[3]),
      line: row[4] || "",
      targetKanan: parseIdNumber(row[5]),
      targetKiri: parseIdNumber(row[6]),
      mpDirect: parseIdNumber(row[7]),
      mpIndirect: parseIdNumber(row[8]),
      actualKanan: parseIdNumber(row[9]),
      actualKiri: parseIdNumber(row[10]),
      effKanan: parseIdNumber(row[11]),
      effKiri: parseIdNumber(row[12]),
    }));

  // Kelompokkan per style
  const map = new Map();
  for (const r of rawRows) {
    const key = r.style;
    if (!map.has(key)) map.set(key, { style: r.style, buyer: r.buyer, lines: [] });
    map.get(key).lines.push({
      line: r.line,
      targetKanan: r.targetKanan,
      targetKiri: r.targetKiri,
      actualKanan: r.actualKanan,
      actualKiri: r.actualKiri,
      effKanan: r.effKanan,
      effKiri: r.effKiri,
    });
  }

  return Array.from(map.values());
}
