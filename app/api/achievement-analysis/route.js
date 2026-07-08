import { NextResponse } from "next/server";
import { getPlanDistData, getGudangJadiData, getGudangJadiSummary, getPlanSewData } from "@/lib/sheets";
import { getYesterdayGroupRows } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

function topShortages(rows, field, n = 3) {
  return rows
    .filter((r) => r[field] < 0)
    .sort((a, b) => a[field] - b[field])
    .slice(0, n);
}

export async function GET() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY belum diset di environment variable." },
        { status: 500 }
      );
    }

    const [planSewRows, planDistRows, gudangRows, gudangSummary] = await Promise.all([
      getPlanSewData(),
      getPlanDistData(),
      getGudangJadiData(),
      getGudangJadiSummary(),
    ]);

    const sewYesterday = getYesterdayGroupRows(planSewRows, "tanggal");
    const distYesterday = getYesterdayGroupRows(planDistRows, "tanggal");

    const lowAchievementStyles = distYesterday
      .filter((r) => r.achievement < 100)
      .sort((a, b) => a.achievement - b.achievement)
      .slice(0, 3);

    const topKekuranganProduksi = topShortages(gudangRows, "kekuranganProduksi");
    const topKekuranganEnvelope = topShortages(gudangRows, "kekuranganEnvelope");

    const dataSummary = `Data Achievement Planning (data kemarin, kecuali disebutkan lain):

Achievement Sewing per Fact (dari Plan_SEWvsACT):
${sewYesterday.map((r) => `- ${r.fact}: plan ${r.plan}, aktual ${r.actual}, achv ${r.achv.toFixed(1)}%`).join("\n") || "Tidak ada data"}

Style/SPO dengan achievement distribusi terendah (dari PLAN_DISTvsACT):
${lowAchievementStyles.map((r) => `- SPO ${r.spo} - ${r.style} (line ${r.line}): achievement ${r.achievement.toFixed(1)}%, gap ${r.gap}`).join("\n") || "Tidak ada yang di bawah 100%"}

SPO/style dengan kekurangan produksi terbesar (dari gudang jadi, akumulasi):
${topKekuranganProduksi.map((r) => `- SPO ${r.spo} - ${r.style}: kekurangan ${r.kekuranganProduksi}`).join("\n") || "Tidak ada kekurangan"}

SPO/style dengan kekurangan envelope terbesar (dari gudang jadi, akumulasi):
${topKekuranganEnvelope.map((r) => `- SPO ${r.spo} - ${r.style}: kekurangan ${r.kekuranganEnvelope}`).join("\n") || "Tidak ada kekurangan"}

Total keseluruhan: kekurangan produksi ${gudangSummary.totalKekuranganProduksi}, kekurangan envelope ${gudangSummary.totalKekuranganEnvelope}, qty shipment ${gudangSummary.totalQtyShipment}, qty shipment pack ${gudangSummary.totalQtyShipmentPack}.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system:
          "Kamu adalah analis produksi pabrik Katapang. Tulis analisa singkat dalam 1-2 paragraf bahasa Indonesia (bukan poin-poin), menjelaskan kenapa achievement di bawah 100% dan SPO/style mana saja penyebab kekurangan produksi/envelope, lalu tutup dengan 1-2 saran konkret untuk mencegah kekurangan serupa. Sebutkan nama SPO/style secara eksplisit kalau ada di data. Jangan mengarang angka di luar data yang diberikan.",
        messages: [{ role: "user", content: dataSummary }],
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

    return NextResponse.json({ analysis: text || "(tidak ada analisa)" });
  } catch (err) {
    console.error("Achievement analysis error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
