import { NextResponse } from "next/server";
import {
  getJamKerjaYesterday,
  getAbsensiYesterday,
  getKapasitasCuttingTop10,
  getSkillMatrikCuttingTop10,
  getStrongPointData,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [jamKerja, absensi, kapasitasCutting, skillMatrik, strongPoint] = await Promise.all([
      getJamKerjaYesterday(),
      getAbsensiYesterday(),
      getKapasitasCuttingTop10(),
      getSkillMatrikCuttingTop10(),
      getStrongPointData(),
    ]);

    return NextResponse.json({
      jamKerja,
      absensi,
      kapasitasCutting,
      skillMatrik,
      strongPoint,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gagal mengambil data Manpower dan Kapasitas:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data Manpower dan Kapasitas" },
      { status: 500 }
    );
  }
}
