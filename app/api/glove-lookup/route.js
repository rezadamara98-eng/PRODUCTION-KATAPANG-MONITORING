import { NextResponse } from "next/server";
import { lookupGloveSerial } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { serial1, serial2 } = await req.json();
    if (!serial1 || !serial2) {
      return NextResponse.json({ error: "Kedua nomor seri harus diisi." }, { status: 400 });
    }

    const result = await lookupGloveSerial(serial1, serial2);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Glove lookup error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 400 });
  }
}
