Untuk setup React Native pertama kalinya, ikuti panduan [PPK 101](PPK%20101.md).

## Dokumentasi
- [PPK 101](PPK%20101.md)
- [Mobile Environment Configuration](docs/Mobile%20Environment%20Configuration.md)

## Pembagian SRS/Fitur — Sprint 1

### Programmer 1
- Programmer 1 - FR-01 : Memilih peran dan identitas pengguna.
- Programmer 1 - FR-02 : Melihat jadwal praktikum.
- Programmer 1 - FR-03 : Melihat detail sesi praktikum.
- Programmer 1 - FR-05 : Melakukan presensi dan mencegah presensi ganda.
- Programmer 1 - FR-07 : Melihat riwayat kehadiran.

### Programmer 2
- Programmer 2 - FR-02 : Melihat jadwal praktikum dari sisi asisten.
- Programmer 2 - FR-03 : Melihat detail sesi praktikum.
- Programmer 2 - FR-04 : Membuka dan menutup sesi praktikum.
- Programmer 2 - FR-06 : Melihat rekap presensi praktikan.
- Programmer 2 - FR-08 : Menangani modal konfirmasi, validasi, dan empty state.

### Urutan Pengerjaan
1. Programmer 1 menyiapkan fondasi navigasi dan pemilihan peran.
2. Programmer 1 dan Programmer 2 mengerjakan fitur masing-masing secara paralel.
3. Kedua programmer melakukan integrasi dan pengujian.

**Catatan:** Sprint 1 menggunakan dummy data dan state lokal. Sinkronisasi presensi antara praktikan dan asisten tidak diwajibkan.

## Pembagian SRS/Fitur — Sprint 2

Sprint 2 mengganti dummy data dengan Firebase Authentication dan Cloud Firestore, menambahkan sinkronisasi real-time, alur pengajuan izin, serta klasifikasi alasan menggunakan API AI dari pengajar. Kedua programmer perlu menyepakati skema Firestore, nama koleksi, tipe data, dan kontrak fungsi service sebelum integrasi.

### Programmer 1 — Autentikasi, Data Praktikan, dan Pengajuan Izin

- Menyiapkan konfigurasi Firebase client untuk aplikasi dan memastikan konfigurasi rahasia/credential tidak dimasukkan ke repository. Mendokumentasikan variabel konfigurasi yang dibutuhkan.
- Mengimplementasikan Firebase Authentication: registrasi, login, logout, pemulihan state sesi saat aplikasi dibuka kembali, serta tampilan loading dan pesan kegagalan yang mudah dipahami.
- Membuat dan memelihara profil pengguna di Firestore yang terikat pada `uid` Firebase Authentication. Profil memuat identitas yang diperlukan dan peran `praktikan` atau `asisten`; alur registrasi tidak boleh membiarkan pengguna menetapkan dirinya sebagai asisten tanpa mekanisme otorisasi yang disepakati.
- Membuat navigasi dan tampilan yang disesuaikan dengan status login dan peran. Praktikan hanya melihat jadwal, kelas, dan sesi yang terkait dengan keanggotaannya.
- Mengimplementasikan pembacaan data kelas, peserta, jadwal, serta sesi milik praktikan dari Firestore, termasuk listener real-time untuk perubahan status sesi.
- Mengimplementasikan presensi praktikan pada sesi yang terbuka. Simpan identitas praktikan dan sesi secara konsisten, gunakan ID dokumen deterministik atau transaksi agar presensi ganda tidak dapat dibuat, dan tangani sesi tertutup/kegagalan jaringan.
- Mengimplementasikan pengajuan izin untuk sesi tertentu: validasi alasan, penyimpanan pengajuan beserta status awal `pending`, dan tampilan daftar pengajuan serta status keputusan secara real-time.
- Mengintegrasikan pemanggilan API AI dari pengajar untuk klasifikasi alasan. Simpan hasil kategori sebagai informasi pendukung; jika API gagal atau tidak merespons, pengajuan tetap tersimpan dan dapat diproses asisten tanpa klasifikasi. Hasil AI tidak boleh mengubah status keputusan.
- Menyediakan state loading, kosong, offline/gagal memuat, dan retry yang sesuai pada layar praktikan.

### Programmer 2 — Data Asisten, Keputusan Izin, dan Keamanan

- Menyepakati dan mendokumentasikan skema koleksi Firestore bersama Programmer 1, termasuk relasi kelas/peserta, jadwal/sesi, presensi, dan pengajuan izin. Menentukan field wajib, format waktu, status sesi, dan status izin.
- Mengimplementasikan tampilan asisten untuk melihat kelas, peserta, jadwal, sesi, dan rekap presensi. Gunakan listener real-time agar perubahan sesi dan presensi dari praktikan langsung tercermin.
- Mengimplementasikan CRUD yang diperlukan asisten untuk kelas, peserta, jadwal, dan sesi, dengan validasi input serta konfirmasi sebelum penghapusan.
- Mengimplementasikan pembukaan dan penutupan sesi. Perubahan status disimpan di Firestore dan langsung diperbarui pada antarmuka praktikan. Validasi bahwa hanya asisten berwenang yang dapat mengubah status sesi.
- Mengimplementasikan daftar pengajuan izin beserta alasan, kategori hasil AI (jika tersedia), identitas praktikan, dan sesi yang dimaksud. Sediakan tindakan menerima atau menolak dengan status dan metadata keputusan yang tercatat.
- Menerapkan Firebase Security Rules untuk membatasi akses berdasarkan `request.auth.uid` dan peran yang tersimpan secara tepercaya: praktikan hanya membaca data yang relevan dan membuat presensi/pengajuan atas nama sendiri; asisten yang berwenang mengelola data praktikum serta memutuskan izin. Aturan harus memvalidasi field penting dan mencegah perubahan identitas pemilik.
- Menangani error Firestore, data kosong, state loading, dan kegagalan koneksi pada layar asisten; pastikan tindakan tulis menampilkan hasil berhasil/gagal.
- Menyiapkan dokumentasi setup Firebase project, aktivasi Authentication dan Firestore, penerapan Security Rules, serta langkah konfigurasi API AI sesuai informasi dari pengajar.

### Kontrak Integrasi Bersama

- Sepakati koleksi dan field sebelum kedua sisi mulai mengandalkan data bersama. Contoh koleksi yang dapat disesuaikan: `users`, `classes`, `schedules` atau `sessions`, `attendance`, dan `permissionRequests`.
- Pisahkan akses data ke service/repository agar layar tidak melakukan query Firestore secara langsung dan kedua programmer memakai aturan query serta validasi yang sama.
- Gunakan status eksplisit dan konsisten, misalnya sesi `scheduled`/`open`/`closed` dan izin `pending`/`approved`/`rejected`. Kategori AI disimpan di field terpisah dari status keputusan.
- Programmer 1 dan Programmer 2 mengintegrasikan perubahan pada branch bersama secara berkala, lalu meninjau aturan akses dan alur dua peran bersama.

### Urutan Pengerjaan dan Kriteria Selesai

1. Bersama-sama menyepakati skema Firestore, kontrak service, daftar status, sumber peran tepercaya, serta konfigurasi Firebase dan API AI.
2. Programmer 1 mengerjakan autentikasi dan alur praktikan; Programmer 2 mengerjakan layar asisten, CRUD, Security Rules, dan alur keputusan izin. Integrasikan melalui kontrak data yang disepakati.
3. Demonstrasikan alur presensi: asisten membuka sesi, praktikan mengirim satu presensi, rekap asisten berubah real-time, lalu asisten menutup sesi.
4. Demonstrasikan alur izin: praktikan mengirim alasan, klasifikasi AI tampil atau kegagalannya ditangani, asisten memberi keputusan, dan status keputusan terlihat oleh praktikan.
5. Pastikan data tetap tersedia setelah aplikasi dimulai ulang, akses lintas peran ditolak oleh Security Rules bila tidak berwenang, dan kedua alur menampilkan kondisi loading, kosong, input tidak valid, serta kegagalan layanan.

## Reset Project

Gunakan script berikut hanya saat setup awal jika memang diperlukan.

```bash
# Hati-hati! Perintah ini dapat mengubah struktur project.
npm run reset-project
```
