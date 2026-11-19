# Data Uji Presensi Lokasi Sprint 3

Dokumen ini menyiapkan contoh data yang bisa dimasukkan melalui Firebase Console.
Koordinat lab diambil dari titik yang diberikan untuk lokasi uji. Dokumen belum
dapat dibuat langsung di proyek Firebase karena akses Console dan konfigurasi
Firebase lokal tidak tersedia di workspace.

## 1. Laboratorium

Buat koleksi `labs`, lalu buat dokumen dengan ID tetap `lab-ti-01`:

```json
{
  "name": "Laboratorium Informatika",
  "latitude": -7.048048533232636,
  "longitude": 110.44080698128832,
  "radiusMeters": 100,
  "building": "Gedung Informatika",
  "description": "Data awal untuk demonstrasi presensi berbasis lokasi"
}
```

`radiusMeters: 100` adalah radius awal untuk pengujian. Sesuaikan setelah diuji
di perangkat dan pastikan titik koordinat benar-benar berada di lab yang dituju.

## 2. Sesi praktikum yang tertaut ke lab

Buat dokumen di koleksi `sessions` dengan ID, misalnya `session-location-demo`.
Isi field berikut, lalu ganti `classId` dan `className` dengan kelas Firestore
yang benar-benar diikuti akun praktikan uji:

```json
{
  "classId": "GANTI_DENGAN_ID_DOKUMEN_KELAS_AKTIF",
  "className": "GANTI_DENGAN_NAMA_KELAS_AKTIF",
  "practicalName": "Uji Presensi Berbasis Lokasi",
  "date": "2026-11-20",
  "startTime": "08:00",
  "endTime": "10:00",
  "status": "scheduled",
  "labId": "lab-ti-01",
  "labName": "Laboratorium Informatika",
  "room": "Laboratorium Informatika"
}
```

Mulai dengan status `scheduled`. Ubah menjadi `open` dari akun asisten saat
siap menguji presensi. Pastikan Firestore Rules telah mengizinkan praktikan
membaca `labs` serta membuat attendance dengan field koordinat dan jarak.
