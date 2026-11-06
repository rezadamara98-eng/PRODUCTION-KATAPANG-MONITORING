import { NextResponse } from "next/server";
import { getMemoMaterialMemos } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Semua memo material + status (dihitung dari baris keputusan 3R dan PPIC).
export async function GET() {
  try {
    const memos = await getMemoMaterialMemos();
    return NextResponse.json({ memos, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data Memo Material:", err);
    return NextResponse.json({ error: err.message || "Gagal mengambil data Memo Material." }, { status: 500 });
  }
}
