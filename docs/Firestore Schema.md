# Konfigurasi Environment & Kontrak Skema Firestore (Sprint 2)

Dokumen ini menjadi acuan bersama antara **Programmer 1** (Autentikasi, Alur Praktikan, Presensi, Pengajuan Izin & AI Classifier) dan **Programmer 2** (Alur Asisten, CRUD, Keputusan Izin & Security Rules).

---

## 1. Variabel Konfigurasi Environment (`.env`)

Aplikasi membaca konfigurasi Firebase client dan API AI melalui variabel `EXPO_PUBLIC_*` di [`src/services/firebase/config.ts`](../src/services/firebase/config.ts).

1. Salin [`.env.example`](../.env.example) menjadi `.env` di root proyek.
2. Isi variabel berikut:

| Variabel | Wajib | Keterangan |
| --- | :---: | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Ya | API Key Web App dari Firebase Console |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Ya | `<project-id>.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Ya | ID project Firebase |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Opsional | `<project-id>.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Opsional | Nomor pengirim FCM/project number |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Ya | App ID Web (`1:...:web:...`) |
| `EXPO_PUBLIC_AI_CLASSIFIER_URL` | Opsional | Endpoint HTTP POST API AI klasifikasi alasan izin dari pengajar |
| `EXPO_PUBLIC_AI_CLASSIFIER_API_KEY` | Opsional | Bearer token API AI (jika dibutuhkan endpoint pengajar) |
| `EXPO_PUBLIC_AI_CLASSIFIER_TIMEOUT_MS` | Opsional | Batas waktu request API AI dalam milidetik (default `10000`) |

> **Keamanan Repository:** Berkas `.env`, `google-services.json`, dan `GoogleService-Info.plist` telah dimasukkan ke [`.gitignore`](../.gitignore) agar tidak ikut ter-commit.

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
- `updatedAt`: `Timestamp`

### 3.5 `attendance/{sessionId}_{studentId}`
Catatan kehadiran praktikan. ID dokumen deterministik: `attendanceId(sessionId, studentId)` + dibuat melalui transaksi Firestore ([`submitAttendance`](../src/services/attendance-service.ts)) sehingga presensi ganda tidak dapat dibuat.
- `sessionId`: `string` (wajib)
- `classId`: `string` (wajib)
- `studentId`: `string` (wajib, `== request.auth.uid`)
- `studentName`: `string` (wajib)
- `studentIdentifier`: `string` (wajib, NIM)
- `attendedAt`: `Timestamp` (wajib, `serverTimestamp()`)
- `createdAt`: `Timestamp`

### 3.6 `permissionRequests/{sessionId}_{studentId}`
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
  - `category`: `string | null`
  - `confidence`: `number | null`
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
- [`src/services/auth-service.ts`](../src/services/auth-service.ts) — login, registrasi praktikan, reset sandi, logout, dan listener profil `users/{uid}`.
- [`src/services/student-data-service.ts`](../src/services/student-data-service.ts) — listener real-time keanggotaan kelas, kelas, peserta, sesi, presensi, dan pengajuan izin milik praktikan.
- [`src/services/attendance-service.ts`](../src/services/attendance-service.ts) — validasi status sesi dan transaksi presensi anti-duplikat.
- [`src/services/permission-service.ts`](../src/services/permission-service.ts) — validasi alasan, transaksi pembuatan pengajuan izin (`pending`), dan pembaruan hasil klasifikasi AI.
- [`src/services/ai-classifier.ts`](../src/services/ai-classifier.ts) — pemanggilan HTTP ke API AI dari pengajar dengan timeout & fallback aman.

