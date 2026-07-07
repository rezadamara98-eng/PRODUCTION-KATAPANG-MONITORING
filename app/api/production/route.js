import { NextResponse } from "next/server";
import { getProductionData } from "@/lib/sheets";

// Selalu ambil data terbaru saat di-request, jangan di-cache statis.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getProductionData();
    return NextResponse.json({ data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data produksi:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data dari Google Sheets" },
      { status: 500 }
    );
  }
}
