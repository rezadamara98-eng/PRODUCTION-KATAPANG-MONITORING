import { NextResponse } from "next/server";
import { getGantiPolaTickets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tickets = await getGantiPolaTickets();
    return NextResponse.json({ tickets, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Gagal mengambil data Ganti Pola:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data Ganti Pola dari Google Sheets" },
      { status: 500 }
    );
  }
}
