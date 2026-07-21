import { NextResponse } from "next/server";
import {
  getPaData,
  getWipSummary,
  getWipLineData,
  getPlanSewData,
  getPlanDistData,
  getGudangJadiSummary,
  getGudangJadiData,
  getOutputLineYesterday,
  getOutputLineHistory,
  getRepairLineYesterday,
  getRepairLineHistory,
  getRejectLineYesterday,
  getRejectLineHistory,
  getEffisiensiLineYesterday,
  getEffisiensiLineHistory,
  getWipPresubAccessoriesSummary,
  getJamKerjaYesterday,
  getAbsensiYesterday,
  getKodeOperatorCuttingList,
  getKapasitasCuttingYesterday,
  getKapasitasCuttingAll,
  getAverageAttendanceRate,
  getStrongPointData,
  getStrongPointStyleOptions,
  getSkillMatrikCuttingData,
  getSkillMatrixSewingData,
  getSpoTrackData,
  getStyleIssueProduksi,
  getStyleIssueCutting,
  getKebutuhanMpGudangJadiRows,
  getKebutuhanMpSupplyRows,
  getMachineRequirementRows,
  lookupGloveSerial,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helper umum
// ---------------------------------------------------------------------------

// Cocokkan baris berdasarkan nama style (exact dulu, fallback substring 2 arah) -
// sama seperti matchStyleRows privat di sheets.js, dipakai di sini untuk filter
// hasil tool sebelum dikirim balik ke Claude (biar hemat token).
function filterByStyle(rows, style) {
  if (!style) return rows;
  const needle = style.toLowerCase().trim();
  const exact = rows.filter((r) => (r.style || "").toLowerCase().trim() === needle);
  if (exact.length > 0) return exact;
  return rows.filter((r) => {
    const s = (r.style || "").toLowerCase().trim();
    return s && (s.includes(needle) || needle.includes(s));
  });
}

// Batasi jumlah baris yang dikirim balik ke Claude supaya 1 tool call tidak
// membengkakkan context (mis. SPO TRACK atau histori harian bisa ribuan baris).
// Kalau kepotong, kasih catatan supaya Claude tahu harus mempersempit query
// (pakai filter style/tanggal/limit) kalau butuh lebih detail.
function capRows(rows, max = 150) {
  if (!Array.isArray(rows) || rows.length <= max) {
    return { count: rows?.length || 0, truncated: false, data: rows };
  }
  return {
    count: rows.length,
    truncated: true,
    note: `Data ada ${rows.length} baris, cuma ${max} baris terakhir yang ditampilkan. Persempit pencarian (mis. pakai parameter style atau days) kalau butuh baris lain.`,
    data: rows.slice(-max),
  };
}

function daysLimit(rows, dateField, days) {
  if (!days || !Array.isArray(rows)) return rows;
  // Ambil N baris TERAKHIR di sheet (bukan filter tanggal presisi, karena format
  // tanggal antar tab tidak seragam) - cukup akurat karena sheet-sheet ini
  // selalu diisi berurutan per tanggal dari atas ke bawah.
  const approxRowsPerDay = 1;
  return rows.slice(-Math.max(days * approxRowsPerDay, 1));
}

// ---------------------------------------------------------------------------
// Daftar tools yang bisa dipanggil Claude (mapping ke fungsi lib/sheets.js)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "get_pa_history",
    description: "Histori PA (Performance Achievement) harian: Supply, Sewing, Gudang Jadi, Factory (%).",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Jumlah hari terakhir yang diambil, default 30" } },
    },
  },
  {
    name: "get_wip_summary",
    description: "Ringkasan WIP (Work In Progress) terbaru: Distribusi, Cutting Synthetic, Cutting Leather.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_wip_line_history",
    description: "Histori WIP Line Sewing per line per hari, termasuk status AMAN/PROBLEM.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Jumlah hari terakhir, default 30" } },
    },
  },
  {
    name: "get_achievement_sewing_history",
    description: "Histori Achievement Sewing per Line/SPO/Style/tanggal (Plan vs Actual, %Achievement).",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Jumlah baris terakhir, default 60" },
        style: { type: "string", description: "Filter nama style tertentu (opsional)" },
      },
    },
  },
  {
    name: "get_achievement_distribusi_history",
    description: "Histori Achievement Distribusi per Fact (lokasi) per tanggal.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Jumlah baris terakhir, default 60" } },
    },
  },
  {
    name: "get_gudang_jadi_summary",
    description: "Ringkasan akumulasi shipment: kekurangan produksi, kekurangan envelope, qty shipment.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_gudang_jadi_detail",
    description: "Detail per SPO di Gudang Jadi: qty shipment, kekurangan produksi, kekurangan envelope.",
    input_schema: {
      type: "object",
      properties: {
        onlyKekurangan: { type: "boolean", description: "Kalau true, cuma tampilkan SPO yang kekurangan produksi/envelope" },
      },
    },
  },
  {
    name: "get_output_line",
    description: "Output produksi per Line Sewing (K01, K02, dst) per hari. Tanpa parameter = data kemarin saja.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Kalau diisi, ambil histori N hari terakhir (bukan cuma kemarin)" } },
    },
  },
  {
    name: "get_repair_line",
    description: "Jumlah repair per Line Sewing (K01, K02, dst) per hari. Tanpa parameter = data kemarin saja.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Kalau diisi, ambil histori N hari terakhir (bukan cuma kemarin)" } },
    },
  },
  {
    name: "get_reject_line",
    description: "Jumlah reject per Line Sewing (K01, K02, dst) per hari. Tanpa parameter = data kemarin saja.",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Kalau diisi, ambil histori N hari terakhir (bukan cuma kemarin)" } },
    },
  },
  {
    name: "get_effisiensi_line",
    description: "Efisiensi (%) per Line Sewing per hari. Tanpa parameter = data kemarin saja (hari terakhir yang ada datanya, skip hari libur/kosong).",
    input_schema: {
      type: "object",
      properties: { days: { type: "number", description: "Kalau diisi, ambil histori N hari terakhir yang ada datanya (bukan cuma kemarin) - mis. 7 untuk analisa 1 minggu" } },
    },
  },
  {
    name: "get_wip_presub_accessories",
    description: "WIP Presub dan WIP Accessories kemarin.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_jam_kerja_yesterday",
    description: "Jam Kerja kemarin per departemen (Supply/Sewing/Gudang Jadi/Support): SM vs Aktual vs Gap.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_absensi_yesterday",
    description: "Absensi kemarin: Alfa, Cuti, Cuti Melahirkan, Izin, Sakit, beserta total MP pabrik.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_average_attendance_rate",
    description: "Rata-rata tingkat kehadiran (%) dari seluruh histori data absensi yang ada.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_kode_operator_cutting",
    description: "Daftar semua kode operator cutting (nama <-> kode), untuk traceability reject/glove.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_kapasitas_cutting",
    description: "Kapasitas cutting per operator (histori atau kemarin saja) - nama, line, style, kapasitas.",
    input_schema: {
      type: "object",
      properties: {
        onlyYesterday: { type: "boolean", description: "Kalau true, cuma data kemarin. Default false (semua histori, bisa banyak - otomatis dipotong)" },
      },
    },
  },
  {
    name: "get_strong_point_line",
    description: "Data Strong Point Line: target & aktual & efisiensi Kanan/Kiri per line, dikelompokkan per style.",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", description: "Filter nama style tertentu (opsional, kalau kosong kirim semua style)" } },
    },
  },
  {
    name: "get_strong_point_style_summary",
    description: "Ringkasan per style dari Strong Point Line: rata-rata target Kanan/Kiri, jumlah line historis.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_skill_matrik_cutting",
    description: "Skill Matrik Cutting: skor kapasitas per operator per kategori skill (Path&Thumb, Combo, Goat Skin, Sheep Skin, Premium).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_skill_matrix_sewing",
    description: "Skill Matrix Sewing: operator per line beserta skill, style, SMV, target SMV, kapasitas aktual.",
    input_schema: {
      type: "object",
      properties: { line: { type: "string", description: "Filter nama line tertentu (opsional)" } },
    },
  },
  {
    name: "get_spo_track",
    description: "Data SPO Track (traceability box cutting): line, box, SPO, product. Bisa sangat banyak baris - WAJIB isi salah satu filter.",
    input_schema: {
      type: "object",
      properties: {
        spo: { type: "string", description: "Filter 4 digit nomor SPO" },
        line: { type: "string", description: "Filter nama line" },
      },
    },
  },
  {
    name: "get_style_issue_produksi",
    description: "Poin kritis kualitas per style saat produksi/sewing (Section Material/Accessories/Sewing).",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", description: "Filter nama style tertentu (opsional)" } },
    },
  },
  {
    name: "get_style_issue_cutting",
    description: "Catatan penanganan khusus material per style saat cutting.",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", description: "Filter nama style tertentu (opsional)" } },
    },
  },
  {
    name: "get_kebutuhan_mp_gudang_jadi",
    description: "Rasio kebutuhan manpower Gudang Jadi per style (Persiapan, Packing Envelope, Packing Inner Carton) per 108 pcs/jam.",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", description: "Filter nama style tertentu (opsional)" } },
    },
  },
  {
    name: "get_kebutuhan_mp_supply",
    description: "Rasio kebutuhan manpower Supply per style (Cutting Synthetic, Accessories, M4, Distribusi, Presub) per 108 pcs/jam.",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", description: "Filter nama style tertentu (opsional)" } },
    },
  },
  {
    name: "get_machine_requirement",
    description: "Kebutuhan mesin (SND Computer, Obras, dll) per 1 line sewing untuk tiap style.",
    input_schema: {
      type: "object",
      properties: { style: { type: "string", description: "Filter nama style tertentu (opsional)" } },
    },
  },
  {
    name: "lookup_glove_serial",
    description: "Decode 2 nomor seri glove (8 digit masing-masing) dan cari operator cutting/sewing terkait.",
    input_schema: {
      type: "object",
      properties: {
        serial1: { type: "string", description: "Nomor seri 1 (8 digit)" },
        serial2: { type: "string", description: "Nomor seri 2 (8 digit)" },
      },
      required: ["serial1", "serial2"],
    },
  },
];

// ---------------------------------------------------------------------------
// Dispatcher: eksekusi tool call sesuai nama
// ---------------------------------------------------------------------------

async function executeTool(name, input) {
  switch (name) {
    case "get_pa_history": {
      const rows = await getPaData();
      return capRows(daysLimit(rows, "tanggal", input.days || 30));
    }
    case "get_wip_summary":
      return await getWipSummary();
    case "get_wip_line_history": {
      const rows = await getWipLineData();
      return capRows(daysLimit(rows, "tanggal", input.days || 30), 200);
    }
    case "get_achievement_sewing_history": {
      let rows = await getPlanSewData();
      if (input.style) rows = filterByStyle(rows, input.style);
      return capRows(daysLimit(rows, "tanggal", input.days || 60), 150);
    }
    case "get_achievement_distribusi_history": {
      const rows = await getPlanDistData();
      return capRows(daysLimit(rows, "tanggal", input.days || 60), 150);
    }
    case "get_gudang_jadi_summary":
      return await getGudangJadiSummary();
    case "get_gudang_jadi_detail": {
      let rows = await getGudangJadiData();
      if (input.onlyKekurangan) {
        rows = rows.filter((r) => r.kekuranganProduksi < 0 || r.kekuranganEnvelope < 0);
      }
      return capRows(rows, 150);
    }
    case "get_output_line":
      return input.days ? capRows(await getOutputLineHistory(input.days), 60) : await getOutputLineYesterday();
    case "get_repair_line":
      return input.days ? capRows(await getRepairLineHistory(input.days), 60) : await getRepairLineYesterday();
    case "get_reject_line":
      return input.days ? capRows(await getRejectLineHistory(input.days), 60) : await getRejectLineYesterday();
    case "get_effisiensi_line":
      return input.days ? capRows(await getEffisiensiLineHistory(input.days), 60) : await getEffisiensiLineYesterday();
    case "get_wip_presub_accessories":
      return await getWipPresubAccessoriesSummary();
    case "get_jam_kerja_yesterday":
      return await getJamKerjaYesterday();
    case "get_absensi_yesterday":
      return await getAbsensiYesterday();
    case "get_average_attendance_rate":
      return { attendanceRate: await getAverageAttendanceRate() };
    case "get_kode_operator_cutting":
      return capRows(await getKodeOperatorCuttingList(), 300);
    case "get_kapasitas_cutting": {
      const rows = input.onlyYesterday ? await getKapasitasCuttingYesterday() : await getKapasitasCuttingAll();
      return capRows(rows, 200);
    }
    case "get_strong_point_line": {
      let groups = await getStrongPointData();
      if (input.style) {
        const needle = input.style.toLowerCase();
        groups = groups.filter((g) => g.style.toLowerCase().includes(needle));
      }
      return capRows(groups, 100);
    }
    case "get_strong_point_style_summary":
      return capRows(await getStrongPointStyleOptions(), 200);
    case "get_skill_matrik_cutting":
      return capRows(await getSkillMatrikCuttingData(), 300);
    case "get_skill_matrix_sewing": {
      let rows = await getSkillMatrixSewingData();
      if (input.line) rows = rows.filter((r) => r.line.toLowerCase() === input.line.toLowerCase());
      return capRows(rows, 300);
    }
    case "get_spo_track": {
      if (!input.spo && !input.line) {
        return { error: "Wajib isi filter 'spo' atau 'line' - tab ini terlalu besar untuk diambil semua sekaligus." };
      }
      let rows = await getSpoTrackData();
      if (input.spo) rows = rows.filter((r) => r.spo.includes(input.spo));
      if (input.line) rows = rows.filter((r) => r.line.toLowerCase() === input.line.toLowerCase());
      return capRows(rows, 200);
    }
    case "get_style_issue_produksi": {
      let rows = await getStyleIssueProduksi();
      if (input.style) rows = filterByStyle(rows, input.style);
      return capRows(rows, 150);
    }
    case "get_style_issue_cutting": {
      let rows = await getStyleIssueCutting();
      if (input.style) rows = filterByStyle(rows, input.style);
      return capRows(rows, 150);
    }
    case "get_kebutuhan_mp_gudang_jadi": {
      let rows = await getKebutuhanMpGudangJadiRows();
      if (input.style) rows = filterByStyle(rows, input.style);
      return capRows(rows, 150);
    }
    case "get_kebutuhan_mp_supply": {
      let rows = await getKebutuhanMpSupplyRows();
      if (input.style) rows = filterByStyle(rows, input.style);
      return capRows(rows, 150);
    }
    case "get_machine_requirement": {
      let rows = await getMachineRequirementRows();
      if (input.style) rows = filterByStyle(rows, input.style);
      return capRows(rows, 100);
    }
    case "lookup_glove_serial":
      return await lookupGloveSerial(input.serial1, input.serial2);
    default:
      return { error: `Tool "${name}" tidak dikenal.` };
  }
}

// ---------------------------------------------------------------------------
// Handler POST /api/chat
// ---------------------------------------------------------------------------

const MAX_TOOL_ROUNDS = 8;

export async function POST(req) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY belum diset di environment variable." }, { status: 500 });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
    }

    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const systemPrompt = `Kamu adalah ASIK, asisten AI analisa produksi untuk pabrik Katapang. Hari ini tanggal ${today}.

Kamu TIDAK dikasih data di awal - semua data harus kamu ambil sendiri lewat tools yang tersedia,
sesuai kebutuhan pertanyaan user. Jangan mengarang angka. Kalau butuh beberapa jenis data
sekaligus untuk menjawab, panggil beberapa tools (boleh berurutan atau sekaligus).

Beberapa tab (SPO Track, histori achievement, kapasitas cutting) datanya bisa sangat banyak -
pakai parameter filter (style/line/spo/days) yang tersedia di tiap tool supaya hasilnya
relevan dan tidak kepotong. Kalau hasil tool menyertakan catatan "truncated", pertimbangkan
mempersempit filter dan panggil ulang kalau data yang terpotong itu penting untuk jawabanmu.

Untuk pertanyaan soal reject/traceability glove, pakai tool lookup_glove_serial atau kombinasi
get_kode_operator_cutting + get_spo_track + get_skill_matrix_sewing.

Jawab dengan bahasa Indonesia yang jelas dan langsung ke intinya. Kalau data yang ditanyakan
memang belum tersedia di sheet manapun, katakan terus terang.`;

    let conversation = messages.map((m) => ({ role: m.role, content: m.content }));

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1536,
          system: systemPrompt,
          tools: TOOLS,
          messages: conversation,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("Anthropic API error:", errBody);
        return NextResponse.json({ error: "Gagal menghubungi Claude API." }, { status: 502 });
      }

      const data = await response.json();

      if (data.stop_reason === "tool_use") {
        const toolUseBlocks = (data.content || []).filter((b) => b.type === "tool_use");

        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block) => {
            let result;
            try {
              result = await executeTool(block.name, block.input || {});
            } catch (err) {
              result = { error: err.message || "Tool gagal dijalankan." };
            }
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          })
        );

        conversation = [
          ...conversation,
          { role: "assistant", content: data.content },
          { role: "user", content: toolResults },
        ];
        continue;
      }

      const text = (data.content || [])
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("\n")
        .trim();

      return NextResponse.json({ reply: text || "(tidak ada respon)" });
    }

    return NextResponse.json({ reply: "Maaf, butuh terlalu banyak langkah untuk jawab ini. Coba pertanyaan yang lebih spesifik." });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan." }, { status: 500 });
  }
}
