import { google } from "googleapis";
import { getYesterdayGroupRows } from "./dateUtils";

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

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID belum diset.");
  return id;
}

// Parse angka format Indonesia: koma = desimal, titik = pemisah ribuan.
// Juga membersihkan simbol % dan spasi. Contoh: "100,65" -> 100.65 | "97,90%" -> 97.9
function parseIdNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).trim().replace(/%/g, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

async function fetchRange(tabName, range) {
  const sheets = getSheetsClient();
  const fullRange = range ? `'${tabName}'!${range}` : `'${tabName}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: fullRange,
  });
  return res.data.values || [];
}

/**
 * Tab "PA": Tanggal, PA Supply, PA Sewing, PA Gudang Jadi, PA Factory
 */
export async function getPaData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_PA || "PA";
  const rows = await fetchRange(tabName, "A:E");
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
 * Tab WIP sederhana (WIP Distribusi, WIP Cutting Synthetic, WIP Cutting Kulit):
 * Tanggal, Total WIP, Kode Style. Beberapa baris per tanggal (satu per style).
 */
async function getSimpleWipRows(tabName) {
  const rows = await fetchRange(tabName, "A:C");
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      totalWip: parseIdNumber(row[1]),
      kodeStyle: row[2] || "",
    }));
}

// Total WIP di tanggal "kemarin" (jumlah semua baris/style di tanggal itu)
export async function getWipSummary() {
  const tabs = {
    distribusi: process.env.GOOGLE_SHEET_TAB_WIP_DISTRIBUSI || "WIP DISTRIBUSI",
    cuttingSynthetic: process.env.GOOGLE_SHEET_TAB_WIP_CUTTING_SYNTHETIC || "WIP CUTTING SYNTHETIC",
    cuttingKulit: process.env.GOOGLE_SHEET_TAB_WIP_CUTTING_KULIT || "WIP CUTTING KULIT",
  };

  const entries = await Promise.all(
    Object.entries(tabs).map(async ([key, tabName]) => {
      const rows = await getSimpleWipRows(tabName).catch(() => []);
      const group = getYesterdayGroupRows(rows, "tanggal");
      const total = group.reduce((sum, r) => sum + r.totalWip, 0);
      const tanggal = group.length > 0 ? group[0].tanggal : null;
      return [key, { total, tanggal }];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Tab "WIP LINE SEWING": Tanggal, Total WIP, Line, WIP1-5, Keterangan (AMAN/PROBLEM)
 */
export async function getWipLineData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_WIP_LINE_SEWING || "WIP LINE SEWING";
  const rows = await fetchRange(tabName, "A:I");
  const [, ...body] = rows;

  const allRows = body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      totalWip: parseIdNumber(row[1]),
      line: row[2] || "",
      keterangan: (row[8] || "").trim().toUpperCase(),
    }));

  return getYesterdayGroupRows(allRows, "tanggal");
}

/**
 * Tab "Plan_SEWvsACT": LokDate, LokFact, LokPlan, LokAct, Achv
 */
export async function getPlanSewData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_PLAN_SEW || "Plan_SEWvsACT";
  const rows = await fetchRange(tabName, "A:E");
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      fact: row[1] || "",
      plan: parseIdNumber(row[2]),
      actual: parseIdNumber(row[3]),
      achv: parseIdNumber(row[4]),
    }));
}

/**
 * Tab "PLAN_DISTvsACT": Line, SPO, Style, Fact, Fact2, Tanggal, Plan SEW,
 * GroupingStyle, Actual SEW, GAP, CumPlan, CumAct, %Achievement
 */
export async function getPlanDistData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_PLAN_DIST || "PLAN_DISTvsACT";
  const rows = await fetchRange(tabName);
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[1])
    .map((row) => ({
      line: row[0] || "",
      spo: row[1] || "",
      style: row[2] || "",
      tanggal: row[5] || "",
      planSew: parseIdNumber(row[6]),
      actualSew: parseIdNumber(row[8]),
      gap: parseIdNumber(row[9]),
      achievement: parseIdNumber(row[12]),
    }));
}

/**
 * Tab "gudang jadi": kolom C=SPO, D=nama style, M=(-) Produksi, S=(-) Envelope Incoming,
 * G=Qty Shipment, H=Qty Shipment Pack. Header ada di baris ke-3 (index 2), data mulai baris ke-4 (index 3).
 */
export async function getGudangJadiData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_GUDANG_JADI || "gudang jadi";
  const rows = await fetchRange(tabName);
  const body = rows.slice(3); // lewati 2 baris judul + 1 baris header

  return body
    .filter((row) => row && row.length > 0 && row[2])
    .map((row) => ({
      spo: row[2] || "",
      style: row[3] || "",
      qtyShipment: parseIdNumber(row[6]),
      qtyShipmentPack: parseIdNumber(row[7]),
      kekuranganProduksi: parseIdNumber(row[12]),
      kekuranganEnvelope: parseIdNumber(row[18]),
    }));
}

export async function getGudangJadiSummary() {
  const rows = await getGudangJadiData();
  return rows.reduce(
    (acc, r) => {
      acc.totalKekuranganProduksi += r.kekuranganProduksi;
      acc.totalKekuranganEnvelope += r.kekuranganEnvelope;
      acc.totalQtyShipment += r.qtyShipment;
      acc.totalQtyShipmentPack += r.qtyShipmentPack;
      return acc;
    },
    {
      totalKekuranganProduksi: 0,
      totalKekuranganEnvelope: 0,
      totalQtyShipment: 0,
      totalQtyShipmentPack: 0,
    }
  );
}
