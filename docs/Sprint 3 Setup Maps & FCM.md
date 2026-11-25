# Panduan Setup Sprint 3 — Maps, Izin Perangkat, FCM & Security Rules

Dokumen ini melengkapi kebutuhan konfigurasi Sprint 3 untuk menjalankan Peta Laboratorium (`react-native-webview` / Google Maps JavaScript API), validasi lokasi presensi (`expo-location`), pengiriman & penerimaan Push Notification (`expo-notifications` + FCM), serta penerapan Security Rules pada project Firebase.

---

## 1. Konfigurasi Layanan Google Maps

Konfigurasi Maps dibaca secara dinamis oleh [`app.config.js`](../app.config.js) melalui variabel environment `GOOGLE_MAPS_API_KEY` dan disuntikkan ke `extra.googleMapsApiKey` untuk dipakai Google Maps JavaScript API pada layar Peta Laboratorium (`WebView`).

1. Buka [Google Cloud Console](https://console.cloud.google.com/) pada project Google Cloud yang sama dengan Firebase project kelompok.
2. Aktifkan **Maps JavaScript API** (dan **Maps SDK for Android/iOS** bila suatu saat beralih ke native map view).
3. Buat **API Key** baru di menu **APIs & Services -> Credentials**, lalu batasi penggunaannya (API restriction ke **Maps JavaScript API**).
4. Simpan key di file `.env.local` (file ini di-ignore oleh git):
   ```dotenv
   GOOGLE_MAPS_API_KEY=AIzaSy...key-anda...
   ```
5. Tanpa `GOOGLE_MAPS_API_KEY` yang valid pada `.env.local` atau EAS Secret/Environment Variables, [`app.config.js`](../app.config.js) akan menolak menjalankan konfigurasi Expo agar build tidak menghasilkan peta kosong.

---

## 2. Izin Lokasi, Notifikasi & Development Build (`expo-dev-client`)

Fitur Sprint 3 memakai modul native (`expo-location`, `expo-notifications`, `react-native-webview`) yang **membutuhkan Development Build** (remote push Android tidak didukung penuh pada Expo Go standar).

### Plugin yang sudah dikonfigurasi di `app.json` & `app.config.js`
- **`expo-location`** (di [`app.json`](../app.json)): menyertakan `locationWhenInUsePermission` (`ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` di Android dan `NSLocationWhenInUseUsageDescription` di iOS).
- **`expo-notifications`** (di [`app.json`](../app.json)): mendaftarkan izin `POST_NOTIFICATIONS` pada Android 13+ dan handler remote notification native.
- **`extra.googleMapsApiKey`** (di [`app.config.js`](../app.config.js)): meneruskan `GOOGLE_MAPS_API_KEY` ke runtime aplikasi untuk Maps JavaScript API di WebView.

> **Aturan CNG:** Jangan membuat atau menyunting folder `android/` atau `ios/` secara manual. Seluruh perubahan konfigurasi native diatur lewat `app.json` dan `app.config.js`.

### Membuat & Menjalankan Development Build
```bash
# 1. Pastikan GOOGLE_MAPS_API_KEY dan variabel EXPO_PUBLIC_* sudah diisi
# 2. Build Development Client Android melalui EAS
npx eas-cli@latest build --profile development --platform android

# 3. Instal APK Development Build ke perangkat fisik Android
#    (Pengujian Push Token membutuhkan perangkat fisik; simulator/emulator tidak didukung oleh expo-device)

# 4. Jalankan Metro bundler untuk Development Client
npx expo start --dev-client
```

---

## 3. Setup Firebase Cloud Messaging (FCM v1) & Arsitektur Notifikasi

Aplikasi client (`NotificationService` & `NotificationRuntime`) menggunakan **Expo Push Token** (`ExponentPushToken[...]`) yang dikirimkan lewat infrastruktur **Expo Push Service -> FCM v1** untuk Android (dan APNs untuk iOS).

### A. Menghubungkan FCM v1 ke Expo / EAS (Wajib agar Android menerima push)
1. Buka **Firebase Console -> Project Settings -> Cloud Messaging**: pastikan **Firebase Cloud Messaging API (V1)** berstatus *Enabled*.
2. Buka tab **Service Accounts -> Generate new private key** untuk mengunduh file JSON Service Account Google Firebase. *(Jangan pernah commit file ini ke repository.)*
3. Unggah Service Account JSON ke EAS Credentials:
   ```bash
   npx eas-cli@latest credentials --platform android
   # Pilih profile: development -> Push Notifications (FCM V1) -> Upload Service Account Key
   ```
4. Pada perangkat Android fisik praktikan, masuk menggunakan akun praktikan lalu tekan tombol **"Aktifkan Notifikasi"** di Beranda Praktikan agar `users/{uid}.pushTokens` terisi token perangkat.

### B. Alur Pengiriman Sisi Asisten (`notification-dispatch-service.ts`)
Secara default (`EXPO_PUBLIC_PUSH_DISPATCH_MODE=client`), [`src/services/notification-dispatch-service.ts`](../src/services/notification-dispatch-service.ts) memicu pengiriman notifikasi ke Expo Push API (`https://exp.host/--/api/v2/push/send`) setelah write Firestore berhasil untuk 3 peristiwa:
1. **Pembukaan Sesi (`session_opened`)**: asisten mengubah status sesi menjadi `open` -> mencari semua `studentId` di `classMembers` untuk kelas terkait -> mengirim payload `{ type: "session_opened", sessionId }`.
2. **Perubahan Jadwal/Lokasi (`schedule_changed`)**: asisten memperbarui tanggal, waktu, ruangan, atau laboratorium sesi -> mengirim ke anggota kelas dengan payload `{ type: "schedule_changed", sessionId }`.
3. **Keputusan Izin (`permission_approved` / `permission_rejected`)**: asisten menyetujui atau menolak pengajuan izin -> mengirim ke `request.studentId` dengan payload `{ type: "permission_approved" | "permission_rejected", requestId, sessionId }`.

Kegagalan jaringan atau ketiadaan token tidak pernah membatalkan transaksi tulis Firestore dan tetap dilaporkan melalui `FeedbackBanner` di antarmuka asisten.

### C. Opsi Mode Server (Firebase Cloud Functions v2)
Jika tim ingin memindahkan pengiriman HTTP dari perangkat asisten ke backend serverless (membutuhkan paket Firebase Blaze):
1. Atur `EXPO_PUBLIC_PUSH_DISPATCH_MODE=server` pada `.env`.
2. Buat project Cloud Functions terpisah di luar folder aplikasi Expo (`firebase init functions`), lalu dengarkan trigger `onDocumentUpdated` pada `sessions/{sessionId}` dan `permissionRequests/{requestId}` dengan payload yang identik dengan [`docs/Sprint 3 Kontrak Notifikasi.md`](Sprint%203%20Kontrak%20Notifikasi.md):

```ts
// Contoh referensi Cloud Functions v2 (letakkan di project functions terpisah)
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

export const onSessionUpdated = onDocumentUpdated('sessions/{sessionId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const isOpened = before.status !== 'open' && after.status === 'open';
  const isRescheduled =
    before.date !== after.date ||
    before.startTime !== after.startTime ||
    before.endTime !== after.endTime ||
    before.labId !== after.labId;

  if (!isOpened && !isRescheduled) return;
  // Ambil member kelas dari classMembers where classId == after.classId,
  // baca users/{uid}.pushTokens, lalu kirim ke https://exp.host/--/api/v2/push/send
  // dengan data: { type: isOpened ? 'session_opened' : 'schedule_changed', sessionId: event.params.sessionId }
});
```

---

## 4. Penerapan & Verifikasi Firebase Security Rules

Aturan keamanan lengkap tersimpan pada [`firestore.rules`](../firestore.rules) (terhubung lewat [`firebase.json`](../firebase.json)).

### Deploy Rules
```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

### Checklist Uji Security Rules (Positif & Negatif)
1. **Unauthenticated (`request.auth == null`)**: membaca/menulis `labs`, `sessions`, `attendance`, `users`, `permissionRequests` -> **DITOLAK (`permission-denied`)**.
2. **Koleksi `labs`**:
   - Praktikan membaca `labs` -> **DIIZINKAN**.
   - Praktikan membuat/mengubah/menghapus `labs` -> **DITOLAK**.
   - Asisten membuat `labs` dengan `latitude: 120` atau `radiusMeters: 0` -> **DITOLAK** oleh `isValidLab`.
   - Asisten membuat/mengubah `labs` valid -> **DIIZINKAN**.
3. **Token Notifikasi (`users/{uid}`)**:
   - Praktikan A menambahkan token pada `users/{uidA}` (memperbarui `pushTokens` & `pushTokenUpdatedAt`) -> **DIIZINKAN**.
   - Praktikan A mengubah `role` menjadi `'asisten'`, mengubah `uid`, atau mengubah token di `users/{uidB}` -> **DITOLAK**.
   - Praktikan A membaca profil/`pushTokens` milik `users/{uidB}` -> **DITOLAK**.
4. **Presensi (`attendance/{sessionId}_{uid}`)**:
   - Praktikan membuat presensi saat sesi `scheduled`/`closed`, memakai `studentId != auth.uid`, tanpa koordinat valid, atau dengan `distanceMeters > lab.radiusMeters` -> **DITOLAK**.
   - Praktikan mengirim presensi kedua (`update`) pada sesi yang sama -> **DITOLAK** (`allow update: if false`).
   - Praktikan membuat presensi satu kali saat sesi `open` dan dalam radius lab dengan ID deterministik -> **DIIZINKAN**.
5. **Keputusan Izin (`permissionRequests/{sessionId}_{uid}`)**:
   - Praktikan mencoba mengubah `status` pengajuan miliknya menjadi `'approved'` -> **DITOLAK**.
   - Praktikan hanya memperbarui `aiClassification` saat status masih `'pending'` -> **DIIZINKAN**.
   - Asisten menetapkan `status: 'approved' | 'rejected'` dengan `decidedBy == request.auth.uid` tanpa mengubah `reason`/`studentId` -> **DIIZINKAN**.
