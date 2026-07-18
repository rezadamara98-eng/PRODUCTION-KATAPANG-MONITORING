import { NextResponse } from "next/server";
import { getAchievementRawBundle } from "@/lib/sheets";
import { getLastCompleteGroupRows } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { planSewRows, planDistRows, gudangDetail, gudangSummary } = await getAchievementRawBundle();

    const sewYesterday = getLastCompleteGroupRows(planSewRows, "tanggal", "achievement");
    const validSew = sewYesterday.filter((r) => Number.isFinite(r.achievement) && r.achievement > 0);
    const achievementSewing =
      validSew.length > 0 ? validSew.reduce((sum, r) => sum + r.achievement, 0) / validSew.length : 0;

    const distYesterday = getLastCompleteGroupRows(planDistRows, "tanggal", "achievement");
    const validDist = distYesterday.filter((r) => Number.isFinite(r.achievement) && r.achievement > 0);
    const achievementDistribusi =
      validDist.length > 0 ? validDist.reduce((sum, r) => sum + r.achievement, 0) / validDist.length : 0;

    // Daftar SPO yang kekurangan produksi dan/atau envelope, diurutkan dari yang paling parah.
    const shipmentDetail = gudangDetail
      .filter((r) => r.kekuranganProduksi < 0 || r.kekuranganEnvelope < 0)
      .sort((a, b) => a.kekuranganProduksi + a.kekuranganEnvelope - (b.kekuranganProduksi + b.kekuranganEnvelope))
      .map((r) => ({
        spo: r.spo,
        style: r.style,
        kekuranganProduksi: r.kekuranganProduksi,
        kekuranganEnvelope: r.kekuranganEnvelope,
      }));

    return NextResponse.json({
      achievementSewing,
      achievementDistribusi,
      sewYesterday,
      distYesterday,
      shipment: gudangSummary,
      shipmentDetail,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gagal mengambil data Achievement Planning:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data Achievement Planning" },
      { status: 500 }
    );
  }
}
