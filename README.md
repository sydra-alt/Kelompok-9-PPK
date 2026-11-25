Untuk setup React Native pertama kalinya, ikuti panduan [PPK 101](PPK%20101.md).

## Dokumentasi
- [PPK 101](PPK%20101.md)
- [Mobile Environment Configuration](docs/Mobile%20Environment%20Configuration.md)
- [Konfigurasi Environment & Skema Firestore (Sprint 2 & 3)](docs/Firestore%20Schema.md)
- [Sprint 3 — Setup Maps, Izin Perangkat, FCM & Security Rules](docs/Sprint%203%20Setup%20Maps%20%26%20FCM.md)
- [Sprint 3 — Kontrak Push Notification](docs/Sprint%203%20Kontrak%20Notifikasi.md)
- [Sprint 3 — Data Uji Presensi Lokasi](docs/Sprint%203%20Data%20Uji.md)

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

## Pembagian SRS/Fitur — Sprint 3

Sprint 3 menambahkan validasi lokasi fisik pada presensi, peta interaktif laboratorium Informatika beserta aktivitas praktikum secara real-time, serta push notification berbasis peristiwa (pembukaan sesi, perubahan jadwal, dan keputusan izin). Seluruh fitur tetap terintegrasi dengan Firebase Authentication, Cloud Firestore, dan aturan keamanan dari Sprint 2.

### Programmer 1 — Halaman Presensi Berbasis Lokasi, Peta Laboratorium, dan Client Notifikasi

- Membuat halaman presensi khusus yang terpisah dari halaman detail sesi untuk menampilkan ringkasan sesi, status sesi secara real-time, serta tombol dan alur pencatatan presensi *(opsional: fitur pemindaian QR Code dari sisi praktikan)*.
- Mengimplementasikan layanan lokasi perangkat (geolocation) dan validasi radius presensi (perhitungan jarak koordinat perangkat terhadap koordinat & radius laboratorium di Firestore). Validasi lokasi wajib menjadi bagian dari proses pencatatan presensi: tolak presensi jika sesi tidak `open`, pengguna berada di luar radius, atau lokasi belum diperoleh; pertahankan pencegahan presensi ganda (ID deterministik/transaksi) dan simpan metadata lokasi/jarak presensi.
- Mengimplementasikan halaman Maps interaktif yang menampilkan seluruh marker laboratorium Informatika dari Firestore serta marker posisi pengguna yang diperbarui mengikuti pergerakan perangkat selama halaman aktif.
- Menampilkan informasi laboratorium saat marker dipilih, mencakup data laboratorium serta daftar praktikum yang **sedang berlangsung** (`open`) dan **praktikum berikutnya** (`scheduled`) berdasarkan jadwal/sesi Firestore (nama praktikum, kelas, waktu pelaksanaan, status sesi) yang ikut berubah secara real-time.
- Mengimplementasikan sisi client push notification: meminta izin notifikasi, mendaftarkan dan menyimpan push token (FCM / Expo Push Token) milik pengguna ke Firestore, serta menangani notifikasi masuk (foreground/background/interaksi klik).
- Menangani izin dan kondisi perangkat secara menyeluruh pada layar praktikan & Maps: izin lokasi/notifikasi ditolak, GPS/layanan lokasi mati, koordinat belum tersedia, koneksi bermasalah, atau notifikasi gagal diterima, lengkap dengan pesan yang jelas dan opsi coba ulang / buka pengaturan.

### Programmer 2 — Pengelolaan Laboratorium, Pengiriman Push Notification, dan Security Rules

- Menyepakati dan mendokumentasikan perluasan skema Firestore Sprint 3 bersama Programmer 1: koleksi `labs` (nama, koordinat `latitude`/`longitude`, `radiusMeters`, keterangan), relasi `labId` pada `sessions`, metadata lokasi pada `attendance`, serta field/koleksi token notifikasi pengguna.
- Mengimplementasikan manajemen lokasi laboratorium bagi asisten (CRUD data laboratorium, penentuan koordinat dan radius validasi presensi) yang tersimpan di Firestore agar langsung menjadi acuan validasi presensi dan marker pada halaman Maps.
- Menghubungkan pembuatan dan penyuntingan jadwal/sesi asisten dengan laboratorium (`labId`) sehingga perubahan jadwal atau status sesi langsung tercermin pada informasi aktivitas laboratorium di peta, serta menampilkan metadata validasi lokasi pada rekap kehadiran *(opsional: menampilkan QR Code sesi bagi asisten)*.
- Mengimplementasikan mekanisme pemicu dan pengiriman push notification (FCM / Cloud Functions / push service) berdasarkan peristiwa aplikasi kepada pengguna yang berkepentingan:
  1. Saat asisten membuka sesi praktikum → kirim ke praktikan anggota kelas terkait.
  2. Saat asisten mengubah jadwal praktikum → kirim ke praktikan anggota kelas terkait.
  3. Saat asisten menerima atau menolak pengajuan izin → kirim ke praktikan yang mengajukan izin.
- Menangani kegagalan pengiriman notifikasi agar tidak membatalkan penyimpanan data utama di Firestore serta menampilkan umpan balik yang jelas pada antarmuka asisten.
- Memperbarui Firebase Security Rules untuk koleksi `labs` (baca untuk pengguna terautentikasi, tulis hanya untuk asisten berwenang), token notifikasi (pengguna hanya mengelola token miliknya sendiri), dan validasi field lokasi pada dokumen `attendance`.
- Menyiapkan dokumentasi konfigurasi layanan Maps, izin lokasi/notifikasi pada `app.json` (Development Build), serta setup Firebase Cloud Messaging (FCM).

### Kontrak Integrasi Bersama

- Sepakati skema koleksi baru dan tambahan field sebelum implementasi paralel: koleksi `labs` (`id`, `name`, `latitude`, `longitude`, `radiusMeters`, `building`), field `labId` & `labName` pada `sessions`, metadata lokasi (`latitude`, `longitude`, `distanceMeters`) pada `attendance`, serta penyimpanan token notifikasi (`users/{uid}.pushTokens` atau koleksi `deviceTokens`).
- Pisahkan utilitas lokasi/jarak (mis. rumus Haversine), akses data laboratorium, dan service notifikasi ke dalam layer `src/services/` agar konsisten di seluruh layar.
- Pastikan validasi sesi (`open`), validasi radius lokasi, dan pencegahan presensi ganda berjalan terpadu pada service presensi sebelum dokumen `attendance` dicatat ke Firestore.
- Karena fitur Maps, lokasi perangkat, dan FCM membutuhkan modul native, sepakati penggunaan **Development Build (`expo-dev-client`)** bersama setelah konfigurasi plugin native ditambahkan di `app.json`.

### Urutan Pengerjaan dan Kriteria Selesai

1. Bersama-sama menyepakati skema koleksi `labs`, relasi `sessions.labId`, format token notifikasi, konfigurasi plugin Maps & FCM di `app.json`, serta menyiapkan Development Build Android bersama.
2. Programmer 1 mengerjakan halaman presensi berbasis lokasi, halaman Maps + aktivitas laboratorium real-time, serta penerimaan notifikasi & penanganan izin perangkat; Programmer 2 mengerjakan CRUD laboratorium + integrasi `labId` pada sesi, pemicu pengiriman push notification, pembaruan Security Rules, dan dokumentasi setup.
3. Demonstrasikan alur **Presensi berbasis lokasi**: asisten membuka sesi → praktikan membuka halaman presensi khusus → aplikasi memeriksa lokasi perangkat terhadap radius lab → presensi ditolak bila di luar radius dan berhasil dicatat (maksimal 1 kali) bila memenuhi ketentuan → asisten melihat rekap kehadiran.
4. Demonstrasikan alur **Peta dan informasi laboratorium**: pengguna membuka halaman Maps → posisi pengguna dan marker seluruh lab Informatika tampil → pengguna memilih marker lab → informasi praktikum yang sedang berlangsung dan praktikum berikutnya tampil sesuai data Firestore real-time.
5. Demonstrasikan alur **Notifikasi kegiatan**: asisten membuka sesi, mengubah jadwal, atau memutuskan pengajuan izin → sistem mengirim push notification → praktikan terkait menerima notifikasi, dan kondisi izin ditolak/GPS mati/offline tertangani dengan pesan yang jelas.

## Reset Project

Gunakan script berikut hanya saat setup awal jika memang diperlukan.

```bash
# Hati-hati! Perintah ini dapat mengubah struktur project.
npm run reset-project
```
