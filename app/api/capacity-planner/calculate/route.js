import { NextResponse } from "next/server";
import {
  getStrongPointStyleOptions,
  getStrongPointData,
  getKodeOperatorCuttingList,
  getSkillCategoryForStyle,
  getAverageSkillCuttingCapacity,
  getSkillMatrikCuttingData,
  getCriticalPointsForStyle,
  getGudangJadiMpRatios,
  getSupplyMpRatios,
  getMachineRequirementForStyle,
} from "@/lib/sheets";
import { calculateWorkingCapacity } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

// Simulasi opsi jumlah line (1 sampai baseline-1), hitung tambahan jam kerja
// yang dibutuhkan per hari supaya tetap selesai di deadline yang sama.
function simulateLineOptionsWithDeadline(qty, capacityPerHour, standardTotalHours, workingDays, baselineLines) {
  if (!qty || !capacityPerHour || baselineLines <= 1) return [];

  const options = [];
  for (let L = 1; L < baselineLines; L++) {
    const requiredTotalHoursPerLine = qty / (L * capacityPerHour);
    const additionalTotalHours = Math.max(0, requiredTotalHoursPerLine - standardTotalHours);
    const additionalHoursPerDay = workingDays > 0 ? additionalTotalHours / workingDays : 0;
    options.push({ lines: L, additionalHoursPerDay, additionalTotalHours });
  }
  return options;
}

// Mode tanpa deadline: opsi jumlah OPERATOR cutting, pakai kapasitas aktual
// operator terbaik (bukan rata-rata), supaya urutannya benar dari yang paling capable.
function computeHoursForOperatorOptions(qty, sortedOperators, maxOptions) {
  if (!qty || sortedOperators.length === 0) return [];

  const cap = Math.min(maxOptions, sortedOperators.length);
  const options = [];
  let cumulativeCapacity = 0;

  for (let L = 1; L <= cap; L++) {
    cumulativeCapacity += sortedOperators[L - 1].kapasitas;
    const totalHoursNeeded = qty / cumulativeCapacity;
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
function computeHoursForLineOptions(qty, capacityPerHour, maxLines) {
  if (!qty || !capacityPerHour || !maxLines || maxLines <= 0) return [];

  const options = [];
  for (let L = 1; L <= maxLines; L++) {
    const totalHoursNeeded = qty / (L * capacityPerHour);
    options.push({ lines: L, totalHoursNeeded });
  }
  return options;
}

// Simulasi alur lengkap: dari 1 rate (pcs/jam) yang sama, hitung kebutuhan MP
// di setiap station Supply + Gudang Jadi, cari station dengan buffer paling
// kecil (bottleneck risk), dan estimasi total jam penyelesaian.
function computeStationFlow(rate, avgCuttingCapacityPerHour, supplyRatios, gudangRatios, totalQty, sewingInfo) {
  if (!rate || rate <= 0) return null;

  const estimatedHours = totalQty > 0 ? totalQty / rate : null;
  const stations = [];

  // hoursNeeded = jam kerja aktual yang dipakai station ini untuk menyelesaikan
  // qty-nya, berdasarkan headcount yang sudah dibulatkan (rounded). Default-nya
  // diturunkan dari estimatedHours (durasi total alur), tapi station yang punya
  // basis qty/kapasitas sendiri (mis. Sewing) bisa kirim hoursNeeded eksplisit.
  function addStation(name, exact, opts = {}) {
    if (!exact || exact <= 0) return;
    const rounded = Math.ceil(exact);
    const bufferPercent = ((rounded - exact) / exact) * 100;
    const hoursNeeded =
      opts.hoursNeeded != null ? opts.hoursNeeded : estimatedHours != null ? estimatedHours * (exact / rounded) : null;
    stations.push({ name, exact, rounded, bufferPercent, hoursNeeded, lines: opts.lines || null, unit: opts.unit || "org" });
  }

  if (avgCuttingCapacityPerHour > 0) {
    addStation("Cutting Kulit", rate / avgCuttingCapacityPerHour);
  }
  if (supplyRatios && supplyRatios.target > 0) {
    const factor = rate / supplyRatios.target;
    addStation("Cutting Synthetic", factor * supplyRatios.cuttingSynthetic);
    addStation("Accessories", factor * supplyRatios.accessories);
    addStation("M4", factor * supplyRatios.m4);
    addStation("Distribusi", factor * supplyRatios.distribusi);
    addStation("Presub", factor * supplyRatios.presub);
  }

  // Sewing Kanan/Kiri: qty & kapasitas per line beda basis dari station supply/gudang
  // (yang berbasis rasio), jadi exact & hoursNeeded dihitung langsung dari qty/kapasitas
  // line yang sudah ditugaskan (rounded), bukan dari estimatedHours alur utama.
  if (sewingInfo?.qtyKananWomen > 0 && sewingInfo.capacityKananPerLine > 0) {
    const exactKanan = sewingInfo.qtyKananWomen / sewingInfo.capacityKananPerLine;
    const roundedKanan = Math.ceil(exactKanan);
    const hoursNeededKanan =
      sewingInfo.avgTargetKanan > 0
        ? sewingInfo.qtyKananWomen / (roundedKanan * sewingInfo.avgTargetKanan)
        : null;
    addStation("Sewing Kanan", exactKanan, { lines: sewingInfo.suggestedLinesKananWomen, hoursNeeded: hoursNeededKanan, unit: "line" });
  }
  if (sewingInfo?.qtyKiri > 0 && sewingInfo.capacityKiriPerLine > 0) {
    const exactKiri = sewingInfo.qtyKiri / sewingInfo.capacityKiriPerLine;
    const roundedKiri = Math.ceil(exactKiri);
    const hoursNeededKiri =
      sewingInfo.avgTargetKiri > 0
        ? sewingInfo.qtyKiri / (roundedKiri * sewingInfo.avgTargetKiri)
        : null;
    addStation("Sewing Kiri", exactKiri, { lines: sewingInfo.suggestedLinesKiri, hoursNeeded: hoursNeededKiri, unit: "line" });
  }

  if (gudangRatios && gudangRatios.target > 0) {
    const factor = rate / gudangRatios.target;
    addStation("Persiapan", factor * gudangRatios.persiapan);
    addStation("Packing Envelope", factor * gudangRatios.packingEnvelope);
    addStation("Packing Inner Carton", factor * gudangRatios.packingInnerCarton);
  }

  if (stations.length === 0) return null;

  const bottleneck = stations.reduce((min, s) => (s.bufferPercent < min.bufferPercent ? s : min), stations[0]);

  return { rate, stations, bottleneck, estimatedHours };
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

    const [styleOptions, cuttingCap, operatorList, strongPointGroups, skillMatrikRows, supplyRatios, gudangJadiRatios, machineRequirementRow] =
      await Promise.all([
        getStrongPointStyleOptions(),
        getAverageSkillCuttingCapacity(skillCategory),
        getKodeOperatorCuttingList(),
        getStrongPointData(),
        getSkillMatrikCuttingData(),
        getSupplyMpRatios(style),
        getGudangJadiMpRatios(style),
        getMachineRequirementForStyle(style),
      ]);

    const refStyle = styleOptions.find(
      (s) => s.style.toLowerCase() === style.toLowerCase()
    ) || styleOptions.find((s) => s.style.toLowerCase().includes(style.toLowerCase()));

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

    const criticalPoints = await getCriticalPointsForStyle(style);

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
        ? computeHoursForLineOptions(qtyKananWomen, refStyle.avgTargetKanan, maxLinesKananWomen).map((o) => ({
            ...o,
            suggestedLines: suggestLines("targetKanan", o.lines),
          }))
        : [];
      const optionsKiri = refStyle
        ? computeHoursForLineOptions(qi, refStyle.avgTargetKiri, maxLinesKiri).map((o) => ({
            ...o,
            suggestedLines: suggestLines("targetKiri", o.lines),
          }))
        : [];

      let optionsOperators = [];
      if (skillCategory) {
        const sortedOperators = [...skillMatrikRows]
          .filter((r) => r[skillCategory] > 0)
          .sort((a, b) => b[skillCategory] - a[skillCategory])
          .map((r) => ({ nama: r.nama, kapasitas: r[skillCategory] }));
        optionsOperators = computeHoursForOperatorOptions(totalQty, sortedOperators, 10);
      }

      // Tidak ada tanggal -> rate dasar dipakai kapasitas 1 line rata-rata (Kanan) dari style referensi.
      const baselineRate = refStyle?.avgTargetKanan || null;
      const stationFlow = baselineRate
        ? computeStationFlow(baselineRate, cuttingCap.average, supplyRatios, gudangJadiRatios, totalQty)
        : null;

      considerations.push({
        type: "info",
        text: baselineRate
          ? `Tidak ada tanggal target, simulasi station di bawah pakai asumsi rate ${baselineRate.toFixed(0)} pcs/jam (kapasitas 1 line rata-rata untuk style ini).`
          : "Tidak ada tanggal target dan tidak ada data referensi kapasitas line, simulasi station tidak bisa ditampilkan.",
      });

      return NextResponse.json({
        mode: "no-deadline",
        qtyKanan: qk,
        qtyKiri: qi,
        qtyWomen: qw,
        qtyKananWomen,
        totalQty,
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
        stationFlow,
        considerations,
      });
    }

    // ===== MODE DENGAN DEADLINE =====
    const { totalMinutes, workingDays } = calculateWorkingCapacity(start, finish);
    const totalHours = totalMinutes / 60;

    let linesKananWomen = null;
    let linesKiri = null;
    let capacityKananPerLine = null;
    let capacityKiriPerLine = null;

    if (refStyle) {
      if (refStyle.avgTargetKanan > 0) {
        capacityKananPerLine = refStyle.avgTargetKanan * totalHours;
        if (qtyKananWomen > 0) linesKananWomen = Math.ceil(qtyKananWomen / capacityKananPerLine);
      }
      if (refStyle.avgTargetKiri > 0) {
        capacityKiriPerLine = refStyle.avgTargetKiri * totalHours;
        if (qi > 0) linesKiri = Math.ceil(qi / capacityKiriPerLine);
      }
    }

    const simulationKananWomen = refStyle
      ? simulateLineOptionsWithDeadline(qtyKananWomen, refStyle.avgTargetKanan, totalHours, workingDays, linesKananWomen)
      : [];
    const simulationKiri = refStyle
      ? simulateLineOptionsWithDeadline(qi, refStyle.avgTargetKiri, totalHours, workingDays, linesKiri)
      : [];

    const capacityPerOperator = cuttingCap.average * totalHours;
    const operatorsNeeded = capacityPerOperator > 0 ? Math.ceil(totalQty / capacityPerOperator) : null;

    // Kebutuhan Mesin: total line sewing = Line Kanan+Women + Line Kiri (keduanya
    // sama-sama line sewing fisik yang butuh mesin sendiri-sendiri), dikalikan
    // kebutuhan mesin per 1 line dari tab BASE DATA MACHINE REQUIRE.
    const totalLinesForMachine = (linesKananWomen || 0) + (linesKiri || 0);
    const machineRequirement =
      machineRequirementRow && totalLinesForMachine > 0
        ? {
            style: machineRequirementRow.style,
            totalLines: totalLinesForMachine,
            items: machineRequirementRow.machines.map((m) => ({
              name: m.name,
              perLine: m.qtyPerLine,
              total: Math.ceil(m.qtyPerLine * totalLinesForMachine),
            })),
          }
        : null;

    if (!machineRequirementRow) {
      considerations.push({
        type: "info",
        text: `Data kebutuhan mesin untuk style "${style}" belum ditemukan di tab BASE DATA MACHINE REQUIRE.`,
      });
    }

    const ratePerHour = totalQty / totalHours;

    // MP Gudang Jadi (dipertahankan untuk kompatibilitas kartu yang sudah ada).
    let gudangJadiMp = null;
    if (gudangJadiRatios && gudangJadiRatios.target > 0) {
      const factor = ratePerHour / gudangJadiRatios.target;
      gudangJadiMp = {
        ratePerHour,
        persiapan: Math.ceil(factor * gudangJadiRatios.persiapan),
        packingEnvelope: Math.ceil(factor * gudangJadiRatios.packingEnvelope),
        packingInnerCarton: Math.ceil(factor * gudangJadiRatios.packingInnerCarton),
      };
    }

    // MP Supply (dipertahankan untuk kompatibilitas kartu yang sudah ada).
    let supplyMp = null;
    if (supplyRatios && supplyRatios.target > 0) {
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

    // Simulasi alur lengkap + deteksi bottleneck, rate = Total Qty / Total Jam.
    const stationFlow = computeStationFlow(ratePerHour, cuttingCap.average, supplyRatios, gudangJadiRatios, totalQty, {
      qtyKananWomen,
      capacityKananPerLine,
      avgTargetKanan: refStyle?.avgTargetKanan,
      suggestedLinesKananWomen,
      qtyKiri: qi,
      capacityKiriPerLine,
      avgTargetKiri: refStyle?.avgTargetKiri,
      suggestedLinesKiri,
    });

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

    if (stationFlow?.bottleneck) {
      considerations.push({
        type: stationFlow.bottleneck.bufferPercent < 10 ? "warning" : "ok",
        text: `Station dengan buffer kapasitas paling kecil: ${stationFlow.bottleneck.name} (${stationFlow.bottleneck.bufferPercent.toFixed(1)}% buffer). Ini yang paling berisiko jadi bottleneck kalau ada gangguan.`,
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
      machineRequirement,
      stationFlow,
      criticalPoints,
      considerations,
    });
  } catch (err) {
    console.error("Capacity planner error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
