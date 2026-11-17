import { NextResponse } from "next/server";
import { appendWipAccIn } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Tahap In Material: body { rows: [{ spo, size, qty }] }
export async function POST(request) {
  try {
    const body = await request.json();
    const results = await appendWipAccIn(body.rows);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("Gagal mencatat In Material WIP Accessories:", err);
    return NextResponse.json({ error: err.message || "Gagal mencatat In Material." }, { status: 400 });
  }
}
