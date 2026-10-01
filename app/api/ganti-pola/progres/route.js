import { NextResponse } from "next/server";
import { appendGantiPolaProgres } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Preparation atau Presub mencatat qty yang baru selesai dikerjakan untuk satu
// tiket (boleh dicicil - tidak harus sekaligus sama dengan sisa qty).
export async function POST(request) {
  try {
    const body = await request.json();
    const { ticketId, station, qty, catatan } = body || {};
    const result = await appendGantiPolaProgres(ticketId, station, qty, catatan);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Gagal mencatat progres Ganti Pola:", err);
    return NextResponse.json({ error: err.message || "Gagal mencatat progres." }, { status: 400 });
  }
}
