import { NextResponse } from "next/server";
import { getWipSummary, getWipLineData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [summary, lineData] = await Promise.all([getWipSummary(), getWipLineData()]);
    return NextResponse.json({ summary, lineData, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data WIP:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data WIP dari Google Sheets" },
      { status: 500 }
    );
  }
}
