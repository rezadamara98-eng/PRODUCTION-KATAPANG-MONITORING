import { NextResponse } from "next/server";
import { appendMemoKeputusan } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Tahap 2 (3R) dan tahap 3 (PPIC): Acc atau Tolak satu memo.
export async function POST(request) {
  try {
    const body = await request.json();
    const { memoId, tahap, keputusan, alasan } = body || {};
    const result = await appendMemoKeputusan(memoId, tahap, keputusan, alasan);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Gagal mencatat keputusan Memo Material:", err);
    return NextResponse.json({ error: err.message || "Gagal mencatat keputusan." }, { status: 400 });
  }
}
