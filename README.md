# ShortLink — URL Shortener

ShortLink adalah penyingkat URL berbasis web yang simpel, cepat, dan bisa dibagikan ke siapa saja. Setiap tautan yang dipendekkan disimpan secara aman di server (bukan cuma di browser pembuatnya), sehingga link tetap bisa diakses dan diarahkan dengan benar dari perangkat maupun browser mana pun — persis seperti tujuan awal sebuah URL shortener.

Live Demo: https://s.taqi.qzz.io

---

## Fitur

* Penyingkat tautan instan tanpa proses ribet.
* Pilihan custom slug atau acak menggunakan generator tombol dadu, dengan pengecekan ketersediaan alias secara real-time.
* Live preview tampilan URL pendek saat mengetik slug.
* Tautan yang sudah dibuat bisa dibagikan dan diakses oleh siapa saja, dari perangkat atau browser apa pun.
* Redirect terjadi di server (edge middleware) sebelum halaman apa pun sempat dimuat — tidak ada jeda atau halaman perantara yang terlihat.
* Riwayat pribadi "My Links" tersimpan di localStorage masing-masing browser, jadi setiap orang hanya melihat daftar tautan buatannya sendiri, bukan buatan orang lain.
* Penghitung klik per tautan yang diambil langsung dari server secara real-time.
* Generator QR Code untuk setiap tautan pendek, lengkap dengan opsi unduh sebagai PNG.
* Fitur pencarian internal untuk menyaring riwayat tautan pribadi.
* Section FAQ, Terms of Service, dan Privacy Policy dengan tampilan accordion.
* Tidak memerlukan akun atau proses sign-up sama sekali.

---

## Teknologi

* **HTML5, CSS3, Vanilla JavaScript** — struktur halaman, styling, dan seluruh logika UI di sisi klien.
* **Vercel Serverless Functions** (folder `api/`) — menangani pembuatan tautan, pengecekan alias, serta pengambilan/penghapusan data.
* **Vercel Edge Middleware** (`middleware.js`) — menangkap setiap request ke `/{slug}`, mencari tujuannya di database, lalu langsung mengalihkan (redirect) sebelum HTML apa pun dikirim ke browser.
* **Upstash Redis** — database key-value yang menyimpan seluruh data tautan (slug, URL tujuan, waktu dibuat, jumlah klik) secara terpusat di server.
* **localStorage** — hanya dipakai untuk menyimpan daftar "My Links" milik masing-masing pengguna secara lokal dan privat.

---

## Arsitektur & Cara Kerja

Berbeda dari versi awal yang murni client-side, ShortLink sekarang menggunakan pendekatan hybrid:

1. **Pembuatan tautan** — saat pengguna klik "Shorten URL", browser mengirim request ke `POST /api/shorten`. Server memvalidasi URL & slug, menyimpan datanya ke Upstash Redis, lalu mengembalikan tautan pendek yang jadi.
2. **Penyimpanan riwayat lokal** — begitu tautan berhasil dibuat, slug-nya juga dicatat di localStorage browser pengguna (key `taqi_my_links`). Ini yang membuat setiap orang punya daftar "My Links" yang berbeda-beda, meskipun data tautannya sendiri tersimpan bersama di satu database.
3. **Redirect** — ketika seseorang membuka `https://s.taqi.qzz.io/{slug}`, `middleware.js` berjalan di edge Vercel, mencari slug tersebut di Redis, lalu langsung mengalihkan (`307 redirect`) ke URL asli. Proses ini terjadi sebelum halaman utama (`index.html`) sempat dikirim ke browser, sehingga tidak ada halaman perantara atau jeda yang terlihat.
4. **Penghitungan klik** — setiap kali middleware berhasil mengalihkan sebuah slug, counter klik untuk slug tersebut ditambah satu di Redis (`clicks:{slug}`), lepas dari siapa yang mengklik atau dari perangkat mana.
5. **Menampilkan "My Links"** — halaman membaca daftar slug dari localStorage, lalu meminta detail & jumlah klik terkini dari `GET /api/links?slugs=...` ke server. Server hanya mengembalikan data untuk slug yang diminta secara eksplisit — tidak ada endpoint yang membocorkan daftar tautan milik pengguna lain.
6. **Menghapus tautan** — saat dihapus, tautan dihapus dari Redis (sehingga berhenti berfungsi untuk siapa pun) sekaligus dari localStorage pembuatnya.

---

## Struktur File

```
.
├── index.html         # Halaman utama, form, FAQ, Terms & Privacy
├── style.css          # Styling UI
├── app.js             # Logika UI, localStorage, dan pemanggilan API
├── middleware.js      # Edge middleware — menangani redirect slug ke URL asli
├── vercel.json        # Konfigurasi rewrite untuk Vercel
├── package.json       # Dependency (@upstash/redis)
├── lib/
│   └── redis.js       # Koneksi ke database Upstash Redis
├── api/
│   ├── shorten.js     # POST — membuat tautan baru
│   ├── check.js       # GET  — mengecek ketersediaan alias
│   └── links.js       # GET/DELETE — mengambil & menghapus data tautan
├── logo.png           # Aset logo
└── README.md          # Dokumentasi
```

---

## Deployment

Karena sekarang mengandalkan Serverless Functions dan Edge Middleware, proyek ini **di-hosting di Vercel** (bukan lagi GitHub Pages, yang hanya mendukung file statis).

### Setup singkat

1. Push repositori ini ke GitHub, lalu import ke [Vercel](https://vercel.com).
2. Di dashboard project → **Storage** → tambahkan integrasi **Upstash for Redis** (gratis untuk skala kecil), lalu hubungkan (**Connect to Project**) ke project ini.
3. Pastikan environment variable `KV_REST_API_URL` dan `KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) sudah muncul di **Settings → Environment Variables**. Vercel akan menambahkannya otomatis saat integrasi terhubung.
4. Redeploy project agar environment variable terbaca oleh function.

---

## Penggunaan Lokal

Karena proyek ini bergantung pada Serverless Functions, Edge Middleware, dan database Redis, menjalankannya secara lokal butuh [Vercel CLI](https://vercel.com/docs/cli), bukan sekadar membuka `index.html` di browser.

1. Clone repositori:
```
git clone https://github.com/taqii-zet/ShortLink.git
cd ShortLink
```

2. Install dependency:
```
npm install
```

3. Install Vercel CLI (jika belum ada) dan hubungkan project:
```
npm i -g vercel
vercel link
```

4. Tarik environment variable dari project Vercel:
```
vercel env pull .env.development.local
```

5. Jalankan secara lokal (ini akan menjalankan API routes & middleware sekaligus):
```
vercel dev
```

---

## Privasi & Keamanan

* Tidak ada akun atau proses sign-up — siapa pun bisa langsung membuat tautan.
* Data tujuan tautan tersimpan di server, tapi daftar "My Links" tetap privat per browser/perangkat.
* Fitur QR Code memanggil layanan pihak ketiga (`api.qrserver.com`) hanya untuk menghasilkan gambar QR dari URL tujuan — tidak ada data lain yang dikirim.
* Detail lebih lanjut tersedia di section **Terms of Service** dan **Privacy Policy** pada halaman utama situs.