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

## Reset Project

Gunakan script berikut hanya saat setup awal jika memang diperlukan.

```bash
# Hati-hati! Perintah ini dapat mengubah struktur project.
npm run reset-project
```
