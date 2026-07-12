import { google } from "googleapis";
import { getYesterdayGroupRows, getYesterdayRow } from "./dateUtils";

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
async function getSimpleWipRows(tabName, gid) {
  const rows = await fetchRange(tabName, "A:C", gid);
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
export async function getWipLineData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_WIP_LINE_SEWING || "WIP LINE SEWING";
  const rows = await fetchRange(tabName, "A:I", 586580262);
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
export async function getPlanSewData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_PLAN_SEW || "Plan_SEWvsACT";
  const rows = await fetchRange(tabName, undefined, 840125565);
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
export async function getPlanDistData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_PLAN_DIST || "PLAN_DISTvsACT";
  const rows = await fetchRange(tabName, undefined, 1293384780);
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
export async function getGudangJadiData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_GUDANG_JADI || "gudang jadi";
  const rows = await fetchRange(tabName, undefined, 1051336247);
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
export async function getJamKerjaYesterday() {
  const tabName = process.env.GOOGLE_SHEET_TAB_JAM_KERJA || "JAM KERJA";
  const rows = await fetchRange(tabName, "A:M");
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

  return getYesterdayRow(allRows, "tanggal");
}

/**
 * Tab "DATA ABSENSI": Tanggal, Jenis Absen, Jumlah, Jumlah MP.
 * Beberapa baris per tanggal (satu per jenis absen).
 */
export async function getAbsensiYesterday() {
  const tabName = process.env.GOOGLE_SHEET_TAB_DATA_ABSENSI || "DATA ABSENSI";
  const rows = await fetchRange(tabName, "A:D");
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
export async function getKapasitasCuttingYesterday() {
  const tabName = process.env.GOOGLE_SHEET_TAB_KAPASITAS_CUTTING || "KAPASITAS CUTTING";
  const rows = await fetchRange(tabName, undefined, 1518550206);
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
export async function getKapasitasCuttingTop10() {
  const rows = await getKapasitasCuttingYesterday();
  return [...rows].sort((a, b) => b.kapasitas - a.kapasitas).slice(0, 10);
}

/**
 * Tab "STRONG POINT LINE": tabel detail per Buyer/Style/Line.
 * Baris 1 = judul gabungan (dilewati), baris 2 = header asli, baris 3+ = data.
 * Dikelompokkan per Style -> daftar Line yang mengerjakan style itu.
 */
export async function getStrongPointData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_STRONG_POINT || "STRONG POINT LINE";
  const rows = await fetchRange(tabName, undefined, 1059453236);
  const body = rows.slice(2);

  const rawRows = body
    .filter((row) => row && row.length > 0 && (row[1] || row[4]))
    .map((row) => ({
      buyer: row[0] || "",
      style: row[1] || "(Tanpa nama style)",
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
export async function getSkillMatrikCuttingData() {
  const tabName = process.env.GOOGLE_SHEET_TAB_SKILL_MATRIK_CUTTING || "SKILL MATRIK CUTTING";
  const rows = await fetchRange(tabName, undefined, 1380483843);
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
export async function getSkillMatrikCuttingTop10() {
  const rows = await getSkillMatrikCuttingData();
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
    .filter((row) => row && row.length > 0 && row[2])
    .map((row) => ({
      line: row[0] || "",
      box: row[2] || "",
      spo: row[3] || "",
      product: row[4] || "",
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
    .filter((row) => row && row.length > 0 && row[4])
    .map((row) => ({
      line: (row[1] || "").toString().trim().toUpperCase(),
      nik: row[3] || "",
      nama: row[4] || "",
      skill: row[5] || "",
      style: row[6] || "",
      smv: parseIdNumber(row[7]),
      targetSmv: parseIdNumber(row[8]),
      kapAct: parseIdNumber(row[9]),
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
    noUrutSeri: s2.slice(0, 3),
    bulan: s2.slice(3, 5),
    kodeOperator: s2.slice(5, 8),
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
    return spoDigits === decoded.noSpo;
  });

  const lines = Array.from(new Set(matchedBoxes.map((r) => r.line.toUpperCase()))).filter(Boolean);

  const sewingOperatorsByLine = {};
  for (const line of lines) {
    sewingOperatorsByLine[line] = skillSewingRows.filter((r) => r.line === line);
  }

  return {
    decoded,
    operatorCutting: operator,
    lines,
    matchedBoxes,
    sewingOperatorsByLine,
  };
}
