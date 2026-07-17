import { NextResponse } from "next/server";
import { getStrongPointStyleOptions } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const styles = await getStrongPointStyleOptions();
    return NextResponse.json({ styles });
  } catch (err) {
    console.error("Gagal mengambil daftar style:", err);
    return NextResponse.json({ error: err.message || "Gagal mengambil daftar style" }, { status: 500 });
  }
}
