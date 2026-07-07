# Panel Produksi — Dashboard Analisa Output Produksi

Dashboard read-only yang mengambil data dari Google Sheets dan menampilkan
ringkasan output produksi (total output, target, reject, efisiensi, reject
rate), status per lini/mesin, grafik tren, dan log data mentah.

Stack: **Next.js** (App Router) → deploy di **Vercel**, source code di
**GitHub**, data di **Google Sheets** (dibaca lewat Google Sheets API,
tidak ada penulisan/edit dari web app).

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

## 7. Troubleshooting

- **Error "Gagal mengambil data dari Google Sheets"**: cek apakah sheet
  sudah di-share ke email service account (`GOOGLE_CLIENT_EMAIL`) dengan
  akses minimal Viewer.
- **Data kosong/tidak muncul**: cek `GOOGLE_SHEET_RANGE` — nama tab sheet
  harus persis sama (case-sensitive) dengan yang ada di `Sheet1!A:E`.
- **Error terkait private key**: biasanya karena `\n` di `GOOGLE_PRIVATE_KEY`
  ter-strip saat paste. Pastikan value di environment variable Vercel
  masih ada `\n` literalnya, bukan baris baru sungguhan.
