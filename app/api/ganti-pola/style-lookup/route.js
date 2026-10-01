import { NextResponse } from "next/server";
import { getSpoStyleMap } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Lookup read-only SPO -> Style dari tab "data base SPO & STYLE", dipakai
// untuk auto-tampil nama Style begitu Sewing mengetik No. SPO di form.
export async function GET() {
  try {
    const styleBySpo = await getSpoStyleMap();
    return NextResponse.json({ styleBySpo, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data SPO & Style:", err);
    return NextResponse.json({ error: err.message || "Gagal mengambil data SPO & Style" }, { status: 500 });
  }
}
