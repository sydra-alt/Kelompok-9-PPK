# Data Uji Presensi Lokasi Sprint 3

Dokumen ini mencatat data uji yang sudah dibuat teman kelompok di Firebase
Console, berdasarkan informasi yang dibagikan.

## 1. Laboratorium

Dokumen `labs/lab-ti-01`:

```json
{
  "name": "Lab Praktikum",
  "latitude": -7.049,
  "longitude": 110.438004,
  "radiusMeters": 300,
  "building": "FSM"
}
```

Gunakan titik koordinat ini sebagai acuan saat membandingkan posisi perangkat.

## 2. Sesi praktikum yang tertaut ke lab

Dokumen `sessions/6helXuM3s0WFcBDjrypj`:

```json
{
  "classId": "kelas-ti-01",
  "className": "TI-3A",
  "practicalName": "Praktikum",
  "date": "2026-11-19",
  "startTime": "19:00",
  "endTime": "21:00",
  "status": "scheduled",
  "labId": "lab-ti-01",
  "labName": "Lab Praktikum"
}
```

Kelas `classes/kelas-ti-01` bernama `TI-3A`; anggota uji adalah
`rwHLRxuPmWX0BYCviD1lzRCvIh03`. Sesi masih `scheduled`; ubah ke `open` dari akun
asisten saat siap menguji presensi. Pastikan Firestore Rules mengizinkan
praktikan membaca `labs` serta membuat attendance dengan field koordinat dan
jarak.
