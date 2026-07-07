import { NextResponse } from "next/server";
import { getProductionData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function buildContextSummary(rows) {
  if (!rows.length) return "Belum ada data produksi yang tersedia.";

  const totals = rows.reduce(
    (acc, r) => {
      acc.output += r.output;
      acc.target += r.target;
      acc.reject += r.reject;
      return acc;
    },
    { output: 0, target: 0, reject: 0 }
  );

  const perLini = new Map();
  for (const r of rows) {
    if (!perLini.has(r.lini)) perLini.set(r.lini, { output: 0, target: 0, reject: 0 });
    const e = perLini.get(r.lini);
    e.output += r.output;
    e.target += r.target;
    e.reject += r.reject;
  }

  const liniSummary = Array.from(perLini.entries())
    .map(([lini, v]) => {
      const eff = v.target > 0 ? ((v.output / v.target) * 100).toFixed(1) : "0";
      return `- ${lini}: output ${v.output}, target ${v.target}, reject ${v.reject}, efisiensi ${eff}%`;
    })
    .join("\n");

  const efisiensi = totals.target > 0 ? ((totals.output / totals.target) * 100).toFixed(1) : "0";
  const rejectRate = totals.output > 0 ? ((totals.reject / totals.output) * 100).toFixed(1) : "0";

  return `Ringkasan data produksi (gabungan semua lini):
Total output: ${totals.output}
Total target: ${totals.target}
Total reject: ${totals.reject}
Efisiensi keseluruhan: ${efisiensi}%
Reject rate keseluruhan: ${rejectRate}%

Ringkasan per lini/mesin:
${liniSummary}

Catatan: data absensi, jam kerja, dan planning belum terhubung ke sistem ini.`;
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

    const productionRows = await getProductionData().catch(() => []);
    const contextSummary = buildContextSummary(productionRows);

    const systemPrompt = `Kamu adalah ASIK, asisten AI analisa produksi untuk pabrik Katapang.
Jawab pertanyaan berdasarkan data berikut. Jika data yang ditanyakan belum tersedia
(misalnya absensi, jam kerja, atau planning detail), katakan terus terang bahwa data
itu belum terhubung, jangan mengarang angka.

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
      return NextResponse.json(
        { error: "Gagal menghubungi Claude API." },
        { status: 502 }
      );
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
