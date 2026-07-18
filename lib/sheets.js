import { google } from "googleapis";
import { getYesterdayGroupRows, getYesterdayRow, getLastCompleteGroupRows } from "./dateUtils";

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

function normalizeHeader(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Cari index kolom berdasarkan nama header (bukan posisi tetap), supaya tidak
// terpengaruh kolom tersembunyi atau urutan kolom yang berubah.
function buildHeaderIndex(headerRow) {
  const map = {};
  (headerRow || []).forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key && !(key in map)) map[key] = i;
  });
  return map;
}

// Pemetaan nama style ke kategori Skill Matrik Cutting.
// Dicek berurutan, yang lebih spesifik ditaruh duluan supaya tidak salah cocok.
const STYLE_SKILL_CATEGORY_MAP = [
  { category: "premium", patterns: ["tour authentic 2022 pro player"] },
  { category: "sheepSkin", patterns: ["tour authentic 2025", "premier 2.0", "apex tour 2024"] },
  { category: "goatSkin", patterns: ["dawn patrol 2024", "clubhouse 2020"] },
  { category: "combo", patterns: ["callaway custom", "x tech 2023", "x-tech 2023", "fusion 2024"] },
  { category: "pathThumb", patterns: ["weather spann"] },
];

export function getSkillCategoryForStyle(styleName) {
  const needle = (styleName || "").toLowerCase();
  for (const entry of STYLE_SKILL_CATEGORY_MAP) {
    if (entry.patterns.some((p) => needle.includes(p))) return entry.category;
  }
  return null;
}

/**
 * Rata-rata kapasitas cutting per operator berdasarkan KATEGORI SKILL
 * (dari Skill Matrik Cutting), bukan dari tabel Kapasitas Cutting harian.
 * Hanya operator dengan skor > 0 di kategori itu yang dihitung (dianggap
 * punya kompetensi untuk kategori tersebut).
 */
export async function getAverageSkillCuttingCapacity(category) {
  const rows = await getSkillMatrikCuttingData();
  if (!category) return { average: 0, sampleSize: 0, category: null };

  const pool = rows.filter((r) => r[category] > 0);
  if (pool.length === 0) return { average: 0, sampleSize: 0, category };

  const average = pool.reduce((sum, r) => sum + r[category], 0) / pool.length;
  return { average, sampleSize: pool.length, category };
}

let sheetTitlesCache = null;

async function getSheetTitles() {
  if (sheetTitlesCache) return sheetTitlesCache;
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: "sheets.properties",
  });
  sheetTitlesCache = (res.data.sheets || []).map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
  }));
  return sheetTitlesCache;
}

function normalizeTabName(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Cari nama tab asli di spreadsheet berdasarkan nama yang diberikan (exact atau
// case/spasi-insensitive), dengan fallback ke gid kalau nama tidak ketemu sama sekali.
// Ini melindungi dari typo kecil, kapitalisasi beda, atau spasi tak terlihat.
async function resolveTabTitle(preferredName, gid) {
  const titles = await getSheetTitles();

  let found = titles.find((t) => t.title === preferredName);
  if (found) return found.title;

  found = titles.find((t) => normalizeTabName(t.title) === normalizeTabName(preferredName));
  if (found) return found.title;

  if (gid !== undefined) {
    found = titles.find((t) => String(t.sheetId) === String(gid));
    if (found) return found.title;
  }

  throw new Error(
    `Tab "${preferredName}" tidak ditemukan di spreadsheet. Tab yang tersedia: ${titles.map((t) => t.title).join(", ")}`
  );
}

async function fetchRange(preferredTabName, range, gid) {
  const sheets = getSheetsClient();
  const tabName = await resolveTabTitle(preferredTabName, gid);
  const fullRange = range ? `'${tabName}'!${range}` : `'${tabName}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: fullRange,
  });
  return res.data.values || [];
}

// Ambil BANYAK range sekaligus dalam SATU request ke Google Sheets API
// (pakai batchGet), supaya tidak kena limit "read requests per menit" waktu
// 1 halaman butuh baca banyak tab sekaligus.
// specs: [{ tabName, range, gid }] -> hasil array of rows, urutannya sama dengan specs.
async function batchFetchRanges(specs) {
  const sheets = getSheetsClient();
  const resolvedTitles = await Promise.all(specs.map((s) => resolveTabTitle(s.tabName, s.gid)));
  const ranges = specs.map((s, i) => (s.range ? `'${resolvedTitles[i]}'!${s.range}` : `'${resolvedTitles[i]}'`));

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: getSpreadsheetId(),
    ranges,
  });

  return (res.data.valueRanges || []).map((vr) => vr.values || []);
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
async function getSimpleWipRows(tabName, gid, preFetchedRows) {
  const rows = preFetchedRows || (await fetchRange(tabName, "A:C", gid));
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
    distribusi: {
      name: process.env.GOOGLE_SHEET_TAB_WIP_DISTRIBUSI || "WIP DISTRIBUSI",
      gid: 688373072,
    },
    cuttingSynthetic: {
      name: process.env.GOOGLE_SHEET_TAB_WIP_CUTTING_SYNTHETIC || "WIP CUTTING SYNTHETIC",
      gid: 2051911938,
    },
    cuttingKulit: {
      name: process.env.GOOGLE_SHEET_TAB_WIP_CUTTING_KULIT || "WIP CUTTING KULIT",
      gid: 2062479432,
    },
  };

  const entries = await Promise.all(
    Object.entries(tabs).map(async ([key, tab]) => {
      const rows = await getSimpleWipRows(tab.name, tab.gid).catch(() => []);
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
export async function getWipLineData(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_WIP_LINE_SEWING || "WIP LINE SEWING";
  const rows = preFetchedRows || (await fetchRange(tabName, "A:I", 586580262));
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
 * Tab "Plan_SEWvsACT": Line, SPO, Style, Fact, Fact(dup), Tanggal, Plan SEW,
 * GroupingStyle, Actual SEW, GAP, CumPlan, CumAct, %Achievement
 * (detail per Line/SPO/Style)
 */
export async function getPlanSewData(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_PLAN_SEW || "Plan_SEWvsACT";
  const rows = preFetchedRows || (await fetchRange(tabName, undefined, 840125565));
  const [header, ...body] = rows;
  const idx = buildHeaderIndex(header);

  const iLine = idx["line"] ?? 0;
  const iSpo = idx["spo"] ?? 1;
  const iStyle = idx["style"] ?? 2;
  const iTanggal = idx["tanggal"] ?? 5;
  const iPlanSew = idx["plansew"] ?? 6;
  const iActualSew = idx["actualsew"] ?? 8;
  const iGap = idx["gap"] ?? 9;
  const iAchievement = idx["achievement"] ?? 12;

  return body
    .filter((row) => row && row.length > 0 && row[iSpo])
    .map((row) => ({
      line: row[iLine] || "",
      spo: row[iSpo] || "",
      style: row[iStyle] || "",
      tanggal: row[iTanggal] || "",
      planSew: parseIdNumber(row[iPlanSew]),
      actualSew: parseIdNumber(row[iActualSew]),
      gap: parseIdNumber(row[iGap]),
      achievement: parseIdNumber(row[iAchievement]),
    }));
}

/**
 * Tab "PLAN_DISTvsACT": kolom A=kode gabungan, LokDate, LokFact, LokPlan, LokAct, Achv
 * (ringkasan per Fact/lokasi: F1K, A, F2K, Makloon/CPA)
 */
export async function getPlanDistData(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_PLAN_DIST || "PLAN_DISTvsACT";
  const rows = preFetchedRows || (await fetchRange(tabName, undefined, 1293384780));
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[1])
    .map((row) => ({
      kode: row[0] || "",
      tanggal: row[1] || "",
      fact: row[2] || "",
      plan: parseIdNumber(row[3]),
      actual: parseIdNumber(row[4]),
      achievement: parseIdNumber(row[5]),
    }));
}

/**
 * Tab "gudang jadi": kolom C=SPO, D=nama style, M=(-) Produksi, S=(-) Envelope Incoming,
 * G=Qty Shipment, H=Qty Shipment Pack. Header ada di baris ke-3 (index 2), data mulai baris ke-4 (index 3).
 */
export async function getGudangJadiData(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_GUDANG_JADI || "gudang jadi";
  const rows = preFetchedRows || (await fetchRange(tabName, undefined, 1051336247));
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

export async function getGudangJadiSummary(preFetchedRows) {
  const rows = await getGudangJadiData(preFetchedRows);
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

/**
 * Parser generik untuk tab format "wide": Tanggal + kolom per Line
 * (dipakai untuk OUTPUT LINE dan EFFISIENSI LINE).
 */
async function getWideLineRows(tabName) {
  const rows = await fetchRange(tabName);
  const [header, ...body] = rows;
  const lineNames = (header || []).slice(1);

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      lines: lineNames
        .map((line, i) => ({ line: line || "", value: parseIdNumber(row[i + 1]) }))
        .filter((l) => l.line),
    }));
}

/**
 * Tab "OUTPUT LINE": Tanggal + kolom per Line (K01-K51) = jumlah output.
 * Kembalikan data hari kemarin saja (per line).
 */
export async function getOutputLineYesterday() {
  const tabName = process.env.GOOGLE_SHEET_TAB_OUTPUT_LINE || "OUTPUT LINE";
  const rows = await getWideLineRows(tabName);
  return getYesterdayRow(rows, "tanggal");
}

/**
 * Tab "EFFISIENSI LINE": Tanggal + kolom per Line = persentase efisiensi.
 * Kembalikan data hari kemarin saja (per line).
 */
export async function getEffisiensiLineYesterday() {
  const tabName = process.env.GOOGLE_SHEET_TAB_EFFISIENSI_LINE || "EFFISIENSI LINE";
  const rows = await getWideLineRows(tabName);
  return getYesterdayRow(rows, "tanggal");
}

/**
 * Tab "WIP PRESUB" dan "WIP ACCESSORIES": Tanggal, Total WIP, Kode Style
 * (struktur sama seperti WIP Distribusi/Cutting Synthetic/Cutting Kulit).
 */
export async function getWipPresubAccessoriesSummary() {
  const tabs = {
    presub: process.env.GOOGLE_SHEET_TAB_WIP_PRESUB || "WIP PRESUB",
    accessories: process.env.GOOGLE_SHEET_TAB_WIP_ACCESSORIES || "WIP ACCESSORIES",
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
 * Tab "JAM KERJA": Tanggal, 4x Jam Kerja SM (Supply/Sewing/GudangJadi/Support),
 * 4x Jam Kerja Actual, 4x Gap. Total 13 kolom (A-M).
 */
export async function getJamKerjaYesterday(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_JAM_KERJA || "JAM KERJA";
  const rows = preFetchedRows || (await fetchRange(tabName, "A:M"));
  const [, ...body] = rows;

  const allRows = body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      smSupply: parseIdNumber(row[1]),
      smSewing: parseIdNumber(row[2]),
      smGudangJadi: parseIdNumber(row[3]),
      smSupport: parseIdNumber(row[4]),
      actualSupply: parseIdNumber(row[5]),
      actualSewing: parseIdNumber(row[6]),
      actualGudangJadi: parseIdNumber(row[7]),
      actualSupport: parseIdNumber(row[8]),
      gapSupply: parseIdNumber(row[9]),
      gapSewing: parseIdNumber(row[10]),
      gapGudangJadi: parseIdNumber(row[11]),
      gapSupport: parseIdNumber(row[12]),
    }));

  const group = getLastCompleteGroupRows(allRows, "tanggal", "actualSupply");
  return group.length > 0 ? group[0] : getYesterdayRow(allRows, "tanggal");
}

/**
 * Tab "DATA ABSENSI": Tanggal, Jenis Absen, Jumlah, Jumlah MP.
 * Beberapa baris per tanggal (satu per jenis absen).
 */
export async function getAbsensiYesterday(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_DATA_ABSENSI || "DATA ABSENSI";
  const rows = preFetchedRows || (await fetchRange(tabName, "A:D"));
  const [, ...body] = rows;

  const allRows = body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      jenisAbsen: row[1] || "",
      jumlah: parseIdNumber(row[2]),
      jumlahMp: parseIdNumber(row[3]),
    }));

  return getYesterdayGroupRows(allRows, "tanggal");
}

/**
 * Tab "KODE OPERATOR CUTTING": No, Nama, Kode.
 * Daftar referensi nama <-> kode untuk traceability reject.
 */
export async function getKodeOperatorCuttingList() {
  const tabName = process.env.GOOGLE_SHEET_TAB_KODE_OPERATOR || "KODE OPERATOR CUTTING";
  const rows = await fetchRange(tabName, "A:C");
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[1])
    .map((row) => ({
      nama: row[1] || "",
      kode: row[2] || "",
    }));
}

/**
 * Tab "KAPASITAS CUTTING": Tanggal, Line, NIK, Nama, Style, Kapasitas.
 * Kembalikan data hari kemarin saja.
 */
export async function getKapasitasCuttingYesterday(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_KAPASITAS_CUTTING || "KAPASITAS CUTTING";
  const rows = preFetchedRows || (await fetchRange(tabName, undefined, 1518550206));
  const [, ...body] = rows;

  const allRows = body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      line: row[1] || "",
      nik: row[2] || "",
      nama: row[3] || "",
      style: row[4] || "",
      kapasitas: parseIdNumber(row[5]),
    }));

  return getYesterdayGroupRows(allRows, "tanggal");
}

// Top 10 operator dengan kapasitas terbesar di tanggal kemarin
export async function getKapasitasCuttingTop10(preFetchedRows) {
  const rows = await getKapasitasCuttingYesterday(preFetchedRows);
  return [...rows].sort((a, b) => b.kapasitas - a.kapasitas).slice(0, 10);
}

/**
 * Tab "STRONG POINT LINE": tabel detail per Buyer/Style/Line.
 * Baris 1 = judul gabungan (dilewati), baris 2 = header asli, baris 3+ = data.
 * Dikelompokkan per Style -> daftar Line yang mengerjakan style itu.
 */
export async function getStrongPointData(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_STRONG_POINT || "STRONG POINT LINE";
  const rows = preFetchedRows || (await fetchRange(tabName, undefined, 1059453236));
  const body = rows.slice(2);

  const rawRows = body
    .filter((row) => row && row.length > 0 && (row[1] || row[4]))
    .map((row) => ({
      buyer: row[0] || "",
      style: row[1] || "(Tanpa nama style)",
      paPaf: parseIdNumber(row[3]),
      line: row[4] || "",
      targetKanan: parseIdNumber(row[5]),
      targetKiri: parseIdNumber(row[6]),
      actualKanan: parseIdNumber(row[9]),
      actualKiri: parseIdNumber(row[10]),
      effKanan: parseIdNumber(row[11]),
      effKiri: parseIdNumber(row[12]),
    }));

  const map = new Map();
  for (const r of rawRows) {
    const key = r.style;
    if (!map.has(key)) map.set(key, { style: r.style, buyer: r.buyer, lines: [] });
    map.get(key).lines.push({
      line: r.line,
      paPaf: r.paPaf,
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

/**
 * Tab "SKILL MATRIK CUTTING": No, NIK, Nama, Job, Lama Bekerja,
 * 5 skor Skill Cutting (Path & Thumb, Combo, Goat Skin Pola Full,
 * Sheep Skin Pola Full, Premium), Pemahaman Artikel.
 * Baris 1 = judul grup kolom, baris 2 = header asli, baris 3+ = data.
 */
export async function getSkillMatrikCuttingData(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_SKILL_MATRIK_CUTTING || "SKILL MATRIK CUTTING";
  const rows = preFetchedRows || (await fetchRange(tabName, undefined, 1380483843));
  const subHeader = rows[1] || [];
  const idx = buildHeaderIndex(subHeader);
  const body = rows.slice(2);

  const iNik = idx["nik"] ?? 1;
  const iNama = idx["nama"] ?? 2;
  const iJob = idx["job"] ?? 3;
  const iLama = idx["lamabekerja"] ?? 4;
  const iPathThumb = idx["paththumb"] ?? 5;
  const iCombo = idx["combo"] ?? 6;
  const iGoatSkin = idx["goatskinpolafull"] ?? 7;
  const iSheepSkin = idx["sheepskinpolafull"] ?? 8;
  const iPremium = idx["premium"] ?? 9;
  const iPemahaman = idx["pemahamanartikel"] ?? 10;

  return body
    .filter((row) => row && row.length > 0 && row[iNama])
    .map((row) => {
      const pathThumb = parseIdNumber(row[iPathThumb]);
      const combo = parseIdNumber(row[iCombo]);
      const goatSkin = parseIdNumber(row[iGoatSkin]);
      const sheepSkin = parseIdNumber(row[iSheepSkin]);
      const premium = parseIdNumber(row[iPremium]);
      return {
        nik: row[iNik] || "",
        nama: row[iNama] || "",
        job: row[iJob] || "",
        lamaBekerja: parseIdNumber(row[iLama]),
        pathThumb,
        combo,
        goatSkin,
        sheepSkin,
        premium,
        totalSkill: pathThumb + combo + goatSkin + sheepSkin + premium,
        pemahamanArtikel: row[iPemahaman] || "",
      };
    });
}

// Top 10 operator dengan total skor skill tertinggi
export async function getSkillMatrikCuttingTop10(preFetchedRows) {
  const rows = await getSkillMatrikCuttingData(preFetchedRows);
  return [...rows].sort((a, b) => b.totalSkill - a.totalSkill).slice(0, 10);
}

/**
 * Tab "SPO TRACK": Line, (kolom kosong), Box, SPO, Product.
 * Satu baris = satu box/unit fisik.
 */
export async function getSpoTrackData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_SPO_TRACK || "SPO TRACK";
  const rows = await fetchRange(tabName, undefined, 1564580769);
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[1])
    .map((row) => ({
      line: row[0] || "",
      box: row[1] || "",
      spo: row[2] || "",
      product: row[3] || "",
    }));
}

/**
 * Tab "SKILL MATRIX SEWING": No, Posisi Section Terakhir (Line), (kolom kosong),
 * NIK, Nama, Skill 1, Style 1, SMV 1, Target SMV 1, Kap Act 1.
 */
export async function getSkillMatrixSewingData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_SKILL_MATRIX_SEWING || "SKILL MATRIX SEWING";
  const rows = await fetchRange(tabName, undefined, 1615595156);
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[3])
    .map((row) => ({
      line: (row[1] || "").toString().trim().toUpperCase(),
      nik: row[2] || "",
      nama: row[3] || "",
      skill: row[4] || "",
      style: row[5] || "",
      smv: parseIdNumber(row[6]),
      targetSmv: parseIdNumber(row[7]),
      kapAct: parseIdNumber(row[8]),
    }));
}

/**
 * Decode 2 nomor seri yang tertera di glove:
 * Serial 1 (8 digit): Tahun(1) + No SPO(4) + No Proses(3)
 * Serial 2 (8 digit): No Urut Seri(3) + Bulan(2) + Kode Operator(3)
 */
export function decodeGloveSerial(serial1, serial2) {
  const s1 = String(serial1 || "").replace(/\s+/g, "");
  const s2 = String(serial2 || "").replace(/\s+/g, "");

  if (s1.length !== 8 || !/^\d{8}$/.test(s1)) {
    throw new Error("Nomor seri 1 harus 8 digit angka (contoh: 7 0639 435).");
  }
  if (s2.length !== 8 || !/^\d{8}$/.test(s2)) {
    throw new Error("Nomor seri 2 harus 8 digit angka (contoh: 136 07 070).");
  }

  return {
    tahun: s1.slice(0, 1),
    noSpo: s1.slice(1, 5),
    noProses: s1.slice(5, 8),
    kodeOperator: s2.slice(0, 3),
    bulan: s2.slice(3, 5),
    noUrutSeri: s2.slice(5, 8),
  };
}

/**
 * Lookup lengkap: decode serial -> cari nama operator cutting, cari box/line
 * di SPO TRACK berdasarkan 4 digit SPO, lalu cari operator sewing di line itu.
 */
export async function lookupGloveSerial(serial1, serial2) {
  const decoded = decodeGloveSerial(serial1, serial2);

  const [operatorList, spoTrackRows, skillSewingRows] = await Promise.all([
    getKodeOperatorCuttingList(),
    getSpoTrackData(),
    getSkillMatrixSewingData(),
  ]);

  const operator = operatorList.find((o) => String(o.kode).trim() === decoded.kodeOperator) || null;

  const matchedBoxes = spoTrackRows.filter((r) => {
    const spoDigits = String(r.spo).split("/")[0].trim();
    const boxLast3 = String(r.box).trim().slice(-3);
    return spoDigits === decoded.noSpo && boxLast3 === decoded.noProses;
  });

  // Fallback: kalau tidak ada box yang persis cocok (SPO + No Proses),
  // tampilkan semua box dengan SPO yang sama saja.
  const boxesForDisplay =
    matchedBoxes.length > 0
      ? matchedBoxes
      : spoTrackRows.filter((r) => String(r.spo).split("/")[0].trim() === decoded.noSpo);

  const lines = Array.from(new Set(boxesForDisplay.map((r) => r.line.toUpperCase()))).filter(Boolean);

  const sewingOperatorsByLine = {};
  for (const line of lines) {
    sewingOperatorsByLine[line] = skillSewingRows.filter((r) => r.line === line);
  }

  return {
    decoded,
    operatorCutting: operator,
    lines,
    matchedBoxes: boxesForDisplay,
    exactMatch: matchedBoxes.length > 0,
    sewingOperatorsByLine,
  };
}

/**
 * Daftar semua style unik dari STRONG POINT LINE (untuk dropdown referensi),
 * beserta rata-rata PA PAF dan efisiensi historis.
 */
export async function getStrongPointStyleOptions() {
  const groups = await getStrongPointData();

  return groups.map((g) => {
    const paPafValues = g.lines.map((l) => l.paPaf).filter((v) => v > 0);
    const effValues = g.lines
      .flatMap((l) => [l.effKanan, l.effKiri])
      .filter((v) => v > 0);
    const targetKananValues = g.lines.map((l) => l.targetKanan).filter((v) => v > 0);
    const targetKiriValues = g.lines.map((l) => l.targetKiri).filter((v) => v > 0);

    const avgPaPaf = paPafValues.length > 0 ? paPafValues.reduce((a, b) => a + b, 0) / paPafValues.length : 0;
    const avgEff = effValues.length > 0 ? effValues.reduce((a, b) => a + b, 0) / effValues.length : 0;
    const avgTargetKanan =
      targetKananValues.length > 0 ? targetKananValues.reduce((a, b) => a + b, 0) / targetKananValues.length : 0;
    const avgTargetKiri =
      targetKiriValues.length > 0 ? targetKiriValues.reduce((a, b) => a + b, 0) / targetKiriValues.length : 0;

    return {
      style: g.style,
      buyer: g.buyer,
      avgPaPaf,
      avgEfficiency: avgEff,
      avgTargetKanan,
      avgTargetKiri,
      lineCount: g.lines.length,
    };
  });
}

/**
 * Ambil SEMUA baris Kapasitas Cutting (bukan cuma kemarin) untuk hitung
 * rata-rata kapasitas per operator per style.
 */
export async function getKapasitasCuttingAll() {
  const tabName = process.env.GOOGLE_SHEET_TAB_KAPASITAS_CUTTING || "KAPASITAS CUTTING";
  const rows = await fetchRange(tabName, undefined, 1518550206);
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[0])
    .map((row) => ({
      tanggal: row[0] || "",
      line: row[1] || "",
      nik: row[2] || "",
      nama: row[3] || "",
      style: row[4] || "",
      kapasitas: parseIdNumber(row[5]),
    }));
}

/**
 * Rata-rata kapasitas cutting per operator untuk style tertentu (pencarian
 * substring, case-insensitive). Kalau tidak ada yang cocok, pakai rata-rata
 * keseluruhan sebagai fallback.
 */
export async function getAverageCuttingCapacity(styleName) {
  const allRows = await getKapasitasCuttingAll();
  const needle = (styleName || "").toLowerCase();

  const matching = allRows.filter((r) => r.style.toLowerCase().includes(needle) && r.kapasitas > 0);
  const pool = matching.length > 0 ? matching : allRows.filter((r) => r.kapasitas > 0);

  if (pool.length === 0) return { average: 0, sampleSize: 0, usedFallback: true };

  const average = pool.reduce((sum, r) => sum + r.kapasitas, 0) / pool.length;
  return { average, sampleSize: pool.length, usedFallback: matching.length === 0 };
}

/**
 * Rata-rata tingkat kehadiran dari seluruh data Data Absensi yang ada.
 */
export async function getAverageAttendanceRate() {
  const tabName = process.env.GOOGLE_SHEET_TAB_DATA_ABSENSI || "DATA ABSENSI";
  const rows = await fetchRange(tabName, "A:D");
  const [, ...body] = rows;

  const byDate = new Map();
  for (const row of body) {
    if (!row || !row[0]) continue;
    const tanggal = row[0];
    const jumlah = parseIdNumber(row[2]);
    const jumlahMp = parseIdNumber(row[3]);
    if (!byDate.has(tanggal)) byDate.set(tanggal, { absen: 0, mp: jumlahMp });
    byDate.get(tanggal).absen += jumlah;
  }

  const entries = Array.from(byDate.values()).filter((e) => e.mp > 0);
  if (entries.length === 0) return 100;

  const rates = entries.map((e) => ((e.mp - e.absen) / e.mp) * 100);
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/**
 * Bundle: ambil semua data WIP (3 tab sederhana + WIP Line Sewing) dalam
 * SATU batchGet, supaya tidak kena limit request per menit.
 */
export async function getWipRawBundle() {
  const distTab = process.env.GOOGLE_SHEET_TAB_WIP_DISTRIBUSI || "WIP DISTRIBUSI";
  const synthTab = process.env.GOOGLE_SHEET_TAB_WIP_CUTTING_SYNTHETIC || "WIP CUTTING SYNTHETIC";
  const kulitTab = process.env.GOOGLE_SHEET_TAB_WIP_CUTTING_KULIT || "WIP CUTTING KULIT";
  const lineTab = process.env.GOOGLE_SHEET_TAB_WIP_LINE_SEWING || "WIP LINE SEWING";

  const [distRows, synthRows, kulitRows, lineRows] = await batchFetchRanges([
    { tabName: distTab, range: "A:C", gid: 688373072 },
    { tabName: synthTab, range: "A:C", gid: 2051911938 },
    { tabName: kulitTab, range: "A:C", gid: 2062479432 },
    { tabName: lineTab, range: "A:I", gid: 586580262 },
  ]);

  const distribusi = await getSimpleWipRows(distTab, undefined, distRows);
  const cuttingSynthetic = await getSimpleWipRows(synthTab, undefined, synthRows);
  const cuttingKulit = await getSimpleWipRows(kulitTab, undefined, kulitRows);

  function summarize(rows) {
    const group = getYesterdayGroupRows(rows, "tanggal");
    const total = group.reduce((sum, r) => sum + r.totalWip, 0);
    const tanggal = group.length > 0 ? group[0].tanggal : null;
    return { total, tanggal };
  }

  const summary = {
    distribusi: summarize(distribusi),
    cuttingSynthetic: summarize(cuttingSynthetic),
    cuttingKulit: summarize(cuttingKulit),
  };

  const lineData = await getWipLineData(lineRows);

  return { summary, lineData };
}

/**
 * Bundle: ambil semua data Achievement Planning (Plan_SEWvsACT,
 * PLAN_DISTvsACT, gudang jadi) dalam SATU batchGet.
 */
export async function getAchievementRawBundle() {
  const sewTab = process.env.GOOGLE_SHEET_TAB_PLAN_SEW || "Plan_SEWvsACT";
  const distTab = process.env.GOOGLE_SHEET_TAB_PLAN_DIST || "PLAN_DISTvsACT";
  const gudangTab = process.env.GOOGLE_SHEET_TAB_GUDANG_JADI || "gudang jadi";

  const [sewRows, distRows, gudangRows] = await batchFetchRanges([
    { tabName: sewTab, gid: 840125565 },
    { tabName: distTab, gid: 1293384780 },
    { tabName: gudangTab, gid: 1051336247 },
  ]);

  const planSewRows = await getPlanSewData(sewRows);
  const planDistRows = await getPlanDistData(distRows);
  const gudangDetail = await getGudangJadiData(gudangRows);
  const gudangSummary = await getGudangJadiSummary(gudangRows);

  return { planSewRows, planDistRows, gudangDetail, gudangSummary };
}

/**
 * Bundle: ambil semua data Manpower dan Kapasitas (Jam Kerja, Absensi,
 * Kapasitas Cutting, Skill Matrik Cutting, Strong Point Line) dalam SATU batchGet.
 */
export async function getManpowerRawBundle() {
  const jamTab = process.env.GOOGLE_SHEET_TAB_JAM_KERJA || "JAM KERJA";
  const absensiTab = process.env.GOOGLE_SHEET_TAB_DATA_ABSENSI || "DATA ABSENSI";
  const kapasitasTab = process.env.GOOGLE_SHEET_TAB_KAPASITAS_CUTTING || "KAPASITAS CUTTING";
  const skillTab = process.env.GOOGLE_SHEET_TAB_SKILL_MATRIK_CUTTING || "SKILL MATRIK CUTTING";
  const strongTab = process.env.GOOGLE_SHEET_TAB_STRONG_POINT || "STRONG POINT LINE";

  const [jamRows, absensiRows, kapasitasRows, skillRows, strongRows] = await batchFetchRanges([
    { tabName: jamTab, range: "A:M" },
    { tabName: absensiTab, range: "A:D" },
    { tabName: kapasitasTab, gid: 1518550206 },
    { tabName: skillTab, gid: 1380483843 },
    { tabName: strongTab, gid: 1059453236 },
  ]);

  const jamKerja = await getJamKerjaYesterday(jamRows);
  const absensi = await getAbsensiYesterday(absensiRows);
  const kapasitasCutting = await getKapasitasCuttingTop10(kapasitasRows);
  const skillMatrik = await getSkillMatrikCuttingTop10(skillRows);
  const strongPoint = await getStrongPointData(strongRows);

  return { jamKerja, absensi, kapasitasCutting, skillMatrik, strongPoint };
}

/**
 * Tab "STYLE PROCES ISSUE PRODUKSI": No, Style, Buyer, Section
 * (Material/Accessories/Sewing), Critical Area/Component, Critical Point Description.
 * Poin kritis kualitas per style saat produksi.
 */
export async function getStyleIssueProduksi(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_ISSUE_PRODUKSI || "STYLE PROCES ISSUE PRODUKSI";
  const rows = preFetchedRows || (await fetchRange(tabName, "A:F", 722803210));
  const [, ...body] = rows;

  return body
    .filter((row) => row && row.length > 0 && row[1])
    .map((row) => ({
      style: row[1] || "",
      buyer: row[2] || "",
      section: row[3] || "",
      area: row[4] || "",
      description: row[5] || "",
    }));
}

/**
 * Tab "STYLE PROCES ISSUE CUTTING": No, Style, Karakter Material,
 * Penyelesaian Masalah, Poin Penting.
 * Catatan penanganan khusus material per style saat cutting.
 */
export async function getStyleIssueCutting(preFetchedRows) {
  const tabName = process.env.GOOGLE_SHEET_TAB_ISSUE_CUTTING || "STYLE PROCES ISSUE CUTTING";
  const rows = preFetchedRows || (await fetchRange(tabName, "A:E", 267775594));
  const [, ...body] = rows;

  // Kolom Style/Karakter Material di sheet ini kadang cuma diisi di baris pertama
  // per style (baris berikutnya kosong tapi masih 1 style yang sama) - isi turunan ke bawah.
  let lastStyle = "";
  return body
    .filter((row) => row && row.length > 0 && (row[1] || row[2]))
    .map((row) => {
      if (row[1]) lastStyle = row[1];
      return {
        style: lastStyle,
        karakterMaterial: row[2] || "",
        penyelesaianMasalah: row[3] || "",
        poinPenting: row[4] || "",
      };
    });
}

// Cocokkan baris berdasarkan nama style (exact dulu, fallback substring 2 arah).
function matchStyleRows(rows, style) {
  const needle = (style || "").toLowerCase().trim();
  if (!needle) return [];

  const exact = rows.filter((r) => (r.style || "").toLowerCase().trim() === needle);
  if (exact.length > 0) return exact;

  return rows.filter((r) => {
    const s = (r.style || "").toLowerCase().trim();
    return s && (s.includes(needle) || needle.includes(s));
  });
}

export async function getCriticalPointsForStyle(style, preFetchedProduksiRows, preFetchedCuttingRows) {
  const [produksiRows, cuttingRows] = await Promise.all([
    getStyleIssueProduksi(preFetchedProduksiRows),
    getStyleIssueCutting(preFetchedCuttingRows),
  ]);

  return {
    produksi: matchStyleRows(produksiRows, style),
    cutting: matchStyleRows(cuttingRows, style),
  };
}
