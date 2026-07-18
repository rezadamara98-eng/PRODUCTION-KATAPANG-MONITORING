import { NextResponse } from "next/server";
import {
  getStrongPointStyleOptions,
  getStrongPointData,
  getAverageAttendanceRate,
  getKodeOperatorCuttingList,
  getSkillCategoryForStyle,
  getAverageSkillCuttingCapacity,
  getSkillMatrikCuttingData,
  getCriticalPointsForStyle,
  getGudangJadiMpRatios,
  getSupplyMpRatios,
} from "@/lib/sheets";
import { calculateWorkingCapacity } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

// Simulasi opsi jumlah line (1 sampai baseline-1), hitung tambahan jam kerja
// yang dibutuhkan per hari supaya tetap selesai di deadline yang sama.
function simulateLineOptionsWithDeadline(qty, capacityPerHour, standardTotalHours, workingDays, baselineLines, attendanceFactor) {
  if (!qty || !capacityPerHour || baselineLines <= 1) return [];

  const options = [];
  for (let L = 1; L < baselineLines; L++) {
    const requiredTotalHoursPerLine = qty / (L * capacityPerHour * attendanceFactor);
    const additionalTotalHours = Math.max(0, requiredTotalHoursPerLine - standardTotalHours);
    const additionalHoursPerDay = workingDays > 0 ? additionalTotalHours / workingDays : 0;
    options.push({ lines: L, additionalHoursPerDay, additionalTotalHours });
  }
  return options;
}

// Mode tanpa deadline: opsi jumlah OPERATOR cutting, pakai kapasitas aktual
// operator terbaik (bukan rata-rata), supaya urutannya benar dari yang paling capable.
function computeHoursForOperatorOptions(qty, sortedOperators, attendanceFactor, maxOptions) {
  if (!qty || sortedOperators.length === 0) return [];

  const cap = Math.min(maxOptions, sortedOperators.length);
  const options = [];
  let cumulativeCapacity = 0;

  for (let L = 1; L <= cap; L++) {
    cumulativeCapacity += sortedOperators[L - 1].kapasitas;
    const totalHoursNeeded = qty / (cumulativeCapacity * attendanceFactor);
    options.push({
      operators: L,
      totalHoursNeeded,
      suggestedOperators: sortedOperators.slice(0, L),
    });
  }
  return options;
}

// Mode tanpa deadline: langsung hitung total jam dibutuhkan untuk tiap opsi
// jumlah line (1 sampai maksimal line yang tersedia historis untuk style itu).
function computeHoursForLineOptions(qty, capacityPerHour, attendanceFactor, maxLines) {
  if (!qty || !capacityPerHour || !maxLines || maxLines <= 0) return [];

  const options = [];
  for (let L = 1; L <= maxLines; L++) {
    const totalHoursNeeded = qty / (L * capacityPerHour * attendanceFactor);
    options.push({ lines: L, totalHoursNeeded });
  }
  return options;
}

export async function POST(req) {
  try {
    const { style, qtyKanan, qtyKiri, qtyWomen, startDate, finishDate } = await req.json();

    const qk = Number(qtyKanan) || 0;
    const qi = Number(qtyKiri) || 0;
    const qw = Number(qtyWomen) || 0;
    const qtyKananWomen = qk + qw;
    const totalQty = qk + qi + qw;

    if (!style || totalQty <= 0) {
      return NextResponse.json(
        { error: "Style dan minimal salah satu qty (Kanan/Kiri/Women) harus diisi." },
        { status: 400 }
      );
    }

    const hasDeadline = Boolean(startDate && finishDate);
    let start = null;
    let finish = null;

    if (hasDeadline) {
      start = new Date(startDate);
      finish = new Date(finishDate);
      if (isNaN(start.getTime()) || isNaN(finish.getTime()) || finish <= start) {
        return NextResponse.json(
          { error: "Tanggal selesai harus setelah tanggal mulai." },
          { status: 400 }
        );
      }
    }

    const skillCategory = getSkillCategoryForStyle(style);

    const [styleOptions, cuttingCap, attendanceRate, operatorList, strongPointGroups, skillMatrikRows] = await Promise.all([
      getStrongPointStyleOptions(),
      getAverageSkillCuttingCapacity(skillCategory),
      getAverageAttendanceRate(),
      getKodeOperatorCuttingList(),
      getStrongPointData(),
      getSkillMatrikCuttingData(),
    ]);

    const refStyle = styleOptions.find(
      (s) => s.style.toLowerCase() === style.toLowerCase()
    ) || styleOptions.find((s) => s.style.toLowerCase().includes(style.toLowerCase()));

    const attendanceFactor = attendanceRate / 100;

    const matchingGroup = refStyle
      ? strongPointGroups.find((g) => g.style.toLowerCase() === refStyle.style.toLowerCase())
      : null;
    const groupLines = matchingGroup ? matchingGroup.lines : [];

    function suggestLines(sortField, count) {
      if (!count || count <= 0) return [];
      return [...groupLines]
        .filter((l) => l[sortField] > 0)
        .sort((a, b) => b[sortField] - a[sortField])
        .slice(0, count)
        .map((l) => ({ line: l.line, capacity: l[sortField], efficiency: sortField === "targetKanan" ? l.effKanan : l.effKiri }));
    }

    function lineCapacityRange(sortField) {
      const values = groupLines.map((l) => l[sortField]).filter((v) => v > 0);
      if (values.length === 0) return null;
      return {
        highest: Math.max(...values),
        lowest: Math.min(...values),
        average: values.reduce((a, b) => a + b, 0) / values.length,
      };
    }

    const lineCapacityRangeKanan = lineCapacityRange("targetKanan");
    const lineCapacityRangeKiri = lineCapacityRange("targetKiri");

    const considerations = [];

    // Poin kritis (cutting & produksi) khusus untuk style ini.
    const criticalPoints = await getCriticalPointsForStyle(style);

    // Rentang kapasitas operator di kategori skill ini (tertinggi/terendah).
    let operatorCapacityRange = null;
    if (skillCategory) {
      const capsInCategory = skillMatrikRows.map((r) => r[skillCategory]).filter((v) => v > 0);
      if (capsInCategory.length > 0) {
        operatorCapacityRange = {
          highest: Math.max(...capsInCategory),
          lowest: Math.min(...capsInCategory),
        };
      }
    }

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

    if (!skillCategory) {
      considerations.push({
        type: "warning",
        text: `Style "${style}" tidak cocok dengan kategori skill manapun (Path & Thumb, Combo, Goat Skin, Sheep Skin, Premium). Kebutuhan operator cutting tidak bisa dihitung, mohon pastikan style/kategori sudah benar.`,
      });
    } else if (cuttingCap.sampleSize === 0) {
      considerations.push({
        type: "warning",
        text: `Tidak ada operator dengan skor > 0 di kategori "${skillCategory}" pada Skill Matrik Cutting. Kebutuhan operator tidak bisa dihitung.`,
      });
    } else {
      considerations.push({
        type: "ok",
        text: `Kategori skill terdeteksi: ${skillCategory}. Kapasitas dihitung dari rata-rata ${cuttingCap.sampleSize} operator yang punya skor > 0 di kategori ini.`,
      });
    }

    considerations.push({
      type: "info",
      text: "Perhitungan ini hanya mencakup proses cutting. Pastikan kapasitas sewing, finishing, dan ketersediaan material juga dicek terpisah.",
    });

    // ===== MODE TANPA DEADLINE =====
    if (!hasDeadline) {
      const maxLinesKananWomen = groupLines.filter((l) => l.targetKanan > 0).length;
      const maxLinesKiri = groupLines.filter((l) => l.targetKiri > 0).length;

      const optionsKananWomen = refStyle
        ? computeHoursForLineOptions(qtyKananWomen, refStyle.avgTargetKanan, attendanceFactor, maxLinesKananWomen).map((o) => ({
            ...o,
            suggestedLines: suggestLines("targetKanan", o.lines),
          }))
        : [];
      const optionsKiri = refStyle
        ? computeHoursForLineOptions(qi, refStyle.avgTargetKiri, attendanceFactor, maxLinesKiri).map((o) => ({
            ...o,
            suggestedLines: suggestLines("targetKiri", o.lines),
          }))
        : [];

      considerations.push({
        type: "info",
        text: "Tidak ada tanggal target, jadi hasil di bawah adalah total jam kerja dibutuhkan untuk tiap opsi jumlah line, tanpa batas waktu.",
      });

      let optionsOperators = [];
      if (skillCategory) {
        const sortedOperators = [...skillMatrikRows]
          .filter((r) => r[skillCategory] > 0)
          .sort((a, b) => b[skillCategory] - a[skillCategory])
          .map((r) => ({ nama: r.nama, kapasitas: r[skillCategory] }));
        optionsOperators = computeHoursForOperatorOptions(totalQty, sortedOperators, attendanceFactor, 10);
      }

      return NextResponse.json({
        mode: "no-deadline",
        qtyKanan: qk,
        qtyKiri: qi,
        qtyWomen: qw,
        qtyKananWomen,
        totalQty,
        attendanceRate,
        refStyle,
        skillCategory,
        avgCuttingCapacityPerHour: cuttingCap.average,
        operatorCapacityRange,
        lineCapacityRangeKanan,
        lineCapacityRangeKiri,
        criticalPoints,
        optionsKananWomen,
        optionsKiri,
        optionsOperators,
        considerations,
      });
    }

    // ===== MODE DENGAN DEADLINE (seperti sebelumnya) =====
    const { totalMinutes, workingDays } = calculateWorkingCapacity(start, finish);
    const totalHours = totalMinutes / 60;

    let linesKananWomen = null;
    let linesKiri = null;
    let capacityKananPerLine = null;
    let capacityKiriPerLine = null;

    if (refStyle) {
      if (refStyle.avgTargetKanan > 0) {
        capacityKananPerLine = refStyle.avgTargetKanan * totalHours * attendanceFactor;
        if (qtyKananWomen > 0) linesKananWomen = Math.ceil(qtyKananWomen / capacityKananPerLine);
      }
      if (refStyle.avgTargetKiri > 0) {
        capacityKiriPerLine = refStyle.avgTargetKiri * totalHours * attendanceFactor;
        if (qi > 0) linesKiri = Math.ceil(qi / capacityKiriPerLine);
      }
    }

    const simulationKananWomen = refStyle
      ? simulateLineOptionsWithDeadline(qtyKananWomen, refStyle.avgTargetKanan, totalHours, workingDays, linesKananWomen, attendanceFactor)
      : [];
    const simulationKiri = refStyle
      ? simulateLineOptionsWithDeadline(qi, refStyle.avgTargetKiri, totalHours, workingDays, linesKiri, attendanceFactor)
      : [];

    const capacityPerOperator = cuttingCap.average * totalHours * attendanceFactor;
    const operatorsNeeded = capacityPerOperator > 0 ? Math.ceil(totalQty / capacityPerOperator) : null;

    // MP Gudang Jadi: rate keseluruhan (pcs/jam) dari Total Qty / Total Jam,
    // diskalakan proporsional terhadap rasio standar (per Target pcs/jam).
    const gudangJadiRatios = await getGudangJadiMpRatios(style);
    let gudangJadiMp = null;
    if (gudangJadiRatios && gudangJadiRatios.target > 0 && totalHours > 0) {
      const ratePerHour = totalQty / totalHours;
      const factor = ratePerHour / gudangJadiRatios.target;
      gudangJadiMp = {
        ratePerHour,
        persiapan: Math.ceil(factor * gudangJadiRatios.persiapan),
        packingEnvelope: Math.ceil(factor * gudangJadiRatios.packingEnvelope),
        packingInnerCarton: Math.ceil(factor * gudangJadiRatios.packingInnerCarton),
      };
    }

    // MP Supply: rate sama dengan Gudang Jadi (Total Qty / Total Jam),
    // diskalakan proporsional terhadap rasio standar di KEBUTUHAN MP SUPPLY.
    const supplyRatios = await getSupplyMpRatios(style);
    let supplyMp = null;
    if (supplyRatios && supplyRatios.target > 0 && totalHours > 0) {
      const ratePerHour = totalQty / totalHours;
      const factor = ratePerHour / supplyRatios.target;
      supplyMp = {
        ratePerHour,
        cuttingSynthetic: Math.ceil(factor * supplyRatios.cuttingSynthetic),
        accessories: Math.ceil(factor * supplyRatios.accessories),
        m4: Math.ceil(factor * supplyRatios.m4),
        distribusi: Math.ceil(factor * supplyRatios.distribusi),
        presub: Math.ceil(factor * supplyRatios.presub),
      };
    }

    const suggestedLinesKananWomen = suggestLines("targetKanan", linesKananWomen);
    const suggestedLinesKiri = suggestLines("targetKiri", linesKiri);

    let suggestedOperators = [];
    if (skillCategory && operatorsNeeded) {
      suggestedOperators = [...skillMatrikRows]
        .filter((r) => r[skillCategory] > 0)
        .sort((a, b) => b[skillCategory] - a[skillCategory])
        .slice(0, operatorsNeeded)
        .map((r) => ({ nama: r.nama, kapasitas: r[skillCategory], job: r.job }));
    }

    if (operatorsNeeded && operatorsNeeded > operatorList.length) {
      considerations.push({
        type: "warning",
        text: `Kebutuhan ${operatorsNeeded} operator melebihi total ${operatorList.length} operator cutting yang terdaftar di sistem.`,
      });
    }

    return NextResponse.json({
      mode: "with-deadline",
      qtyKanan: qk,
      qtyKiri: qi,
      qtyWomen: qw,
      qtyKananWomen,
      totalQty,
      workingDays,
      totalHours,
      attendanceRate,
      refStyle,
      linesKananWomen,
      linesKiri,
      suggestedLinesKananWomen,
      suggestedLinesKiri,
      simulationKananWomen,
      simulationKiri,
      capacityKananPerLine,
      capacityKiriPerLine,
      operatorsNeeded,
      suggestedOperators,
      skillCategory,
      avgCuttingCapacityPerHour: cuttingCap.average,
      operatorCapacityRange,
      lineCapacityRangeKanan,
      lineCapacityRangeKiri,
      gudangJadiMp,
      supplyMp,
      criticalPoints,
      considerations,
    });
  } catch (err) {
    console.error("Capacity planner error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
