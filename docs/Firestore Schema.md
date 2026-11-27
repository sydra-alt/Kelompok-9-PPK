# Konfigurasi Environment & Kontrak Skema Firestore (Sprint 2 & Sprint 3)

Dokumen ini menjelaskan konfigurasi environment, skema data Firestore, dan kontrak service layer aplikasi.

---

## 1. Variabel Konfigurasi Environment (`.env` & `.env.local`)

Aplikasi membaca konfigurasi Firebase client melalui variabel `EXPO_PUBLIC_*` di [`src/services/firebase/config.ts`](../src/services/firebase/config.ts), serta key Google Maps Android melalui [`app.config.js`](../app.config.js). Analisis sentimen alasan izin memakai model EDOM lokal di folder [`ai/`](../ai/) dan tidak memerlukan endpoint AI.

1. Salin [`.env.example`](../.env.example) menjadi `.env` (dan isi `.env.local` untuk `GOOGLE_MAPS_API_KEY`) di root proyek.
2. Isi variabel berikut:

| Variabel | Wajib | Keterangan |
| --- | :---: | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Ya | API Key Web App dari Firebase Console |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Ya | `<project-id>.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Ya | ID project Firebase |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Opsional | `<project-id>.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Opsional | Nomor pengirim FCM/project number |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Ya | App ID Web (`1:...:web:...`) |
| `GOOGLE_MAPS_API_KEY` | Ya (Android) | Key Google Maps SDK for Android di `.env.local` untuk build/run native |
| `EXPO_PUBLIC_AI_CLASSIFIER_API_KEY` | Opsional | Bearer token API AI (jika dibutuhkan endpoint pengajar) |
| `EXPO_PUBLIC_PUSH_DISPATCH_MODE` | Opsional | `client` (default, via Expo Push API) atau `server` (bila memakai Cloud Functions) |
| `EXPO_PUBLIC_PUSH_SERVICE_URL` | Opsional | Endpoint pengiriman Expo Push API (default `https://exp.host/--/api/v2/push/send`) |

> **Keamanan Repository:** Berkas `.env`, `.env*.local`, `google-services.json`, dan `GoogleService-Info.plist` telah dimasukkan ke [`.gitignore`](../.gitignore) agar tidak ikut ter-commit.

---

## 2. Sumber Peran Tepercaya & Otorisasi

- Setiap pengguna memiliki dokumen profil di `users/{uid}` dengan `uid` yang sama persis dengan `request.auth.uid` Firebase Authentication.
- Field `role` hanya bernilai `'praktikan'` atau `'asisten'`.
- **Alur registrasi aplikasi** ([`registerStudent`](../src/services/auth-service.ts)) selalu menetapkan `role: 'praktikan'`. Tidak ada pilihan peran pada layar registrasi.
- **Penetapan peran `asisten`** dilakukan oleh pengajar/admin dengan mengubah field `role` menjadi `'asisten'` pada dokumen `users/{uid}` di Firebase Console. Security Rules wajib menolak perubahan `role` oleh pengguna sendiri.

---

## 3. Skema Koleksi Cloud Firestore

Nama koleksi dan helper ID deterministik didefinisikan di [`src/services/firestore-schema.ts`](../src/services/firestore-schema.ts).

### 3.1 `users/{uid}`
Profil pengguna terikat pada `uid` Firebase Auth.
- `uid`: `string` (wajib, `== uid` dokumen)
- `name`: `string` (wajib)
- `email`: `string` (wajib, huruf kecil)
- `identifier`: `string` (wajib — NIM untuk praktikan, NIP/ID asisten untuk asisten)
- `role`: `'praktikan' | 'asisten'` (wajib)
- `pushTokens`: `string[]` (opsional, Expo Push Token untuk perangkat pengguna)
- `pushTokenUpdatedAt`: `Timestamp` (opsional, waktu token terakhir didaftarkan)
- `createdAt`: `Timestamp`
- `updatedAt`: `Timestamp`

### 3.2 `classes/{classId}`
Data kelas praktikum yang dikelola asisten.
- `name`: `string` (wajib, mis. `"TI-3A"`)
- `practicalName`: `string` (wajib, mis. `"Pemrograman Mobile"`)
- `assistantIds`: `string[]` (daftar `uid` asisten pengampu kelas)
- `createdAt`: `Timestamp`

### 3.3 `classMembers/{classId}_{studentId}`
Relasi keanggotaan praktikan pada kelas. ID dokumen deterministik: `classMemberId(classId, studentId)`.
- `classId`: `string` (wajib)
- `className`: `string` (wajib, denormalisasi nama kelas)
- `studentId`: `string` (wajib, `uid` praktikan)
- `studentName`: `string` (wajib)
- `studentIdentifier`: `string` (wajib, NIM praktikan)
- `createdAt`: `Timestamp`

### 3.4 `sessions/{sessionId}`
Jadwal dan status sesi pertemuan praktikum.
- `classId`: `string` (wajib, referensi ke `classes/{classId}`)
- `className`: `string` (wajib, mis. `"TI-3A"`)
- `practicalName`: `string` (wajib)
- `date`: `string` (wajib, format `YYYY-MM-DD`)
- `startTime`: `string` (wajib, format `HH:mm`)
- `endTime`: `string` (wajib, format `HH:mm`)
- `status`: `'scheduled' | 'open' | 'closed'` (wajib)
- `topic`: `string` (opsional)
- `room`: `string` (opsional)
- `assistantName`: `string` (opsional)
- `labId`: `string` (wajib untuk Sprint 3, referensi ke `labs/{labId}`)
- `labName`: `string` (opsional, denormalisasi untuk tampilan)
- `updatedAt`: `Timestamp`

### 3.5 `labs/{labId}`
Lokasi laboratorium yang menjadi acuan marker Maps dan validasi radius presensi.
- `name`: `string` (wajib)
- `latitude`: `number` (wajib, rentang -90 sampai 90)
- `longitude`: `number` (wajib, rentang -180 sampai 180)
- `radiusMeters`: `number` (wajib, lebih besar dari 0)
- `building`: `string` (opsional)
- `description`: `string` (opsional)
- `createdAt`, `updatedAt`: `Timestamp` (opsional)

### 3.6 `attendance/{sessionId}_{studentId}`
Catatan kehadiran praktikan. ID dokumen deterministik: `attendanceId(sessionId, studentId)` + dibuat melalui transaksi Firestore ([`submitAttendance`](../src/services/attendance-service.ts)) sehingga presensi ganda tidak dapat dibuat.
- `sessionId`: `string` (wajib)
- `classId`: `string` (wajib)
- `studentId`: `string` (wajib, `== request.auth.uid`)
- `studentName`: `string` (wajib)
- `studentIdentifier`: `string` (wajib, NIM)
- `attendedAt`: `Timestamp` (wajib, `serverTimestamp()`)
- `createdAt`: `Timestamp`
- `latitude`: `number` (wajib untuk presensi Sprint 3)
- `longitude`: `number` (wajib untuk presensi Sprint 3)
- `distanceMeters`: `number` (wajib untuk presensi Sprint 3)

### 3.7 `permissionRequests/{sessionId}_{studentId}`
Pengajuan izin praktikan untuk sesi tertentu. ID dokumen deterministik: `permissionRequestId(sessionId, studentId)`.
- `sessionId`: `string` (wajib)
- `classId`: `string` (wajib)
- `studentId`: `string` (wajib, `== request.auth.uid`)
- `studentName`: `string` (wajib)
- `studentIdentifier`: `string` (wajib, NIM)
- `practicalName`: `string` (wajib)
- `className`: `string` (wajib)
- `sessionDate`: `string` (wajib, `YYYY-MM-DD`)
- `reason`: `string` (wajib, 10–500 karakter)
- `status`: `'pending' | 'approved' | 'rejected'` (wajib — saat dibuat oleh praktikan selalu `'pending'`)
- `aiClassification`: `map` (terpisah dari `status` keputusan!)
  - `status`: `'pending' | 'success' | 'failed' | 'skipped'`
  - `sentiment`: `string | null` (`positif`, `netral`, atau `negatif`)
  - `confidence`: `null` untuk model EDOM (skor model bukan probabilitas)
  - `error`: `string | null`
  - `classifiedAt`: `Timestamp | null`
- `createdAt`: `Timestamp`
- `updatedAt`: `Timestamp`
- `decidedAt`: `Timestamp | null` (diisi asisten saat menerima/menolak)
- `decidedBy`: `string | null` (`uid` asisten)
- `decidedByName`: `string | null` (nama asisten)
- `decisionNote`: `string | null` (catatan keputusan asisten, opsional)

---

## 4. Kontrak Service Layer

Seluruh kode layar tidak memanggil SDK Firestore secara langsung, melainkan melalui:

### Layanan praktikan, autentikasi & perangkat
- [`src/services/auth-service.ts`](../src/services/auth-service.ts) — login, registrasi praktikan, reset sandi, logout, dan listener profil `users/{uid}`.
- [`src/services/student-data-service.ts`](../src/services/student-data-service.ts) — listener real-time keanggotaan kelas, kelas, peserta, laboratorium, sesi, presensi, dan pengajuan izin milik praktikan.
- [`src/services/attendance-service.ts`](../src/services/attendance-service.ts) — validasi status sesi, cek radius laboratorium (Haversine via [`src/utils/distance.ts`](../src/utils/distance.ts)), dan transaksi presensi anti-duplikat.
- [`src/services/location-service.ts`](../src/services/location-service.ts) — permintaan izin lokasi foreground, pembacaan koordinat GPS terkini, serta pemantauan posisi untuk Peta Lab.
- [`src/services/notification-service.ts`](../src/services/notification-service.ts) — pendaftaran & pembersihan Expo Push Token di `users/{uid}.pushTokens`.
- [`src/services/permission-service.ts`](../src/services/permission-service.ts) — validasi alasan, transaksi pembuatan pengajuan izin (`pending`), dan penyimpanan hasil sentimen lokal.
- [`src/services/ai-classifier.ts`](../src/services/ai-classifier.ts) — inferensi sentimen lokal dengan model EDOM; teks alasan tidak dikirim ke API AI.

### Layanan asisten, laboratorium, push dispatch & security rules
- [`src/services/assistant-data-service.ts`](../src/services/assistant-data-service.ts) — listener real-time dan CRUD kelas, peserta, sesi (beserta relasi `labId`/`labName`), pembukaan/penutupan sesi, rekap presensi, dan keputusan izin.
- [`src/services/lab-service.ts`](../src/services/lab-service.ts) — listener real-time dan CRUD koleksi `labs` beserta validasi rentang koordinat dan radius.
- [`src/services/notification-dispatch-service.ts`](../src/services/notification-dispatch-service.ts) — pemicu & pengiriman push notification non-blocking untuk event `session_opened`, `schedule_changed`, serta `permission_approved`/`permission_rejected`.

---

## 5. Ringkasan Firebase Security Rules (`firestore.rules`)

Aturan akses lengkap didefinisikan di [`firestore.rules`](../firestore.rules):
- **Akses Publik Ditolak:** Seluruh koleksi membutuhkan `request.auth != null && request.auth.uid != null`.
- **`users/{uid}`:** Hanya pemilik (`request.auth.uid == uid`) atau asisten berwenang yang boleh membaca profil & `pushTokens`. Registrasi hanya boleh menetapkan `role: 'praktikan'`; pembaruan oleh pemilik dibatasi pada profil & `pushTokens` tanpa perubahan `role` atau `uid`.
- **`labs/{labId}`:** Terbaca oleh pengguna terautentikasi; tambah/ubah/hapus hanya oleh asisten berwenang dengan validasi koordinat `[-90, 90]` / `[-180, 180]` dan `radiusMeters` `(0, 10000]`.
- **`classes/{classId}` & `classMembers/{memberId}`:** Terbaca oleh pengguna terautentikasi; CRUD hanya oleh asisten berwenang.
- **`sessions/{sessionId}`:** Terbaca oleh pengguna terautentikasi; tambah, ubah jadwal/lab (`labId`, `labName`), ubah status (`scheduled`/`open`/`closed`), dan hapus hanya oleh asisten berwenang.
- **`attendance/{sessionId}_{uid}`:** Asisten membaca semua presensi; praktikan hanya membaca miliknya. Praktikan hanya dapat `create` dengan ID deterministik saat sesi berstatus `open`, `labId` valid, dan metadata `latitude`, `longitude`, serta `distanceMeters <= lab.radiusMeters`. Operasi `update` selalu ditolak (`false`).
- **`permissionRequests/{sessionId}_{uid}`:** Asisten membaca semua izin dan memutuskan `approved`/`rejected` dengan mencatat `decidedBy == request.auth.uid`. Praktikan hanya membuat izin atas namanya sendiri (`status: 'pending'`) dan hanya boleh memperbarui field `aiClassification` & `updatedAt` selama masih `pending`.

Deploy aturan ke Firebase Project dengan Firebase CLI:
```bash
firebase deploy --only firestore:rules
```
