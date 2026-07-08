import { NextResponse } from "next/server";
import { getStrongPointData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getStrongPointData();
    return NextResponse.json({ data, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data Strong Point Line:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data Strong Point Line dari Google Sheets" },
      { status: 500 }
    );
  }
}
