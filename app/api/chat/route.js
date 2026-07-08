import { NextResponse } from "next/server";
import { getPaData, getStrongPointData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function buildContextSummary(paRows, strongPointGroups) {
  let paSummary = "Data PA belum tersedia.";
  if (paRows.length > 0) {
    const latest = paRows[paRows.length - 1];
    const n = paRows.length;
    const avg = paRows.reduce(
      (acc, r) => {
        acc.supply += r.supply;
        acc.sewing += r.sewing;
        acc.gudangJadi += r.gudangJadi;
        acc.factory += r.factory;
        return acc;
      },
      { supply: 0, sewing: 0, gudangJadi: 0, factory: 0 }
    );
    paSummary = `Data PA (Performance Achievement) per departemen, terbaru tanggal ${latest.tanggal}:
- PA Supply: ${latest.supply.toFixed(2)}% (rata-rata ${(avg.supply / n).toFixed(2)}%)
- PA Sewing: ${latest.sewing.toFixed(2)}% (rata-rata ${(avg.sewing / n).toFixed(2)}%)
- PA Gudang Jadi: ${latest.gudangJadi.toFixed(2)}% (rata-rata ${(avg.gudangJadi / n).toFixed(2)}%)
- PA Factory: ${latest.factory.toFixed(2)}% (rata-rata ${(avg.factory / n).toFixed(2)}%)
Total ${n} baris data historis tersedia.`;
  }

  let strongPointSummary = "Data Strong Point Line belum tersedia.";
  if (strongPointGroups.length > 0) {
    const lines = strongPointGroups
      .map((g) => {
        const lineList = g.lines
          .map(
            (l) =>
              `${l.line} (target kanan ${l.targetKanan}, target kiri ${l.targetKiri}, efisiensi kanan ${l.effKanan.toFixed(1)}%, efisiensi kiri ${l.effKiri.toFixed(1)}%)`
          )
          .join("; ");
        return `- Style "${g.style}" (buyer: ${g.buyer || "-"}): dikerjakan oleh line ${lineList}`;
      })
      .join("\n");
    strongPointSummary = `Data Strong Point Line (kapasitas line per style):\n${lines}`;
  }

  return `${paSummary}\n\n${strongPointSummary}\n\nCatatan: data absensi, jam kerja, WIP, dan planning distribusi belum terhubung ke sistem ini.`;
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

    const [paRows, strongPointGroups] = await Promise.all([
      getPaData().catch(() => []),
      getStrongPointData().catch(() => []),
    ]);
    const contextSummary = buildContextSummary(paRows, strongPointGroups);

    const systemPrompt = `Kamu adalah ASIK, asisten AI analisa produksi untuk pabrik Katapang.
Jawab pertanyaan berdasarkan data berikut. Jika data yang ditanyakan belum tersedia
(misalnya absensi, jam kerja, WIP, atau detail planning distribusi), katakan terus terang
bahwa data itu belum terhubung, jangan mengarang angka.

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
