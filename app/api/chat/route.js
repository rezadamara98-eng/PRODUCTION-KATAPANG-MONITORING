import { NextResponse } from "next/server";
import {
  getPaData,
  getWipSummary,
  getWipLineData,
  getPlanSewData,
  getPlanDistData,
  getGudangJadiSummary,
  getOutputLineYesterday,
  getEffisiensiLineYesterday,
  getWipPresubAccessoriesSummary,
  getJamKerjaYesterday,
  getAbsensiYesterday,
  getKodeOperatorCuttingList,
  getKapasitasCuttingYesterday,
} from "@/lib/sheets";
import { getLastCompleteGroupRows } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

async function buildContextSummary() {
  const [
    paRows,
    wipSummary,
    wipLineData,
    planSewRows,
    planDistRows,
    gudangSummary,
    outputLine,
    effisiensiLine,
    wipPresubAccessories,
    jamKerja,
    absensiRows,
    operatorCuttingList,
    kapasitasCuttingRows,
  ] = await Promise.all([
    getPaData().catch(() => []),
    getWipSummary().catch(() => null),
    getWipLineData().catch(() => []),
    getPlanSewData().catch(() => []),
    getPlanDistData().catch(() => []),
    getGudangJadiSummary().catch(() => null),
    getOutputLineYesterday().catch(() => null),
    getEffisiensiLineYesterday().catch(() => null),
    getWipPresubAccessoriesSummary().catch(() => null),
    getJamKerjaYesterday().catch(() => null),
    getAbsensiYesterday().catch(() => []),
    getKodeOperatorCuttingList().catch(() => []),
    getKapasitasCuttingYesterday().catch(() => []),
  ]);

  const latestPa = paRows.length > 0 ? paRows[paRows.length - 1] : null;
  const paText = latestPa
    ? `PA terbaru (${latestPa.tanggal}): Supply ${safeFixed(latestPa.supply, 2)}%, Sewing ${safeFixed(latestPa.sewing, 2)}%, Gudang Jadi ${safeFixed(latestPa.gudangJadi, 2)}%, Factory ${safeFixed(latestPa.factory, 2)}%.`
    : "Data PA belum tersedia.";

  const wipText = wipSummary
    ? `Total WIP kemarin: Distribusi ${wipSummary.distribusi.total}, Cutting Synthetic ${wipSummary.cuttingSynthetic.total}, Cutting Leather ${wipSummary.cuttingKulit.total}.`
    : "Data WIP belum tersedia.";

  const wipPresubAccText = wipPresubAccessories
    ? `WIP Presub kemarin: ${wipPresubAccessories.presub.total}, WIP Accessories kemarin: ${wipPresubAccessories.accessories.total}.`
    : "Data WIP Presub/Accessories belum tersedia.";

  const wipLineSorted = [...wipLineData].sort((a, b) => b.totalWip - a.totalWip);
  const wipLineText =
    wipLineSorted.length > 0
      ? `WIP per Line Sewing kemarin (${wipLineSorted[0].tanggal}), diurutkan dari terbesar: ${wipLineSorted
          .map((l) => `${l.line} ${l.totalWip.toLocaleString("id-ID")} (${l.keterangan || "-"})`)
          .join(", ")}.`
      : "Data WIP per Line Sewing belum tersedia.";

  const outputLineText =
    outputLine && outputLine.lines.length > 0
      ? `Output per Line kemarin (${outputLine.tanggal}): ${outputLine.lines
          .map((l) => `${l.line} ${l.value.toLocaleString("id-ID")}`)
          .join(", ")}.`
      : "Data Output per Line belum tersedia.";

  const effisiensiLineText =
    effisiensiLine && effisiensiLine.lines.length > 0
      ? `Efisiensi per Line kemarin (${effisiensiLine.tanggal}): ${effisiensiLine.lines
          .map((l) => `${l.line} ${safeFixed(l.value, 1)}%`)
          .join(", ")}.`
      : "Data Efisiensi per Line belum tersedia.";

  const sewYesterday = getLastCompleteGroupRows(planSewRows, "tanggal", "achievement");
  const sewText =
    sewYesterday.length > 0
      ? `Achievement Sewing kemarin per style: ${sewYesterday.map((r) => `${r.style} (SPO ${r.spo}) ${safeFixed(r.achievement, 1)}%`).join(", ")}.`
      : "Data achievement sewing belum tersedia.";

  const distYesterday = getLastCompleteGroupRows(planDistRows, "tanggal", "achievement");
  const distText =
    distYesterday.length > 0
      ? `Achievement Distribusi kemarin per Fact: ${distYesterday.map((r) => `${r.fact} ${safeFixed(r.achievement, 1)}%`).join(", ")}.`
      : "Data achievement distribusi belum tersedia.";

  const shipmentText = gudangSummary
    ? `Monitoring shipment (akumulasi): kekurangan produksi ${gudangSummary.totalKekuranganProduksi}, kekurangan envelope ${gudangSummary.totalKekuranganEnvelope}, qty shipment ${gudangSummary.totalQtyShipment}, qty shipment pack ${gudangSummary.totalQtyShipmentPack}.`
    : "Data shipment belum tersedia.";

  const jamKerjaText = jamKerja
    ? `Jam Kerja kemarin (${jamKerja.tanggal}): Supply SM ${jamKerja.smSupply}/Aktual ${jamKerja.actualSupply}/Gap ${jamKerja.gapSupply}; Sewing SM ${jamKerja.smSewing}/Aktual ${jamKerja.actualSewing}/Gap ${jamKerja.gapSewing}; Gudang Jadi SM ${jamKerja.smGudangJadi}/Aktual ${jamKerja.actualGudangJadi}/Gap ${jamKerja.gapGudangJadi}; Support SM ${jamKerja.smSupport}/Aktual ${jamKerja.actualSupport}/Gap ${jamKerja.gapSupport}.`
    : "Data Jam Kerja belum tersedia.";

  const absensiText =
    absensiRows.length > 0
      ? `Absensi kemarin (${absensiRows[0].tanggal}), dari total ${absensiRows[0].jumlahMp} MP: ${absensiRows
          .map((r) => `${r.jenisAbsen} ${r.jumlah}`)
          .join(", ")}.`
      : "Data absensi belum tersedia.";

  const operatorCuttingText =
    operatorCuttingList.length > 0
      ? `Daftar kode operator cutting (untuk traceability reject, ${operatorCuttingList.length} operator): ${operatorCuttingList
          .map((o) => `${o.nama}=${o.kode}`)
          .join(", ")}.`
      : "Data kode operator cutting belum tersedia.";

  const kapasitasCuttingText =
    kapasitasCuttingRows.length > 0
      ? `Kapasitas Cutting kemarin (${kapasitasCuttingRows[0].tanggal}): ${kapasitasCuttingRows
          .map((r) => `${r.nama} (${r.line}) - style ${r.style}: kapasitas ${r.kapasitas}`)
          .join(", ")}.`
      : "Data Kapasitas Cutting belum tersedia.";

  return [
    paText,
    wipText,
    wipPresubAccText,
    wipLineText,
    outputLineText,
    effisiensiLineText,
    sewText,
    distText,
    shipmentText,
    jamKerjaText,
    absensiText,
    operatorCuttingText,
    kapasitasCuttingText,
  ].join("\n");
}

export async function POST(req) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY belum diset di environment variable." },
        { status: 500 }
      );
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
    }

    const contextSummary = await buildContextSummary();

    const systemPrompt = `Kamu adalah ASIK, asisten AI analisa produksi untuk pabrik Katapang.
Jawab pertanyaan berdasarkan data berikut. Jika data yang ditanyakan belum tersedia,
katakan terus terang bahwa data itu belum terhubung, jangan mengarang angka.
Untuk pertanyaan soal reject/traceability, gunakan daftar kode operator cutting untuk
mencocokkan nama operator dengan kodenya.

${contextSummary}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", errBody);
      return NextResponse.json({ error: "Gagal menghubungi Claude API." }, { status: 502 });
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();

    return NextResponse.json({ reply: text || "(tidak ada respon)" });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
