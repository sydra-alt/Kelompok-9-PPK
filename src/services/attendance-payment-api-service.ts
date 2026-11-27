import { getFirebaseAuth } from '@/services/firebase';
import { getCurrentDeviceLocation } from '@/services/location-service';
import { AppError, withTimeout } from '@/services/errors';
import type { AttendanceSubmissionResult } from '@/types/attendance-api';
import type { PaymentCheckout } from '@/types/payments';

interface ApiErrorBody {
  code?: unknown;
  message?: unknown;
  error?: unknown;
}

const API_ERROR_MESSAGES: Record<string, string> = {
  SESSION_CLOSED: 'Sesi sudah ditutup. Presensi tidak dapat dilakukan lagi.',
  NOT_CLASS_MEMBER: 'Akun kamu belum terdaftar pada kelas sesi ini.',
  LOCATION_INVALID: 'Lokasi perangkat tidak valid. Periksa izin lokasi lalu coba lagi.',
  OUTSIDE_RADIUS: 'Kamu berada di luar radius presensi laboratorium.',
  ALREADY_ATTENDED: 'Presensi untuk sesi ini sudah tercatat.',
  FINE_NOT_FOUND: 'Tagihan tidak ditemukan atau bukan milik akun ini.',
  FINE_NOT_PAYABLE: 'Tagihan ini tidak dapat dibayar saat ini.',
  UNAUTHENTICATED: 'Sesi login berakhir. Silakan masuk kembali.',
};

export const isBackendApiConfigured = () =>
  Boolean(process.env.EXPO_PUBLIC_PAYMENT_API_URL?.trim());

function getBaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_PAYMENT_API_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new AppError(
      'backend-api-not-configured',
      'Backend aplikasi belum dikonfigurasi. Checkout dan presensi belum tersedia.',
    );
  }
  return value;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = getBaseUrl();
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    throw new AppError('unauthenticated', 'Sesi login berakhir. Silakan masuk kembali.');
  }

  let response: Response;
  try {
    const idToken = await currentUser.getIdToken();
    response = await withTimeout(
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      }),
      20000,
      'Permintaan ke backend terlalu lama. Periksa koneksi lalu coba lagi.',
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('backend-network-error', 'Backend tidak dapat dijangkau. Periksa koneksi lalu coba lagi.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // An empty or non-JSON response is handled as a generic backend error below.
  }

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ApiErrorBody;
    const code = typeof errorBody.code === 'string' ? errorBody.code : `HTTP_${response.status}`;
    const message = API_ERROR_MESSAGES[code] ??
      (typeof errorBody.message === 'string' ? errorBody.message :
        typeof errorBody.error === 'string' ? errorBody.error :
          'Permintaan gagal diproses oleh server. Coba lagi.');
    throw new AppError(code, message);
  }

  return payload as T;
}

/** Client request. Backend decides attendance status and creates any fine. */
export async function submitAttendanceToBackend(
  sessionId: string,
): Promise<AttendanceSubmissionResult> {
  // Do not prompt for device location when no backend endpoint is configured.
  getBaseUrl();
  const location = await getCurrentDeviceLocation();
  return postJson<AttendanceSubmissionResult>('/api/attendance/submit', {
    sessionId,
    latitude: location.latitude,
    longitude: location.longitude,
  });
}

/** Creates/reuses a checkout through the trusted server, never from Midtrans directly. */
export function createFineCheckout(fineId: string): Promise<PaymentCheckout> {
  return postJson<PaymentCheckout>('/api/payments/create', { fineId });
}
