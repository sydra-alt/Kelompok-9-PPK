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

Pengiriman berdasarkan peristiwa dan pemilihan penerima dikerjakan sisi server.
Remote push Android perlu diuji pada development build dan membutuhkan
konfigurasi kredensial push di Expo/EAS.
