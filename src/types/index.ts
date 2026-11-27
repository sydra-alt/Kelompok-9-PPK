/**
 * Kontrak tipe data bersama.
 * Semua layar praktikan & asisten mengimpor tipe dari sini agar tidak ada
 * definisi ganda. Ubah file ini hanya setelah koordinasi dengan PM.
 *
 * Sprint 2: tipe di bawah mengikuti skema Firestore yang didokumentasikan
 * di `docs/Firestore Schema.md`. Nilai status & peran HARUS sama persis
 * dengan nilai yang disimpan di Firestore.
 */

// ---------------------------------------------------------------------------
// Pengguna
// ---------------------------------------------------------------------------

/** Peran tepercaya yang tersimpan di `users/{uid}.role`. */
export type UserRole = 'praktikan' | 'asisten' | 'aslab';

/** Profil pengguna di koleksi `users/{uid}` (ID dokumen = uid Firebase Auth). */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  /** NIM untuk praktikan; ID/NIP untuk asisten atau aslab. */
  identifier: string;
  role: UserRole;
  /** Format waktu lokal: YYYY-MM-DDTHH:mm:ss (null jika belum tersinkron). */
  createdAt: string | null;
}

/**
 * @deprecated Sprint 1 — hanya dipakai data dummy alur asisten yang belum
 * dimigrasi ke Firestore. Gunakan `UserProfile` untuk kode baru.
 */
export type DummyRole = 'student' | 'assistant';

/** @deprecated Sprint 1 — gunakan `UserProfile`. */
export interface DummyUser {
  id: string;
  name: string;
  role: DummyRole;
  /** NIM untuk praktikan, NIP/ID asisten untuk asisten. */
  identifier: string;
  /** Kelas praktikan. Untuk asisten boleh berisi daftar kelas yang diampu. */
  className: string;
}

// ---------------------------------------------------------------------------
// Kelas & keanggotaan
// ---------------------------------------------------------------------------

/** Dokumen `classes/{classId}`. */
export interface PracticeClass {
  id: string;
  /** Nama kelas, mis. "TI-3A". */
  name: string;
  /** Nama mata praktikum, mis. "Pemrograman Mobile". */
  practicalName: string;
  /** uid asisten pengampu. */
  assistantIds: string[];
}

/** Dokumen `classMembers/{classId}_{studentId}`. */
export interface ClassMembership {
  id: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
}

/** Dokumen `labs/{labId}` yang dipakai peta dan validasi radius presensi. */
export interface Lab {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  building?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Sesi / jadwal
// ---------------------------------------------------------------------------

export type SessionStatus = 'scheduled' | 'open' | 'closed';

/** Dokumen `sessions/{sessionId}` — satu pertemuan praktikum terjadwal. */
export interface PracticeSession {
  id: string;
  /** Referensi ke `classes/{classId}`. */
  classId?: string;
  /** Referensi ke `labs/{labId}`; wajib untuk presensi berbasis lokasi. */
  labId?: string;
  labName?: string;
  practicalName: string;
  className: string;
  /** Format: YYYY-MM-DD */
  date: string;
  /** Format: HH:mm */
  startTime: string;
  /** Format: HH:mm */
  endTime: string;
  status: SessionStatus;
  /** Informasi tambahan opsional untuk detail sesi. */
  topic?: string;
  room?: string;
  assistantName?: string;
}

// ---------------------------------------------------------------------------
// Presensi
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'on_time' | 'late' | 'excused_absence';

/** Dokumen `attendance/{sessionId}_{studentId}` (ID deterministik mencegah duplikasi). */
export interface AttendanceRecord {
  id: string;
  sessionId: string;
  classId?: string;
  studentId: string;
  studentName: string;
  studentIdentifier?: string;
  /** Format lokal Asia/Jakarta: YYYY-MM-DDTHH:mm:ss; null untuk excused absence. */
  attendanceTime: string | null;
  attendanceStatus?: AttendanceStatus;
  lateMinutes?: number;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
}

// ---------------------------------------------------------------------------
// Pengajuan izin
// ---------------------------------------------------------------------------

export type PermissionStatus = 'pending' | 'approved' | 'rejected';

/** Status proses klasifikasi AI — TERPISAH dari status keputusan izin. */
export type AiClassificationStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface AiClassification {
  status: AiClassificationStatus;
  /** Sentimen hasil model EDOM; bukan kategori alasan izin atau keputusan. */
  sentiment: string | null;
  /** Tidak disediakan sebagai probabilitas oleh model EDOM. */
  confidence: number | null;
  /** Pesan galat singkat bila klasifikasi gagal. */
  error: string | null;
}

/** Dokumen `permissionRequests/{sessionId}_{studentId}`. */
export interface PermissionRequest {
  id: string;
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  /** Salinan ringkas info sesi agar daftar tidak perlu query tambahan. */
  practicalName: string;
  className: string;
  sessionDate: string;
  reason: string;
  status: PermissionStatus;
  aiClassification: AiClassification;
  /** Format waktu lokal: YYYY-MM-DDTHH:mm:ss */
  createdAt: string | null;
  decidedAt: string | null;
  decidedBy?: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
}
