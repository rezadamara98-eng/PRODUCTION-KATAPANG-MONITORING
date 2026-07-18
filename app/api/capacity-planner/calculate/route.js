import { NextResponse } from "next/server";
import {
  getStrongPointStyleOptions,
  getStrongPointData,
  getAverageAttendanceRate,
  getKodeOperatorCuttingList,
  getSkillCategoryForStyle,
  getAverageSkillCuttingCapacity,
  getSkillMatrikCuttingData,
} from "@/lib/sheets";
import { calculateWorkingCapacity } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

// Simulasi opsi jumlah line (1 sampai baseline-1), hitung tambahan jam kerja
// yang dibutuhkan per hari supaya tetap selesai di deadline yang sama.
function simulateLineOptions(qty, capacityPerHour, standardTotalHours, workingDays, baselineLines, attendanceFactor) {
  if (!qty || !capacityPerHour || baselineLines <= 1) return [];

  const options = [];
  for (let L = 1; L < baselineLines; L++) {
    const requiredTotalHoursPerLine = qty / (L * capacityPerHour * attendanceFactor);
    const additionalTotalHours = Math.max(0, requiredTotalHoursPerLine - standardTotalHours);
    const additionalHoursPerDay = workingDays > 0 ? additionalTotalHours / workingDays : 0;
    options.push({
      lines: L,
      additionalHoursPerDay,
      additionalTotalHours,
    });
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

    if (!style || totalQty <= 0 || !startDate || !finishDate) {
      return NextResponse.json(
        { error: "Style, minimal salah satu qty (Kanan/Kiri/Women), tanggal mulai, dan tanggal selesai harus diisi." },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const finish = new Date(finishDate);

    if (isNaN(start.getTime()) || isNaN(finish.getTime()) || finish <= start) {
      return NextResponse.json(
        { error: "Tanggal selesai harus setelah tanggal mulai." },
        { status: 400 }
      );
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

    const { totalMinutes, workingDays } = calculateWorkingCapacity(start, finish);
    const totalHours = totalMinutes / 60;
    const attendanceFactor = attendanceRate / 100;

    // Kapasitas per line per JAM diambil LANGSUNG dari Target Kanan (kolom F,
    // dipakai juga untuk Women) dan Target Kiri (kolom G) di Strong Point Line.
    // Kanan + Women digabung jadi satu kebutuhan line (sumber kapasitas sama),
    // Kiri dihitung terpisah.
    let linesKananWomen = null;
    let linesKiri = null;
    let capacityKananPerLine = null; // total kapasitas 1 line selama periode (Kanan/Women)
    let capacityKiriPerLine = null; // total kapasitas 1 line selama periode (Kiri)

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
      ? simulateLineOptions(qtyKananWomen, refStyle.avgTargetKanan, totalHours, workingDays, linesKananWomen, attendanceFactor)
      : [];
    const simulationKiri = refStyle
      ? simulateLineOptions(qi, refStyle.avgTargetKiri, totalHours, workingDays, linesKiri, attendanceFactor)
      : [];

    // Kapasitas cutting: skor Skill Matrik = kapasitas per JAM, jadi dikali total jam
    // kerja efektif (bukan jumlah hari) x faktor kehadiran.
    const capacityPerOperator = cuttingCap.average * totalHours * attendanceFactor;
    const operatorsNeeded = capacityPerOperator > 0 ? Math.ceil(totalQty / capacityPerOperator) : null;

    // Cari daftar line asli untuk style referensi, urutkan dari kapasitas terbesar,
    // supaya bisa disarankan line spesifik mana yang dipakai.
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

    const suggestedLinesKananWomen = suggestLines("targetKanan", linesKananWomen);
    const suggestedLinesKiri = suggestLines("targetKiri", linesKiri);

    // Sarankan operator cutting spesifik: skor tertinggi di kategori yang cocok.
    let suggestedOperators = [];
    if (skillCategory && operatorsNeeded) {
      suggestedOperators = [...skillMatrikRows]
        .filter((r) => r[skillCategory] > 0)
        .sort((a, b) => b[skillCategory] - a[skillCategory])
        .slice(0, operatorsNeeded)
        .map((r) => ({ nama: r.nama, kapasitas: r[skillCategory], job: r.job }));
    }

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
      considerations,
    });
  } catch (err) {
    console.error("Capacity planner error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
