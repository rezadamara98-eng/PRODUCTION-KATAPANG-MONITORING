# Panel Produksi Katapang — Dashboard 4 Tab

Dashboard dengan 4 tab:
1. **Executive Summary** — ringkasan gabungan data produksi (KPI, status per lini, grafik)
2. **Dashboard Production** — embed laporan Looker Studio
3. **Achievement Planning** — placeholder, menunggu struktur data planning
4. **ASIK Solution** — room chat AI (Claude API) yang menjawab berdasarkan data produksi

Stack: **Next.js** (App Router) → deploy di **Vercel**, source code di
**GitHub**, data produksi di **Google Sheets** (read-only via Google Sheets API),
laporan visual dari **Looker Studio** (embed iframe), dan chat AI dari **Claude API**.

---

## 1. Format Google Sheet

Buat/gunakan sheet dengan baris pertama sebagai header, kolom A–E:

| Tanggal    | Lini/Mesin | Output | Target | Reject |
|------------|------------|--------|--------|--------|
| 2026-07-01 | Lini 1     | 950    | 1000   | 12     |
| 2026-07-01 | Lini 2     | 880    | 900    | 5      |

Catatan:
- Format tanggal sebaiknya `YYYY-MM-DD` agar mudah dikelompokkan
  (harian/bulanan). Format lain kemungkinan masih terbaca, tapi lebih aman
  konsisten.
- Nama sheet default yang dibaca adalah `Sheet1`. Jika nama tab sheet-mu
  beda, sesuaikan `GOOGLE_SHEET_RANGE` nanti di environment variable.

---

## 2. Setup Google Cloud (Service Account)

Ini yang menghubungkan aplikasi ke Sheets kamu tanpa perlu OAuth login user.

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (atau pakai yang sudah ada).
3. Di menu **APIs & Services → Library**, cari **Google Sheets API**, klik
   **Enable**.
4. Di menu **APIs & Services → Credentials**, klik **Create Credentials →
   Service Account**.
   - Isi nama bebas, misal `sheets-reader`.
   - Role tidak perlu diisi (skip saja) — akses diatur lewat share sheet,
     bukan lewat IAM role.
5. Setelah service account dibuat, klik service account tersebut → tab
   **Keys** → **Add Key → Create new key → JSON**. File JSON akan
   otomatis terdownload — **simpan baik-baik, ini rahasia**.
6. Dari file JSON tersebut, kamu butuh dua nilai:
   - `client_email` → contoh: `sheets-reader@nama-project.iam.gserviceaccount.com`
   - `private_key` → teks panjang yang diawali `-----BEGIN PRIVATE KEY-----`
7. **Share Google Sheet kamu** ke email `client_email` tadi, cukup akses
   **Viewer** (karena aplikasi hanya baca data, tidak menulis).
8. Ambil **Sheet ID** dari URL sheet kamu:
   `https://docs.google.com/spreadsheets/d/SHEET_ID_DISINI/edit`

---

## 3. Jalankan lokal (opsional, untuk testing dulu)

```bash
npm install
cp .env.example .env.local
# isi .env.local dengan GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID
npm run dev
```

Buka `http://localhost:3000`.

---

## 4. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: dashboard produksi"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

`.env.local` **tidak akan ikut ter-push** (sudah masuk `.gitignore`), jadi
kredensial aman.

---

## 5. Deploy ke Vercel

1. Buka [vercel.com](https://vercel.com) → **Add New → Project** →
   import repo GitHub yang barusan dibuat.
2. Sebelum klik Deploy, buka bagian **Environment Variables**, isi 4
   variabel berikut (ambil dari file JSON service account & sheet kamu):
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY` — **penting**: paste apa adanya termasuk
     `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----`, dan biarkan
     karakter `\n` di dalamnya (jangan diganti jadi enter sungguhan).
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SHEET_RANGE` (contoh: `Sheet1!A:E`)
3. Klik **Deploy**. Setelah selesai, dashboard bisa diakses lewat URL
   `nama-project.vercel.app`.

Setiap kali kamu update data di Google Sheets, dashboard akan menampilkan
data terbaru saat halaman di-refresh (tidak ada cache statis pada data).

---

## 6. Struktur project

```
app/
  layout.js              # root layout + font
  globals.css            # tema warna & tipografi
  page.js                # halaman dashboard (fetch + render)
  api/production/route.js  # API route yang baca Google Sheets
lib/
  sheets.js              # logic koneksi ke Google Sheets API
.env.example             # template environment variable
```

---

## 7. Environment variable tambahan (update terbaru)

Selain 4 variabel Google Sheets sebelumnya, sekarang ada tambahan:

| Variable | Keterangan |
|---|---|
| `GOOGLE_SHEET_TABS` | Nama tab yang digabung untuk data produksi, dipisah koma. Default: `STRONG PONT LINE,PA` |
| `NEXT_PUBLIC_LOOKER_EMBED_URL` | Link embed Looker Studio (pastikan pakai `/embed/reporting/`, bukan `/reporting/`, dan laporan sudah di-share "Anyone with the link") |
| `ANTHROPIC_API_KEY` | API key dari console.anthropic.com, untuk fitur chat AI di tab ASIK Solution |

Kalau update dari deploy sebelumnya, tambahkan variabel-variabel ini di
**Vercel → Project Settings → Environment Variables**, lalu redeploy.

## 8. Troubleshooting

- **Error "Gagal mengambil data dari Google Sheets"**: cek apakah sheet
  sudah di-share ke email service account (`GOOGLE_CLIENT_EMAIL`) dengan
  akses minimal Viewer.
- **Data kosong/tidak muncul**: cek `GOOGLE_SHEET_RANGE` — nama tab sheet
  harus persis sama (case-sensitive) dengan yang ada di `Sheet1!A:E`.
- **Error terkait private key**: biasanya karena `\n` di `GOOGLE_PRIVATE_KEY`
  ter-strip saat paste. Pastikan value di environment variable Vercel
  masih ada `\n` literalnya, bukan baris baru sungguhan.
