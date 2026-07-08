import { NextResponse } from "next/server";
import { getPaData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPaData();
    return NextResponse.json({ data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data PA:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data PA dari Google Sheets" },
      { status: 500 }
    );
  }
}
