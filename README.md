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

## Pembagian SRS/Fitur — Sprint 4

Sprint 4 menyempurnakan manajemen laboratorium dengan peran baru **Aslab** (*Asisten Laboratorium*), memfokuskan peran **Asprak** (*Asisten Praktikum*), menambahkan sistem perhitungan keterlambatan (*grace period*) dan denda tetap, mengintegrasikan pembayaran denda menggunakan **Midtrans (Sandbox)** melalui alur **client–server–payment gateway**, menghubungkan notifikasi tagihan & pembayaran, serta memfinalisasi antarmuka yang modern, konsisten, dan berjalan stabil pada **iOS dan Android**.

### Programmer 1 — Navigasi 3 Peran, Keterlambatan & Denda Praktikan, Pembayaran Midtrans Client, Riwayat & Notifikasi, serta Finalisasi UI Praktikan (iOS & Android)

- **Autentikasi & Navigasi 3 Peran (`praktikan`, `asprak`, `aslab`):**
  - Memperbarui pemetaan peran pengguna pada [`AppNavigator`](src/navigation/AppNavigator.tsx) dengan `Stack.Protected` untuk rute `/student/*`, `/asprak/*` (kompatibel dengan peran transisi `asisten` bila ada migrasi data), dan `/aslab/*`.
  - Registrasi mandiri dari aplikasi tetap dikunci ke peran `praktikan`; penetapan `asprak` atau `aslab` tetap dikontrol di server/Console/admin atau melalui alur manajemen berwenang yang dilindungi Security Rules.
- **Perhitungan Keterlambatan (*Grace Period*) & Pencatatan Denda:**
  - Memperbarui alur presensi ([`attendance-service.ts`](src/services/attendance-service.ts)) agar membandingkan waktu presensi dengan `startTime` sesi serta konfigurasi toleransi (`gracePeriodMinutes`) milik laboratorium/sesi terkait: presensi sebelum atau tepat pada akhir masa toleransi dicatat sebagai `on_time`; setelah melewati batas dicatat sebagai `late`.
  - Saat tercatat `late`, buat maksimal **satu tagihan denda** dengan ID deterministik (`fines/{sessionId}_{studentId}`) berisi nominal tetap sesuai kebijakan, terhubung ke `studentId`, `sessionId`, dan `attendanceId`.
  - Memastikan praktikan dengan izin berstatus `approved` dicatat sebagai tidak hadir dengan izin (`excused_absence`), **tidak dikenakan denda**, dan keputusan izin **tidak pernah** mengubah catatan kehadiran menjadi hadir; pembayaran denda juga **tidak** mengubah status kehadiran praktikan.
- **Pembayaran Denda Midtrans Sandbox (Sisi Client iOS & Android):**
  - Menyediakan layar daftar tagihan & rincian nominal denda milik praktikan (total tunggakan, detail sesi, keterlambatan dalam menit, dan status `pending` / `paid`).
  - Memanggil endpoint backend untuk membuat transaksi Snap Midtrans (tidak pernah menyimpan `Server Key` di aplikasi React Native).
  - Mengarahkan praktikan ke halaman pembayaran Midtrans Snap menggunakan `react-native-webview` atau `expo-web-browser` agar berjalan mulus di **iOS dan Android**.
  - Membaca status pembayaran akhir (`pending`, `success`, `failed`) dan status tagihan secara real-time dari Firestore setelah diverifikasi oleh webhook backend — tidak menentukan status lunas hanya dari respons redirect sisi client.
- **Riwayat Pembayaran & Transaksi:**
  - Menyediakan layar **Riwayat Pembayaran** yang menampilkan nama sesi, tanggal tagihan, nominal denda, waktu transaksi, dan status pembayaran (`pending`, `success`, `failed`). Data tersimpan persisten di Firestore sehingga tetap tersedia setelah aplikasi ditutup dan dibuka kembali.
- **Notifikasi Denda & Pembayaran (iOS APNs & Android FCM):**
  - Memperbarui [`NotificationRuntime.tsx`](src/components/NotificationRuntime.tsx) dan [`notification-service.ts`](src/services/notification-service.ts) untuk menangani klik & tampilan notifikasi event `fine_created`, `payment_success`, dan `payment_failed` secara konsisten di **iOS dan Android** (termasuk izin notifikasi iOS & channel Android).
- **Finalisasi Antarmuka Praktikan (iOS & Android):**
  - Menyeragamkan desain kartu, badge status, empty/loading/error state, `SafeAreaView` (notch & home indicator iOS, edge-to-edge Android), serta `KeyboardAvoidingView` pada seluruh layar praktikan.

### Programmer 2 — Manajemen Lab & 3 Bulk Insert (Aslab), Dashboard Keberlangsungan Lab, Ruang Lingkup Asprak, Backend Midtrans + Webhook, Security Rules & Konfigurasi Build iOS/Android

- **Ekstensi Skema Firestore & Kontrak Backend Sprint 4:**
  - Menyepakati bersama Programmer 1 penambahan role `aslab` dan `asprak` di `users/{uid}`, kebijakan laboratorium (`courseName`, `gracePeriodMinutes`, `lateFineAmount`, `attendanceCoverage` / `radiusMeters`) di `labs/{labId}`, keanggotaan asprak/aslab pada lab, status keterlambatan (`on_time` | `late` | `excused_absence`) pada `attendance`, serta koleksi baru `fines` dan `paymentTransactions`.
- **Manajemen Laboratorium oleh Aslab (Role Baru):**
  - CRUD data laboratorium: nama, mata kuliah, lokasi/gedung, koordinat `latitude`/`longitude`, cakupan lokasi & radius validasi presensi, serta pengaturan batas toleransi keterlambatan (*grace period*) dan nominal denda tetap.
  - **Tiga fitur bulk / single insert terpisah** (bukan satu bulk gabungan untuk ketiganya):
    1. **Bulk / single insert Laboratorium** sekaligus berdasarkan satu mata kuliah.
    2. **Bulk / single insert data Praktikan** ke laboratorium tertentu.
    3. **Bulk / single insert data Asprak** ke laboratorium tertentu.
  - **Downloadable Template File:** menyediakan tombol unduh/ekspor file template CSV/XLSX untuk masing-masing dari ketiga jenis bulk insert menggunakan `expo-file-system` + `expo-sharing` agar berfungsi di **iOS** (Share Sheet / Files) dan **Android** (Save/Share).
  - **Staging Review List Interaktif (`ScrollView`):** setiap baris hasil impor bulk tampil sebagai daftar yang dapat ditinjau ulang sebelum disimpan — Aslab dapat melakukan *accept / deny* per baris, menyunting nilai, serta melengkapi data yang masih kosong sebelum commit batch ke Firestore.
  - **Perpindahan Antar-Laboratorium:** memindahkan praktikan dan asprak/aslab dari satu laboratorium ke laboratorium lainnya **tanpa memindahkan jadwal praktikum**.
- **Dashboard Keberlangsungan Laboratorium (Aslab):**
  - Menampilkan ringkasan & pemantauan berbasis data real-time Firebase dengan filter **Hari / Minggu / Bulan**:
    - Jumlah total laboratorium dan praktikan terdaftar.
    - Status kegiatan praktikum di setiap laboratorium (berjalan, terjadwal, selesai).
    - Informasi lokasi lab dan waktu pelaksanaan sesi.
    - Jadwal praktikum yang sedang berlangsung (`open`) dan yang akan datang (`scheduled`).
    - Riwayat kegiatan laboratorium.
    - **Riwayat keuangan hasil denda praktikum** (total terbayar, tertunda, gagal, serta rincian transaksi per sesi/periode).
- **Pembatasan & Pengelolaan Sesi oleh Asprak:**
  - Memfokuskan antarmuka & kewenangan Asprak pada kelas/laboratorium yang menjadi tanggung jawabnya: melihat kelas/jadwal/sesi yang diampu, membuka sesi, memantau & mengelola presensi praktikan (termasuk status tepat waktu/terlambat), memutus pengajuan izin (`approved` -> `excused_absence` bebas denda), dan menutup sesi.
  - Perubahan status sesi tetap tersinkronisasi secara real-time ke aplikasi praktikan; Asprak tidak dapat mengubah konfigurasi global seluruh lab maupun memindahkan praktikan lintas laboratorium.
- **Backend Payment Service (Midtrans Sandbox) & Webhook:**
  - Membangun service backend (Firebase Cloud Functions v2 atau Node.js/Express/Cloud Run) menggunakan `MIDTRANS_SERVER_KEY` (Sandbox) dan Firebase Admin SDK:
    - `POST /api/payments/create`: memverifikasi Firebase Auth ID Token pengaju, memvalidasi kepemilikan & status tagihan di `fines`, membuat transaksi ke Midtrans Snap Sandbox API, menyimpan record awal `pending` di `paymentTransactions`, lalu mengembalikan `snapToken` & `redirectUrl`.
    - `POST /api/payments/webhook`: memverifikasi `signature_key` SHA-512 dari Midtrans, memetakan status Midtrans (`settlement`/`capture` → `success`; `pending` → `pending`; `deny`/`cancel`/`expire`/`failure` → `failed`), memperbarui `paymentTransactions` dan `fines` secara transaksional, serta memicu push notification (`payment_success` / `payment_failed`).
  - Memicu push notification `fine_created` saat tagihan denda baru dibuat (melalui backend/trigger atau service terintegrasi) dengan penanganan kegagalan yang tidak merusak data utama Firestore.
- **Pembaruan Firebase Security Rules (`firestore.rules`):**
  - Memperbarui aturan akses untuk 3 peran (`praktikan`, `asprak`, `aslab`):
    - Hanya `aslab` yang dapat membuat/mengelola laboratorium global, kebijakan toleransi/denda, bulk insert, dan memindahkan praktikan/asprak antar-lab.
    - `asprak` hanya boleh mengelola sesi, presensi, dan keputusan izin pada kelas/lab yang menjadi tanggung jawabnya.
    - `praktikan` hanya dapat membaca `fines` & `paymentTransactions` miliknya sendiri dan **dilarang keras** mengubah status pembayaran menjadi `success`/`failed` dari client (penulisan status terverifikasi hanya via backend/Admin SDK).
- **Finalisasi Antarmuka Aslab/Asprak & Konfigurasi Build iOS + Android:**
  - Menyeragamkan desain UI modern & konsisten di seluruh layar Aslab dan Asprak (responsif di iOS & Android) serta melengkapi konfigurasi `ios.bundleIdentifier`, izin `Info.plist`, APNs, FCM, dan panduan build lintas platform.

### Kontrak Integrasi Bersama (Sprint 4)

- **Koleksi & Field Tambahan Firestore:**

| Koleksi | Field Kunci & Ekstensi Sprint 4 | Keterangan |
| --- | --- | --- |
| `users/{uid}` | `role`: `'praktikan' \| 'asprak' \| 'aslab'` *(atau migrasi dari `'asisten'`)* | Sumber peran tepercaya; tidak dapat diubah oleh pengguna sendiri. |
| `labs/{labId}` | `courseName`, `building`, `latitude`, `longitude`, `radiusMeters`, `gracePeriodMinutes`, `lateFineAmount`, `asprakIds`, `aslabIds` | Konfigurasi lokasi & kebijakan keterlambatan/denda per lab. |
| `sessions/{sessionId}` | `labId`, `labName`, `gracePeriodMinutes` *(opsional override)*, `lateFineAmount` *(opsional override)* | Jadwal sesi yang tertaut ke laboratorium. |
| `attendance/{sessionId}_{studentId}` | `attendanceStatus`: `'on_time' \| 'late' \| 'excused_absence'`, `lateMinutes`: `number`, `attendedAt`, `latitude`, `longitude`, `distanceMeters` | ID deterministik; status kehadiran tidak berubah akibat pembayaran denda. |
| `fines/{sessionId}_{studentId}` | `studentId`, `studentName`, `studentIdentifier`, `sessionId`, `classId`, `labId`, `attendanceId`, `practicalName`, `sessionDate`, `amount`, `lateMinutes`, `status`: `'pending' \| 'paid'`, `latestTransactionId`, `createdAt`, `paidAt` | ID deterministik → satu kejadian keterlambatan hanya menghasilkan satu tagihan denda. |
| `paymentTransactions/{orderId}` | `orderId`, `fineId`, `sessionId`, `studentId`, `amount`, `paymentType`, `snapToken`, `redirectUrl`, `status`: `'pending' \| 'success' \| 'failed'`, `midtransTransactionStatus`, `paidAt`, `createdAt`, `updatedAt` | Riwayat transaksi persisten; status final hanya ditulis oleh backend setelah verifikasi webhook Midtrans. |

- **Kontrak Push Notification Tambahan Sprint 4:**

| Peristiwa | `type` | Field Tambahan Payload | Tujuan Saat Notifikasi Ditekan |
| --- | --- | --- | --- |
| Tagihan denda baru dibuat | `fine_created` | `fineId`, `sessionId` | Halaman Tagihan & Denda Praktikan |
| Pembayaran berhasil | `payment_success` | `orderId`, `fineId` | Halaman Riwayat Pembayaran |
| Pembayaran gagal / kedaluwarsa | `payment_failed` | `orderId`, `fineId` | Halaman Tagihan / Riwayat Pembayaran |

- **Aturan Keamanan Pembayaran:** `MIDTRANS_SERVER_KEY` dan verifikasi `signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)` wajib berjalan **hanya di backend**. Aplikasi mobile hanya memanggil endpoint backend dengan `EXPO_PUBLIC_PAYMENT_API_URL` + Firebase Auth ID Token.

### Panduan Pengembangan & Build iOS dan Android (Sampai Selesai)

#### 1. Library & Konfigurasi Lintas Platform (`app.json` & `.env`)
- Gunakan **`npx expo install`** untuk seluruh paket baru agar versi sesuai SDK Expo proyek (`package.json`):
  ```bash
  npx expo install expo-document-picker expo-file-system expo-sharing
  ```
- Lengkapi [`app.json`](app.json) agar siap di-build di **kedua platform**:
  - **Android:** `android.package` (`com.sirielfahri.ppkrnexpo58`), plugin `expo-location` & `expo-notifications`, serta `GOOGLE_MAPS_API_KEY` melalui [`app.config.js`](app.config.js) / EAS Environment Variables.
  - **iOS:** tambahkan **`ios.bundleIdentifier`** (mis. `com.sirielfahri.ppkrnexpo58`), `ios.supportsTablet: false` (atau sesuai kebutuhan), serta deskripsi izin `ios.infoPlist` bila diperlukan (`NSLocationWhenInUseUsageDescription` otomatis dari plugin `expo-location`, dan `UIBackgroundModes: ["remote-notification"]` bila menerima push background).
- **Variabel Environment Client (`.env` / EAS Env):**
  - Tetap gunakan seluruh `EXPO_PUBLIC_FIREBASE_*`, `GOOGLE_MAPS_API_KEY`, dan tambahkan `EXPO_PUBLIC_PAYMENT_API_URL` (URL backend payment + Midtrans Sandbox). **Jangan** pernah menaruh `MIDTRANS_SERVER_KEY` di `.env` aplikasi Expo.
- **Variabel Environment Backend Payment:**
  - `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=false`, dan kredensial Firebase Admin SDK.

#### 2. Alur Build & Pengujian Android
```bash
# 1. Pastikan Google Maps key & Firebase env sudah terpasang di .env / .env.local / EAS Env
# 2. Unggah kredensial FCM v1 agar push notification Android bekerja pada Development/Preview build
npx eas-cli@latest credentials --platform android

# 3. Buat Development Build Android (.apk internal untuk development + native modules)
npx eas-cli@latest build --profile development --platform android

# 4. Jalankan Metro server untuk Development Build yang terinstal di perangkat fisik Android
npx expo start --dev-client

# 5. Build APK rilis uji coba final (tanpa perlu Metro server terhubung)
npx eas-cli@latest build --profile preview --platform android
```

#### 3. Alur Build & Pengujian iOS
- **Opsi A — iOS Simulator (macOS, tanpa akun Apple Developer berbayar):**
  - Tambahkan profil simulator di [`eas.json`](eas.json) (`"ios": { "simulator": true }` di bawah `build.development`), pastikan `ios.bundleIdentifier` sudah diisi di [`app.json`](app.json), lalu build:
    ```bash
    npx eas-cli@latest build --profile development --platform ios
    ```
  - Unduh hasil `.tar.gz`/`.app` lalu tarik ke iOS Simulator dan jalankan `npx expo start --dev-client`. *(Catatan: Remote Push Notification APNs & GPS hardware penuh hanya dapat diuji di perangkat iPhone fisik; gunakan perangkat fisik untuk verifikasi APNs.)*
- **Opsi B — Perangkat Fisik iPhone (memerlukan Apple Developer Account):**
  ```bash
  # 1. Daftarkan Apple Distribution/Development Certificate, Provisioning Profile & APNs Key
  npx eas-cli@latest credentials --platform ios

  # 2. Daftarkan UDID iPhone untuk internal distribution
  npx eas-cli@latest device:create

  # 3. Buat Development Build atau Preview IPA untuk iPhone fisik
  npx eas-cli@latest build --profile development --platform ios
  # atau rilis uji coba final:
  npx eas-cli@latest build --profile preview --platform ios
  ```

#### 4. Checklist Pengujian Lintas Platform & Kode Sebelum Selesai
- Jalankan pemeriksaan statis wajib sebelum setiap merge:
  ```bash
  npx tsc --noEmit
  npx expo lint
  npx expo-doctor
  ```
- Verifikasi di **iOS dan Android** secara langsung:
  1. Tampilan UI konsisten (SafeArea notch/home bar, scroll, modal, form bulk review `ScrollView`, keyboard tidak menutupi input).
  2. Unduh template bulk insert & pilih file upload bekerja di Files iOS maupun File Manager Android.
  3. Presensi lokasi (tepat waktu, terlambat dengan denda otomatis, di luar radius ditolak) & izin disetujui sebagai `excused_absence` tanpa denda.
  4. Checkout Midtrans Snap Sandbox, verifikasi webhook, pembaruan status `pending`/`success`/`failed`, notifikasi (`fine_created`, `payment_success`, `payment_failed`), dan persistensi riwayat pembayaran setelah app ditutup & dibuka ulang.

### Urutan Pengerjaan dan Kriteria Selesai (Sprint 4)

1. **Fase 1 — Kontrak Data, 3 Peran & Backend Setup:** Sepakati skema Firestore Sprint 4 (`aslab`/`asprak`/`praktikan`, `labs`, `fines`, `paymentTransactions`), tambahkan `ios.bundleIdentifier` di `app.json`, dan siapkan kerangka backend Midtrans Sandbox + Webhook.
2. **Fase 2 — Implementasi Paralel Inti:**
   - **Programmer 1:** update navigasi 3 peran, perhitungan *grace period* & pencatatan denda deterministik, halaman tagihan & checkout Midtrans client, halaman riwayat pembayaran, dan handler notifikasi baru.
   - **Programmer 2:** CRUD lab + 3 alur bulk insert terpisah dengan downloadable template & `ScrollView` staging editor, perpindahan praktikan/asprak antar-lab, dashboard keberlangsungan lab Aslab (filter hari/minggu/bulan + riwayat keuangan denda), pembatasan ruang lingkup Asprak, serta endpoint backend Midtrans + Webhook & pembaruan `firestore.rules`.
3. **Fase 3 — Integrasi Pembayaran, Notifikasi & Security Rules:** Hubungkan client ke backend Sandbox, uji callback/webhook dengan status `settlement`, `pending`, `expire`/`deny`, pastikan notifikasi diterima di iOS & Android, dan uji aturan akses lintas peran di `firestore.rules`.
4. **Fase 4 — Finalisasi UI & Build Akhir iOS + Android:** Lakukan polesan UI konsisten di semua peran, jalankan `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor`, lalu hasilkan build akhir Android (`.apk`) & iOS (Simulator/Device) serta demonstrasikan seluruh skenario end-to-end.

**Kriteria Selesai Sprint 4:**
- Aslab dapat mengelola lab, menjalankan ketiga bulk/single insert secara terpisah dari template yang bisa diunduh, meninjau & mengedit baris di list `ScrollView`, memindahkan praktikan & asprak/aslab antar-lab (tanpa memindahkan jadwal), serta memantau dashboard keberlangsungan lab + riwayat keuangan denda dengan filter hari/minggu/bulan.
- Asprak dapat membuka/menutup sesi dan memantau presensi sesuai kelas/lab tanggung jawabnya secara real-time tanpa akses konfigurasi global lab.
- Presensi menghitung *grace period* dengan benar; keterlambatan menghasilkan tepat 1 tagihan denda tetap; izin disetujui menjadi `excused_absence` bebas denda; pembayaran denda tidak mengubah status kehadiran.
- Pembayaran Midtrans Sandbox berjalan melalui backend + verifikasi webhook (tanpa secret key di client), status `pending`/`success`/`failed` tampil akurat, notifikasi tagihan & pembayaran diterima praktikan, dan riwayat pembayaran tetap persisten setelah aplikasi dibuka ulang di **iOS dan Android**.

## Reset Project

Gunakan script berikut hanya saat setup awal jika memang diperlukan.

```bash
# Hati-hati! Perintah ini dapat mengubah struktur project.
npm run reset-project
```
