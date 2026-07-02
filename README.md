# ShortLink — URL Shortener

ShortLink adalah penyingkat URL berbasis web yang simpel dan ringan. Aplikasi ini sepenuhnya berjalan di sisi klien (client-side), artinya semua data tautan disimpan langsung di browser pengguna tanpa perlu database eksternal, akun, atau pelacakan privasi.

Live Demo: https://taqii-zet.github.io/ShortLink/

---

## Fitur

* Penyingkat tautan instan tanpa proses ribet.
* Pilihan custom slug atau acak menggunakan generator tombol dadu.
* Live preview tampilan URL pendek saat mengetik slug.
* Riwayat pembuatan tautan (My Links) yang tersimpan di localStorage.
* Fitur pencarian internal untuk menyaring riwayat tautan.
* Counter sederhana untuk melihat total tautan yang dibuat dan jumlah klik.
* 100% privasi aman karena tidak menggunakan server maupun pelacak eksternal.

---

## Teknologi

Proyek ini dibuat menggunakan teknologi web dasar agar performanya maksimal dan ringan:
* HTML5 (Struktur halaman dan modal)
* CSS3 (Layouting, responsivitas, dan efek overlay)
* Vanilla JavaScript (Logika pemendekan, pengelolaan localStorage, dan sistem redirect parameter)

---

## Cara Kerja Redirection

Karena aplikasi ini di-hosting di GitHub Pages yang bersifat statis, proses pengalihan menggunakan parameter URL:
1. Ketika tautan diperpendek, data disimpan dengan format key-value `{ slug: long_url }` di localStorage.
2. Saat ada yang mengakses URL dengan parameter (contoh: `?s=slug-kamu`), JavaScript di index.html akan langsung membaca parameter tersebut, mencocokkannya dengan memori lokal, menampilkan animasi redirect, lalu mengarahkan pengguna ke URL tujuan asli.

---

## Struktur File

.
├── index.html       # Halaman utama dan komponen redirect
├── style.css        # Styling UI
├── app.js           # Logika utama aplikasi
├── logo.png         # Aset logo
└── README.md        # Dokumentasi

---

## Penggunaan Lokal

Kalau mau coba jalankan atau edit proyek ini di lokal:

1. Clone repositori:
   git clone https://github.com/taqii-zet/ShortLink.git

2. Masuk ke folder:
   cd ShortLink

3. Buka file index.html langsung di browser atau gunakan extension Live Server.