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
export type UserRole = 'praktikan' | 'asisten';

/** Profil pengguna di koleksi `users/{uid}` (ID dokumen = uid Firebase Auth). */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  /** NIM untuk praktikan, ID asisten untuk asisten. */
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

// ---------------------------------------------------------------------------
// Sesi / jadwal
// ---------------------------------------------------------------------------

export type SessionStatus = 'scheduled' | 'open' | 'closed';

/** Dokumen `sessions/{sessionId}` — satu pertemuan praktikum terjadwal. */
export interface PracticeSession {
  id: string;
  /** Referensi ke `classes/{classId}`. */
  classId?: string;
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

/** Dokumen `attendance/{sessionId}_{studentId}` (ID deterministik → anti presensi ganda). */
export interface AttendanceRecord {
  id: string;
  sessionId: string;
  classId?: string;
  studentId: string;
  studentName: string;
  studentIdentifier?: string;
  /** Format waktu lokal: YYYY-MM-DDTHH:mm:ss */
  attendanceTime: string;
}

// ---------------------------------------------------------------------------
// Pengajuan izin
// ---------------------------------------------------------------------------

export type PermissionStatus = 'pending' | 'approved' | 'rejected';

/** Status proses klasifikasi AI — TERPISAH dari status keputusan izin. */
export type AiClassificationStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface AiClassification {
  status: AiClassificationStatus;
  /** Kategori hasil API AI (mis. "sakit", "keluarga"); null jika belum/gagal. */
  category: string | null;
  /** Skor keyakinan 0..1 bila disediakan API. */
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
