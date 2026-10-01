import { NextResponse } from "next/server";
import { appendGantiPolaPermintaan } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Production Sewing mengajukan satu atau beberapa baris (SPO x Size) sekaligus
// untuk satu Line, dalam satu kali klik.
export async function POST(request) {
  try {
    const body = await request.json();
    const { line, rows } = body || {};
    const ids = await appendGantiPolaPermintaan(line, rows);
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    console.error("Gagal mengajukan permintaan Ganti Pola:", err);
    return NextResponse.json({ error: err.message || "Gagal mengajukan permintaan." }, { status: 400 });
  }
}
