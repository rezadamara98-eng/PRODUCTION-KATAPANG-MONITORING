import { NextResponse } from "next/server";
import {
  getPaData,
  getWipSummary,
  getPlanSewData,
  getPlanDistData,
  getGudangJadiSummary,
} from "@/lib/sheets";
import { getYesterdayGroupRows } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

async function buildContextSummary() {
  const [paRows, wipSummary, planSewRows, planDistRows, gudangSummary] = await Promise.all([
    getPaData().catch(() => []),
    getWipSummary().catch(() => null),
    getPlanSewData().catch(() => []),
    getPlanDistData().catch(() => []),
    getGudangJadiSummary().catch(() => null),
  ]);

  const latestPa = paRows.length > 0 ? paRows[paRows.length - 1] : null;
  const paText = latestPa
    ? `PA terbaru (${latestPa.tanggal}): Supply ${latestPa.supply.toFixed(2)}%, Sewing ${latestPa.sewing.toFixed(2)}%, Gudang Jadi ${latestPa.gudangJadi.toFixed(2)}%, Factory ${latestPa.factory.toFixed(2)}%.`
    : "Data PA belum tersedia.";

  const wipText = wipSummary
    ? `Total WIP kemarin: Distribusi ${wipSummary.distribusi.total}, Cutting Synthetic ${wipSummary.cuttingSynthetic.total}, Cutting Leather ${wipSummary.cuttingKulit.total}.`
    : "Data WIP belum tersedia.";

  const sewYesterday = getYesterdayGroupRows(planSewRows, "tanggal");
  const sewText =
    sewYesterday.length > 0
      ? `Achievement Sewing kemarin per Fact: ${sewYesterday.map((r) => `${r.fact} ${r.achv.toFixed(1)}%`).join(", ")}.`
      : "Data achievement sewing belum tersedia.";

  const distYesterday = getYesterdayGroupRows(planDistRows, "tanggal");
  const distText =
    distYesterday.length > 0
      ? `Achievement Distribusi kemarin per style: ${distYesterday.map((r) => `${r.style} (SPO ${r.spo}) ${r.achievement.toFixed(1)}%`).join(", ")}.`
      : "Data achievement distribusi belum tersedia.";

  const shipmentText = gudangSummary
    ? `Monitoring shipment (akumulasi): kekurangan produksi ${gudangSummary.totalKekuranganProduksi}, kekurangan envelope ${gudangSummary.totalKekuranganEnvelope}, qty shipment ${gudangSummary.totalQtyShipment}, qty shipment pack ${gudangSummary.totalQtyShipmentPack}.`
    : "Data shipment belum tersedia.";

  return `${paText}\n${wipText}\n${sewText}\n${distText}\n${shipmentText}\n\nCatatan: data absensi, jam kerja, kode operator cutting, dan kapasitas cutting belum terhubung ke sistem ini.`;
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
