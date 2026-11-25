# Kontrak Push Notification Sprint 3

## Penyimpanan token client

- Expo Push Token disimpan pada `users/{uid}.pushTokens` sebagai `string[]`.
- Client mendaftarkan token memakai `arrayUnion` agar token yang sama tidak ditulis berulang.
- `pushTokenUpdatedAt` memakai Firestore `serverTimestamp()` saat pendaftaran ulang.
- Firestore Rules harus mengizinkan pengguna mengubah token hanya pada dokumen `users/{uid}` miliknya, tanpa mengizinkan perubahan `role` atau `uid`.

## Payload yang ditangani client

| Peristiwa | `type` | Field tambahan | Tujuan saat notifikasi ditekan |
| --- | --- | --- | --- |
| Sesi dibuka | `session_opened` | `sessionId` | Halaman presensi sesi |
| Jadwal berubah | `schedule_changed` | `sessionId` | Detail sesi |
| Izin disetujui | `permission_approved` | Opsional `requestId` | Daftar pengajuan izin |
| Izin ditolak | `permission_rejected` | Opsional `requestId` | Daftar pengajuan izin |

Pengiriman berdasarkan peristiwa dan pemilihan penerima dikerjakan melalui [`src/services/notification-dispatch-service.ts`](../src/services/notification-dispatch-service.ts) (dengan mode default `client` ke Expo Push Service atau opsional `server` melalui Cloud Functions).

## Implementasi Pengiriman & Kegagalan (Programmer 2)

1. **Resolusi penerima & token:**
   - Event `session_opened` & `schedule_changed`: mengambil daftar `studentId` anggota kelas terkait dari `classMembers`, lalu membaca `users/{uid}.pushTokens` (format `ExponentPushToken[...]` / `ExpoPushToken[...]`).
   - Event `permission_approved` & `permission_rejected`: mengambil `pushTokens` milik `request.studentId`.
2. **Isolasi kegagalan (non-blocking):**
   - Pengiriman notifikasi selalu dijalankan **setelah** operasi tulis utama di Firestore (`updateSessionStatus`, `updateSession`, `decidePermissionRequest`) berhasil.
   - Jika tidak ada token terdaftar, penerima kosong, timeout, atau endpoint push gagal merespons, data utama di Firestore **tidak dibatalkan** dan UI asisten menampilkan `FeedbackBanner` status gabungan (berhasil tersimpan + catatan pengiriman notifikasi).
3. **Mode server opsional:**
   - Untuk memakai Firebase Cloud Functions (`onDocumentUpdated`), atur `EXPO_PUBLIC_PUSH_DISPATCH_MODE=server` pada `.env` agar perangkat asisten tidak mengirim push ganda (panduan lihat [Sprint 3 Setup Maps & FCM](Sprint%203%20Setup%20Maps%20%26%20FCM.md)).

Remote push Android perlu diuji pada development build dan membutuhkan konfigurasi kredensial push FCM v1 di Expo/EAS.
