# ASIK_AI - Monitoring Produksi Katapang

Dashboard 5 tab untuk monitoring produksi:

1. **Executive Summary** — PA per departemen (kemarin), total WIP (Distribusi/Cutting
   Synthetic/Cutting Leather, kemarin), grafik WIP Line Sewing per line (kemarin, warna
   hijau/merah sesuai status Aman/Problem)
2. **Dashboard Production** — embed laporan Looker Studio
3. **Achievement Planning** — Achievement Sewing & Distribusi (kemarin), Monitoring
   Shipment (akumulasi kekurangan produksi/envelope, qty shipment), plus panel Analisa
   dan Rekomendasi AI otomatis (menyebutkan SPO/style penyebab kekurangan)
4. **Manpower dan Kapasitas** — placeholder, menunggu struktur data Jam Kerja, Absensi,
   Kode Operator Cutting, Kapasitas Cutting
5. **ASIK Solution** — room chat AI (Claude API), menjawab berdasarkan semua data yang
   sudah terhubung

Tema: gelap dengan aksen teal. Stack: Next.js (App Router) → Vercel, source code di
GitHub, data di Google Sheets (read-only via Google Sheets API), laporan visual dari
Looker Studio (embed iframe), AI dari Claude API.

---

## 1. Setup Google Cloud (Service Account)

1. Buka [Google Cloud Console](https://console.cloud.google.com/), buat/pilih project.
2. **APIs & Services → Library** → cari **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service Account** → beri nama
   bebas → skip bagian akses/role → **Done**.
4. Klik service account yang baru dibuat → tab **Keys** → **Add Key → Create new key →
   JSON** → file otomatis terdownload.
5. Dari file JSON itu, catat `client_email` dan `private_key`.
6. **Share Google Sheet** kamu ke email `client_email` tadi, akses **Viewer**.

## 2. Environment variable

Isi semua ini di `.env.local` (lokal) atau **Vercel → Project Settings → Environment
Variables** (production). Lihat `.env.example` untuk daftar lengkap dan nilai default.

| Variable | Keterangan |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | Dari file JSON service account |
| `GOOGLE_PRIVATE_KEY` | Dari file JSON service account (biarkan `\n` apa adanya) |
| `GOOGLE_SHEET_ID` | ID spreadsheet dari URL |
| `GOOGLE_SHEET_TAB_PA` dst | Nama tab persis di Google Sheets (default sudah sesuai) |
| `NEXT_PUBLIC_LOOKER_EMBED_URL` | Link embed Looker Studio (`/embed/reporting/`, bukan `/reporting/`) |
| `ANTHROPIC_API_KEY` | Dari console.anthropic.com, untuk ASIK Solution dan Analisa AI |

## 3. Jalankan lokal (opsional)

```bash
npm install
cp .env.example .env.local
# isi .env.local
npm run dev
```

## 4. Push ke GitHub

```bash
git add .
git commit -m "Pesan commit"
git push
```

## 5. Deploy ke Vercel

Import repo di [vercel.com](https://vercel.com), isi environment variable di atas
sebelum/sesudah deploy pertama, lalu **Deploy**. Kalau environment variable ditambah
setelah deploy jalan, lakukan **Redeploy** manual.

## 6. Struktur project

```
app/
  layout.js                       # root layout + font + metadata
  globals.css                     # tema warna (teal) dan tipografi
  page.js                         # shell 5 tab + header logo ASIK_AI
  api/pa/route.js                 # data PA
  api/wip/route.js                # data WIP (summary 3 tab + line sewing)
  api/achievement/route.js        # data Achievement Planning
  api/achievement-analysis/route.js  # analisa AI otomatis untuk Achievement Planning
  api/chat/route.js               # chat AI untuk ASIK Solution
lib/
  sheets.js                       # semua fungsi baca Google Sheets
  dateUtils.js                    # parsing tanggal fleksibel + logika "data kemarin"
components/
  ExecutiveSummary.js
  AchievementPlanning.js
  DashboardProduction.js
  ManpowerKapasitas.js             # placeholder
  AsikSolution.js
  Logo.js
  KpiCard.js
  Panel.js
```

## 7. Troubleshooting

- **Gagal mengambil data**: cek sheet sudah di-share ke `GOOGLE_CLIENT_EMAIL` (akses
  Viewer), dan nama tab di environment variable persis sama (case-sensitive) dengan
  nama tab asli.
- **Angka WIP/achievement 0 semua**: kemungkinan logika "data kemarin" tidak menemukan
  baris yang cocok — cek format tanggal di sheet konsisten dengan yang sudah diuji
  (`14 Juli 2026`, `14/07/2026`, atau `02-Jan`).
- **gudang jadi salah baca kolom**: tab ini punya 2 baris judul sebelum header asli;
  kalau strukturnya berubah, sesuaikan `rows.slice(3)` di `getGudangJadiData()`
  dalam `lib/sheets.js`.
- **Error terkait private key**: pastikan `\n` di `GOOGLE_PRIVATE_KEY` tetap literal
  (bukan baris baru sungguhan) saat paste ke Vercel.
