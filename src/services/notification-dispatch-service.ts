import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { getErrorMessage, withTimeout } from '@/services/errors';
import { getDb } from '@/services/firebase';
import { COLLECTIONS } from '@/services/firestore-schema';
import type { PermissionRequest, PracticeSession } from '@/types';
import { formatDate } from '@/utils/format';

/**
 * Pemicu dan pengiriman push notification dari alur asisten.
 *
 * Kontrak payload mengikuti `docs/Sprint 3 Kontrak Notifikasi.md` dan ditangani
 * oleh `src/components/NotificationRuntime.tsx` di perangkat penerima:
 * - `session_opened`      + `{ sessionId }`
 * - `schedule_changed`    + `{ sessionId }`
 * - `permission_approved` + `{ requestId, sessionId }`
 * - `permission_rejected` + `{ requestId, sessionId }`
 *
 * Seluruh fungsi `notify*` bersifat non-blocking / fail-safe: kegagalan jaringan
 * atau lookup token TIDAK PERNAH melempar exception agar penyimpanan data utama di
 * Firestore tidak pernah dianggap gagal atau dibatalkan.
 */

export type NotificationEventType =
  | 'session_opened'
  | 'schedule_changed'
  | 'permission_approved'
  | 'permission_rejected';

export interface NotificationDispatchResult {
  status: 'sent' | 'partial' | 'no-recipients' | 'no-tokens' | 'failed' | 'skipped-server-mode';
  recipientCount: number;
  tokenCount: number;
  sentCount: number;
  failedCount: number;
  message: string;
}

interface ExpoPushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

interface ExpoPushMessage extends ExpoPushPayload {
  to: string;
  sound: 'default';
  channelId: 'default';
  priority: 'high';
}

interface ExpoPushTicket {
  status?: string;
  message?: string;
}

const DEFAULT_EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FIRESTORE_LOOKUP_TIMEOUT_MS = 10000;
const PUSH_HTTP_TIMEOUT_MS = 10000;
const MAX_FIRESTORE_IN_VALUES = 30;
const MAX_EXPO_BATCH_SIZE = 100;
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[.+\]$/;

const PUSH_DISPATCH_MODE =
  (process.env.EXPO_PUBLIC_PUSH_DISPATCH_MODE ?? 'client').trim().toLowerCase() === 'server'
    ? 'server'
    : 'client';

const PUSH_SERVICE_URL =
  process.env.EXPO_PUBLIC_PUSH_SERVICE_URL?.trim() || DEFAULT_EXPO_PUSH_URL;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function safeFormatDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || '-';
  return formatDate(date);
}

function extractPushTokens(data: DocumentData | undefined): string[] {
  if (!data || !Array.isArray(data.pushTokens)) return [];
  return data.pushTokens.filter(
    (item): item is string => typeof item === 'string' && EXPO_PUSH_TOKEN_PATTERN.test(item.trim()),
  );
}

/** Mengambil seluruh UID praktikan anggota kelas dari koleksi `classMembers`. */
export async function getClassStudentIds(classId: string): Promise<string[]> {
  const trimmedClassId = classId.trim();
  if (!trimmedClassId) return [];

  const q = query(
    collection(getDb(), COLLECTIONS.classMembers),
    where('classId', '==', trimmedClassId),
  );
  const snap = await withTimeout(
    getDocs(q),
    FIRESTORE_LOOKUP_TIMEOUT_MS,
    'Waktu pembacaan daftar peserta kelas habis.',
  );

  const uniqueIds = new Set<string>();
  for (const memberDoc of snap.docs) {
    const studentId = memberDoc.data()?.studentId;
    if (typeof studentId === 'string' && studentId.trim()) {
      uniqueIds.add(studentId.trim());
    }
  }
  return [...uniqueIds];
}

/** Mengambil Expo Push Token unik dari dokumen `users/{uid}` para penerima. */
export async function getPushTokensForUsers(userIds: string[]): Promise<string[]> {
  const uniqueUserIds = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueUserIds.length === 0) return [];

  const tokenSet = new Set<string>();

  if (uniqueUserIds.length === 1) {
    const userSnap = await withTimeout(
      getDoc(doc(getDb(), COLLECTIONS.users, uniqueUserIds[0])),
      FIRESTORE_LOOKUP_TIMEOUT_MS,
      'Waktu pembacaan token notifikasi pengguna habis.',
    );
    if (userSnap.exists()) {
      for (const token of extractPushTokens(userSnap.data())) {
        tokenSet.add(token);
      }
    }
    return [...tokenSet];
  }

  for (const chunk of chunkArray(uniqueUserIds, MAX_FIRESTORE_IN_VALUES)) {
    const usersQuery = query(
      collection(getDb(), COLLECTIONS.users),
      where(documentId(), 'in', chunk),
    );
    const snap = await withTimeout(
      getDocs(usersQuery),
      FIRESTORE_LOOKUP_TIMEOUT_MS,
      'Waktu pembacaan token notifikasi peserta habis.',
    );
    for (const userDoc of snap.docs) {
      for (const token of extractPushTokens(userDoc.data())) {
        tokenSet.add(token);
      }
    }
  }

  return [...tokenSet];
}

async function sendExpoPushMessages(
  tokens: string[],
  payload: ExpoPushPayload,
): Promise<{ sentCount: number; failedCount: number; lastError: string | null }> {
  let sentCount = 0;
  let failedCount = 0;
  let lastError: string | null = null;

  for (const batch of chunkArray(tokens, MAX_EXPO_BATCH_SIZE)) {
    const messages: ExpoPushMessage[] = batch.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: 'default',
      channelId: 'default',
      priority: 'high',
      data: payload.data,
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PUSH_HTTP_TIMEOUT_MS);

    try {
      const response = await fetch(PUSH_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(messages),
        signal: controller.signal,
      });

      if (!response.ok) {
        failedCount += batch.length;
        lastError = `Layanan push merespons status HTTP ${response.status}.`;
        continue;
      }

      const json = (await response.json()) as { data?: ExpoPushTicket | ExpoPushTicket[] };
      const tickets: ExpoPushTicket[] = Array.isArray(json?.data)
        ? json.data
        : json?.data
          ? [json.data]
          : [];

      if (tickets.length === 0) {
        sentCount += batch.length;
        continue;
      }

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          sentCount += 1;
        } else {
          failedCount += 1;
          if (typeof ticket.message === 'string' && ticket.message.trim()) {
            lastError = ticket.message.trim();
          }
        }
      }

      if (tickets.length < batch.length) {
        failedCount += batch.length - tickets.length;
      }
    } catch (error) {
      failedCount += batch.length;
      const aborted = error instanceof Error && error.name === 'AbortError';
      lastError = aborted
        ? 'Pengiriman notifikasi timeout saat menghubungi layanan push.'
        : 'Gagal menghubungi layanan push notification.';
    } finally {
      clearTimeout(timer);
    }
  }

  return { sentCount, failedCount, lastError };
}

async function dispatchToUsers(
  resolveRecipients: () => Promise<string[]>,
  payload: ExpoPushPayload,
): Promise<NotificationDispatchResult> {
  if (PUSH_DISPATCH_MODE === 'server') {
    return {
      status: 'skipped-server-mode',
      recipientCount: 0,
      tokenCount: 0,
      sentCount: 0,
      failedCount: 0,
      message: 'Pengiriman notifikasi didelegasikan ke Cloud Functions (mode server).',
    };
  }

  try {
    const recipientIds = await resolveRecipients();
    if (recipientIds.length === 0) {
      return {
        status: 'no-recipients',
        recipientCount: 0,
        tokenCount: 0,
        sentCount: 0,
        failedCount: 0,
        message: 'Belum ada praktikan terdaftar pada kelas terkait.',
      };
    }

    const tokens = await getPushTokensForUsers(recipientIds);
    if (tokens.length === 0) {
      return {
        status: 'no-tokens',
        recipientCount: recipientIds.length,
        tokenCount: 0,
        sentCount: 0,
        failedCount: 0,
        message: `${recipientIds.length} praktikan target belum mengaktifkan push notification di perangkatnya.`,
      };
    }

    const { sentCount, failedCount, lastError } = await sendExpoPushMessages(tokens, payload);

    if (sentCount > 0 && failedCount === 0) {
      return {
        status: 'sent',
        recipientCount: recipientIds.length,
        tokenCount: tokens.length,
        sentCount,
        failedCount,
        message: `Notifikasi terkirim ke ${sentCount} perangkat (${recipientIds.length} praktikan).`,
      };
    }

    if (sentCount > 0 && failedCount > 0) {
      return {
        status: 'partial',
        recipientCount: recipientIds.length,
        tokenCount: tokens.length,
        sentCount,
        failedCount,
        message: `Notifikasi terkirim sebagian (${sentCount}/${tokens.length} perangkat). ${lastError ?? ''}`.trim(),
      };
    }

    return {
      status: 'failed',
      recipientCount: recipientIds.length,
      tokenCount: tokens.length,
      sentCount: 0,
      failedCount,
      message: lastError ?? 'Push notification gagal dikirim ke perangkat penerima.',
    };
  } catch (error) {
    return {
      status: 'failed',
      recipientCount: 0,
      tokenCount: 0,
      sentCount: 0,
      failedCount: 0,
      message: getErrorMessage(error, 'Pengiriman notifikasi gagal diproses.'),
    };
  }
}

/** Event 1: Asisten membuka sesi praktikum -> kirim ke praktikan kelas terkait. */
export async function notifySessionOpened(
  session: PracticeSession,
): Promise<NotificationDispatchResult> {
  const locationLabel = session.labName || session.room;
  const body = `${session.practicalName} (${session.className}) telah dibuka${locationLabel ? ` di ${locationLabel}` : ''}. Silakan lakukan presensi sebelum sesi ditutup.`;

  return dispatchToUsers(
    () => (session.classId ? getClassStudentIds(session.classId) : Promise.resolve([])),
    {
      title: 'Sesi Praktikum Dibuka',
      body,
      data: {
        type: 'session_opened',
        sessionId: session.id,
        classId: session.classId ?? '',
      },
    },
  );
}

/** Event 2: Asisten mengubah jadwal/lokasi sesi -> kirim ke praktikan kelas terkait. */
export async function notifyScheduleChanged(
  session: PracticeSession,
): Promise<NotificationDispatchResult> {
  const locationLabel = session.labName || session.room;
  const body = `Jadwal ${session.practicalName} (${session.className}) diperbarui: ${safeFormatDate(session.date)}, ${session.startTime}–${session.endTime} WIB${locationLabel ? ` di ${locationLabel}` : ''}.`;

  return dispatchToUsers(
    () => (session.classId ? getClassStudentIds(session.classId) : Promise.resolve([])),
    {
      title: 'Perubahan Jadwal Praktikum',
      body,
      data: {
        type: 'schedule_changed',
        sessionId: session.id,
        classId: session.classId ?? '',
      },
    },
  );
}

/** Event 3: Asisten menyetujui/menolak izin -> kirim ke praktikan pengaju. */
export async function notifyPermissionDecision(
  request: PermissionRequest,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<NotificationDispatchResult> {
  const approved = decision === 'approved';
  const trimmedNote = note?.trim();
  const baseBody = `Pengajuan izin ${request.practicalName} (${request.className}, ${safeFormatDate(request.sessionDate)}) telah ${approved ? 'disetujui' : 'ditolak'}.`;
  const body = trimmedNote ? `${baseBody} Catatan: ${trimmedNote}` : baseBody;

  return dispatchToUsers(() => Promise.resolve([request.studentId]), {
    title: approved ? 'Pengajuan Izin Disetujui' : 'Pengajuan Izin Ditolak',
    body,
    data: {
      type: approved ? 'permission_approved' : 'permission_rejected',
      requestId: request.id,
      sessionId: request.sessionId,
    },
  });
}

/** Memeriksa apakah pembaruan sesi mengubah jadwal atau lokasi pelaksanaan. */
export function hasScheduleChanged(
  previous: PracticeSession | undefined,
  updates: Partial<PracticeSession>,
): boolean {
  if (!previous) {
    return (
      updates.date !== undefined ||
      updates.startTime !== undefined ||
      updates.endTime !== undefined ||
      updates.labId !== undefined ||
      updates.labName !== undefined ||
      updates.room !== undefined
    );
  }

  const norm = (value?: string | null) => (value ?? '').trim();
  if (updates.date !== undefined && norm(updates.date) !== norm(previous.date)) return true;
  if (updates.startTime !== undefined && norm(updates.startTime) !== norm(previous.startTime)) return true;
  if (updates.endTime !== undefined && norm(updates.endTime) !== norm(previous.endTime)) return true;
  if (updates.labId !== undefined && norm(updates.labId) !== norm(previous.labId)) return true;
  if (updates.labName !== undefined && norm(updates.labName) !== norm(previous.labName)) return true;
  if (updates.room !== undefined && norm(updates.room) !== norm(previous.room)) return true;
  return false;
}

/** Menyusun umpan balik UI gabungan hasil tulis Firestore dan status pengiriman notifikasi. */
export function buildNotificationFeedback(
  primaryTitle: string,
  primaryMessage: string,
  result: NotificationDispatchResult | null,
): { type: 'success' | 'info'; title: string; message: string } {
  if (!result) {
    return { type: 'success', title: primaryTitle, message: primaryMessage };
  }

  if (result.status === 'sent' || result.status === 'skipped-server-mode') {
    return {
      type: 'success',
      title: primaryTitle,
      message: `${primaryMessage}\nNotifikasi: ${result.message}`,
    };
  }

  return {
    type: 'info',
    title: primaryTitle,
    message: `${primaryMessage}\nCatatan notifikasi: ${result.message}`,
  };
}
