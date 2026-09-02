// Pure calculation helpers for the interactive Line Balancing calculator.
// No React / DOM here on purpose - keeps the math easy to read and test in
// isolation from the component/rendering code.

// Natural sort so "S-2" comes before "S-10" (plain string sort would put
// "S-10" before "S-2").
export function naturalCompare(a, b) {
  const na = parseFloat(String(a).replace(/[^0-9.]/g, ""));
  const nb = parseFloat(String(b).replace(/[^0-9.]/g, ""));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

// Standard time (detik) = waktu observasi x (1 + allowance). This is the
// cycle time actually used for bottleneck/takt math, because allowance
// (istirahat, kelelahan, kebutuhan pribadi) makes the raw stopwatch time
// unrealistic to sustain across a whole shift.
export function rowDerived(row, workPerHour) {
  const allowance = row.allowance || 0;
  const adjCT = row.cycleTime * (1 + allowance / 100);
  const ctMin = workPerHour > 0 ? adjCT / workPerHour : 0;
  const smv = Math.ceil(ctMin * 100) / 100; // dibulatkan ke atas, 2 desimal
  return { adjCT, ctMin, smv };
}

// Group rows that share the same No. Proses into one "station". Multiple
// operators on the same proses means they work in parallel to add capacity,
// so the station's combined rate = sum of each operator's rate
// (1 / adjCT), not an average - two operators finish twice as many units in
// the same time, so the *effective* cycle time of the station is lower than
// any single operator's own cycle time.
export function groupStations(rows, workPerHour) {
  const valid = rows.filter((r) => (r.proses || "").trim() && r.cycleTime > 0);
  const map = new Map();
  valid.forEach((r) => {
    const key = (r.noProses || "").trim().toUpperCase() || `__row${r.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  const groups = [...map.values()].map((groupRows) => {
    const derived = groupRows.map((r) => ({ ...r, ...rowDerived(r, workPerHour) }));
    const rate = derived.reduce((s, r) => s + (r.adjCT > 0 ? 1 / r.adjCT : 0), 0);
    const effectiveCT = rate > 0 ? 1 / rate : 0;
    const avgIndividualAdjCT = derived.reduce((s, r) => s + r.adjCT, 0) / derived.length;
    return {
      key: (groupRows[0].noProses || "").trim().toUpperCase() || `__row${groupRows[0].id}`,
      noProses: groupRows[0].noProses?.trim() || "-",
      proses: groupRows[0].proses?.trim() || "(tanpa nama proses)",
      rows: derived,
      operatorCount: derived.length,
      operatorNames: derived.map((r) => r.operator || "-"),
      effectiveCT,
      avgIndividualAdjCT,
    };
  });
  groups.sort((a, b) => naturalCompare(a.noProses, b.noProses));
  return groups;
}

// Full derived summary used by the KPI tiles, chart, suggestions and detail
// table. Returns null when there isn't enough data yet.
//
// "Waktu Kerja ( Jam )" (workPerHour, menit kerja bersih per jam) is now the
// SOLE time basis for every per-jam calculation below - there is no more
// separate "waktu kerja tersedia" (shift-length) input, and targetOutput is
// a pcs/jam figure rather than pcs/shift.
export function computeSummary({ rows, workPerHour, targetOutput }) {
  const groups = groupStations(rows, workPerHour);
  if (groups.length === 0) return null;

  const n = groups.length;
  const totalCT = groups.reduce((s, g) => s + g.effectiveCT, 0);
  const bottleneck = groups.reduce((max, g) => (g.effectiveCT > max.effectiveCT ? g : max), groups[0]);
  const avgCT = totalCT / n;
  const lineEfficiency = bottleneck.effectiveCT > 0 ? (totalCT / (n * bottleneck.effectiveCT)) * 100 : 0;
  const workSecondsPerHour = (workPerHour || 0) * 60;
  const currentOutputHour = bottleneck.effectiveCT > 0 ? workSecondsPerHour / bottleneck.effectiveCT : 0;

  let requiredTakt = null;
  let totalOperatorsNeeded = null;
  if (targetOutput && targetOutput > 0 && workSecondsPerHour > 0) {
    requiredTakt = workSecondsPerHour / targetOutput;
    totalOperatorsNeeded = groups.reduce(
      (sum, g) => sum + Math.max(1, Math.ceil(g.avgIndividualAdjCT / requiredTakt)),
      0
    );
  }
  const referenceTakt = requiredTakt || bottleneck.effectiveCT;

  // Once a real target/required-takt exists, THAT is the sole bottleneck
  // threshold - a station comfortably under a loose target must never be
  // flagged just because it happens to be the line's own slowest station.
  // Only fall back to "always flag the line's own bottleneck" when there is
  // no target at all (so at least one bar is still flagged for reference).
  const isOverTakt = requiredTakt
    ? (g) => g.effectiveCT > requiredTakt + 0.01
    : (g) => g.effectiveCT >= bottleneck.effectiveCT - 0.01;

  const totalOperatorsAssigned = groups.reduce((s, g) => s + g.operatorCount, 0);

  return {
    groups,
    n,
    totalCT,
    bottleneck,
    avgCT,
    lineEfficiency,
    workSecondsPerHour,
    currentOutputHour,
    requiredTakt,
    totalOperatorsNeeded,
    referenceTakt,
    isOverTakt,
    totalOperatorsAssigned,
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Heuristic redistribution suggestions - always caveated, never a hard
// instruction. Operates on grouped stations, not raw rows. Returns
// pre-escaped HTML strings (rendered via dangerouslySetInnerHTML for the
// <b> emphasis) since station/operator names come from free-text leader
// input and must not be trusted as markup.
export function buildSuggestions(groups, referenceTakt) {
  const sorted = [...groups].sort((a, b) => b.effectiveCT - a.effectiveCT);
  const top = sorted[0];
  const items = [];

  if (top && top.effectiveCT > referenceTakt * 1.05) {
    const newRate = 1 / top.effectiveCT + 1 / top.avgIndividualAdjCT;
    const newCT = 1 / newRate;
    const others = sorted.slice(1).map((g) => g.effectiveCT);
    const newBottleneck = Math.max(newCT, ...others, 0);
    items.push({
      type: "split",
      key: `split-${top.key}`,
      html: `Tambah <b>1 operator paralel</b> di proses "<b>${escapeHtml(top.noProses)} · ${escapeHtml(top.proses)}</b>" (saat ini ${top.operatorCount} operator: ${escapeHtml(top.operatorNames.join(", "))}) — CT efektif turun dari ${top.effectiveCT.toFixed(1)}s menjadi ~${newCT.toFixed(1)}s. Bottleneck line berpindah ke sekitar ${newBottleneck.toFixed(1)}s.`,
    });
  }

  const idle = sorted.filter((g) => g.effectiveCT < referenceTakt * 0.7 && g !== top);
  idle.forEach((g) => {
    const reduceNote =
      g.operatorCount > 1
        ? ` Karena proses ini sudah punya ${g.operatorCount} operator paralel, pertimbangkan kurangi jadi ${g.operatorCount - 1} operator dan alihkan sisanya ke proses yang lebih berat.`
        : "";
    items.push({
      type: "idle",
      key: `idle-${g.key}`,
      html: `Proses "<b>${escapeHtml(g.noProses)} · ${escapeHtml(g.proses)}</b>" punya idle ~${(referenceTakt - g.effectiveCT).toFixed(1)}s/unit dibanding acuan — pertimbangkan menyerap sebagian tugas dari proses yang lebih berat.${reduceNote}`,
    });
  });

  return items;
}
