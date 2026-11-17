import { NextResponse } from "next/server";
import { appendWipAccProgres } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Tahap Persiapan / Sewing / Output / Alokasi: body { id, tahap, qty, line? }
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await appendWipAccProgres(body.id, body.tahap, body.qty, body.line);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Gagal mencatat progres WIP Accessories:", err);
    return NextResponse.json({ error: err.message || "Gagal mencatat progres." }, { status: 400 });
  }
}
