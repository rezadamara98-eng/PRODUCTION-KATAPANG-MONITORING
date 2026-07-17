import { NextResponse } from "next/server";
import {
  getStrongPointStyleOptions,
  getAverageCuttingCapacity,
  getAverageAttendanceRate,
  getKodeOperatorCuttingList,
} from "@/lib/sheets";
import { calculateWorkingCapacity } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { style, qty, startDate, finishDate } = await req.json();

    if (!style || !qty || !startDate || !finishDate) {
      return NextResponse.json(
        { error: "Style, qty, tanggal mulai, dan tanggal selesai harus diisi." },
        { status: 400 }
      );
    }

    const totalQty = Number(qty);
    const start = new Date(startDate);
    const finish = new Date(finishDate);

    if (!Number.isFinite(totalQty) || totalQty <= 0) {
      return NextResponse.json({ error: "Qty harus berupa angka lebih dari 0." }, { status: 400 });
    }
    if (isNaN(start.getTime()) || isNaN(finish.getTime()) || finish <= start) {
      return NextResponse.json(
        { error: "Tanggal selesai harus setelah tanggal mulai." },
        { status: 400 }
      );
    }

    const [styleOptions, cuttingCap, attendanceRate, operatorList] = await Promise.all([
      getStrongPointStyleOptions(),
      getAverageCuttingCapacity(style),
      getAverageAttendanceRate(),
      getKodeOperatorCuttingList(),
    ]);

    const refStyle = styleOptions.find(
      (s) => s.style.toLowerCase() === style.toLowerCase()
    ) || styleOptions.find((s) => s.style.toLowerCase().includes(style.toLowerCase()));

    const { totalMinutes, workingDays } = calculateWorkingCapacity(start, finish);
    const attendanceFactor = attendanceRate / 100;

    // Kapasitas line: menit tersedia / PA PAF (waktu standar per unit),
    // dikali faktor kehadiran sebagai buffer realistis.
    let linesNeeded = null;
    let capacityPerLine = null;
    if (refStyle && refStyle.avgPaPaf > 0) {
      capacityPerLine = (totalMinutes / refStyle.avgPaPaf) * attendanceFactor;
      linesNeeded = Math.ceil(totalQty / capacityPerLine);
    }

    // Kapasitas cutting: kapasitas rata-rata per operator per hari x jumlah hari kerja x faktor kehadiran.
    const capacityPerOperator = cuttingCap.average * workingDays * attendanceFactor;
    const operatorsNeeded = capacityPerOperator > 0 ? Math.ceil(totalQty / capacityPerOperator) : null;

    const considerations = [];
    if (refStyle) {
      considerations.push({
        type: refStyle.avgEfficiency >= 95 ? "ok" : "warning",
        text: `Efisiensi historis untuk style referensi "${refStyle.style}" rata-rata ${refStyle.avgEfficiency.toFixed(1)}% dari ${refStyle.lineCount} line yang pernah mengerjakan.`,
      });
    } else {
      considerations.push({
        type: "warning",
        text: `Tidak ditemukan style yang persis sama di data historis. Perhitungan mungkin kurang akurat, pertimbangkan pilih style referensi manual.`,
      });
    }

    considerations.push({
      type: "ok",
      text: `Perhitungan sudah menyertakan estimasi tingkat kehadiran rata-rata ${attendanceRate.toFixed(1)}% dari data historis.`,
    });

    if (cuttingCap.usedFallback) {
      considerations.push({
        type: "warning",
        text: `Tidak ada data kapasitas cutting khusus untuk style ini, dipakai rata-rata keseluruhan operator (${cuttingCap.sampleSize} sampel).`,
      });
    }

    if (operatorsNeeded && operatorsNeeded > operatorList.length) {
      considerations.push({
        type: "warning",
        text: `Kebutuhan ${operatorsNeeded} operator melebihi total ${operatorList.length} operator cutting yang terdaftar di sistem.`,
      });
    }

    considerations.push({
      type: "info",
      text: "Perhitungan ini hanya mencakup proses cutting. Pastikan kapasitas sewing, finishing, dan ketersediaan material juga dicek terpisah.",
    });

    return NextResponse.json({
      totalQty,
      workingDays,
      totalMinutes,
      attendanceRate,
      refStyle,
      linesNeeded,
      capacityPerLine,
      operatorsNeeded,
      capacityPerOperatorTotal: capacityPerOperator,
      avgCuttingCapacityPerDay: cuttingCap.average,
      considerations,
    });
  } catch (err) {
    console.error("Capacity planner error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
