import { NextResponse } from "next/server";
import { getWipAccessories, backfillWipAccRekapIfMissing } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Semua catatan WIP Accessories + qty per tahap (dihitung dari log PROGRES).
export async function GET() {
  try {
    const items = await getWipAccessories();
    await backfillWipAccRekapIfMissing();
    return NextResponse.json({ items, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data WIP Accessories:", err);
    return NextResponse.json({ error: err.message || "Gagal mengambil data WIP Accessories." }, { status: 500 });
  }
}
