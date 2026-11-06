import { NextResponse } from "next/server";
import { appendMemoPermintaan } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Tahap 1: ajukan satu atau beberapa memo material sekaligus.
export async function POST(request) {
  try {
    const body = await request.json();
    const ids = await appendMemoPermintaan(body && body.rows);
    return NextResponse.json({ ok: true, ids });
  } catch (err) {
    console.error("Gagal mengajukan Memo Material:", err);
    return NextResponse.json({ error: err.message || "Gagal mengajukan memo." }, { status: 400 });
  }
}
