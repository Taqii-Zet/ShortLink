# 🔗 ShortLink — URL Shortener

**ShortLink** adalah aplikasi penyingkat URL berbasis web yang minimalis, cepat, dan sepenuhnya berjalan di sisi klien (client-side). Tidak perlu mendaftar akun, bebas pelacakan, dan semua data tautan Anda disimpan dengan aman secara lokal di browser Anda.

> **Live Demo:** [taqii-zet.github.io/ShortLink](https://taqii-zet.github.io/ShortLink/)

---

## ✨ Fitur Utama

* **⚡ Penyingkat Instan:** Cukup tempel URL panjang Anda, dan dapatkan tautan pendek dalam hitungan detik.
* **🎲 Custom Slug:** Tentukan sendiri kata kunci (*slug*) untuk tautan Anda, atau gunakan tombol dadu untuk menghasilkan *slug* acak secara otomatis.
* **👁️ Live Preview:** Lihat tampilan tautan pendek Anda secara langsung saat Anda mengetik *slug*.
* **📜 Riwayat Lokal (My Links):** Semua tautan yang telah Anda buat akan disimpan di browser menggunakan `localStorage`. Dilengkapi juga dengan fitur pencarian (*search bar*) untuk menyaring tautan.
* **📊 Statistik Sederhana:** Memantau total tautan yang dibuat dan total klik secara keseluruhan.
* **🛡️ Tanpa Server & Pelacakan:** 100% privasi terjaga. Tidak ada database eksternal, tidak ada cookies pelacak, semuanya berjalan di perangkat Anda.
* **🌗 Tampilan Minimalis & Responsif:** Desain modern menggunakan font Inter dan DM Mono yang nyaman dilihat di perangkat mobile maupun desktop.

---

## 🛠️ Teknologi yang Digunakan

Aplikasi ini dibangun murni menggunakan teknologi web statis tanpa *framework* berat, sehingga sangat ringan dan cepat diakses:

* **HTML5** – Struktur semantik halaman.
* **CSS3** – Desain visual, *layouting* (Flexbox/Grid), dan animasi overlay.
* **JavaScript (Vanilla)** – Logika penyingkatan, manajemen `localStorage`, deteksi parameter URL untuk *redirect*, pencarian riwayat, dan manipulasi DOM.

---

## 🚀 Cara Kerja (Under the Hood)

Karena proyek ini di-hosting di **GitHub Pages** yang bersifat statis, proses pemendekan tautan menggunakan trik parameter URL:

1.  **Pembuatan Tautan:** Ketika Anda menyingkat URL, aplikasi menyimpan pasangan data `{ slug: long_url }` ke dalam `localStorage`.
2.  **Pengalihan (Redirection):** Saat seseorang membuka tautan pendek (misal: `?s=custom-slug`), JavaScript di halaman `index.html` akan langsung mendeteksi parameter `s` tersebut, mengambil URL asli dari memori lokal (atau skema yang ditentukan), memunculkan efek *redirect overlay*, dan mengalihkan halaman ke tujuan asli.

---

## 📂 Struktur File

```text
.
├── index.html       # Struktur halaman utama & modal redirect
├── style.css        # Desain visual dan animasi (belum termasuk di repositori ini)
├── app.js           # Logika utama aplikasi (belum termasuk di repositori ini)
├── logo.png         # Logo aplikasi
└── README.md        # Dokumentasi proyek
