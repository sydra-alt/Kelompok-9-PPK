import { aiClassifierConfig } from '@/services/firebase/config';

/**
 * Klien API AI klasifikasi alasan izin (API disediakan pengajar).
 *
 * Kontrak default (sesuaikan `buildRequestBody`/`parseResponse` bila format
 * API dari pengajar berbeda):
 *   POST {EXPO_PUBLIC_AI_CLASSIFIER_URL}
 *   Header: Content-Type: application/json
 *           Authorization: Bearer {EXPO_PUBLIC_AI_CLASSIFIER_API_KEY}  (opsional)
 *   Body:   { "text": "<alasan izin>" }
 *   Respon: { "category": "sakit", "confidence": 0.92 }
 *           (juga diterima: label / classification / prediction / result.category / data.category)
 *
 * Hasil AI hanya informasi pendukung — TIDAK pernah mengubah status keputusan izin.
 */

export type ClassificationOutcome =
  | { ok: true; category: string; confidence: number | null }
  | { ok: false; skipped: boolean; error: string };

export const isAiClassifierConfigured = () => aiClassifierConfig.url.trim().length > 0;

function buildRequestBody(reason: string) {
  return { text: reason };
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function parseResponse(json: unknown): { category: string; confidence: number | null } | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const nestedRaw = root.result ?? root.data;
  const nested = (nestedRaw && typeof nestedRaw === 'object' ? nestedRaw : {}) as Record<string, unknown>;
  const category = pickString(
    root.category,
    root.label,
    root.classification,
    root.prediction,
    nested.category,
    nested.label,
    nested.classification,
  );
  if (!category) return null;
  const confidence = pickNumber(root.confidence, root.score, nested.confidence, nested.score);
  return { category, confidence };
}

export async function classifyReason(reason: string): Promise<ClassificationOutcome> {
  if (!isAiClassifierConfigured()) {
    return { ok: false, skipped: true, error: 'API AI belum dikonfigurasi.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiClassifierConfig.timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (aiClassifierConfig.apiKey) headers.Authorization = `Bearer ${aiClassifierConfig.apiKey}`;

    const response = await fetch(aiClassifierConfig.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequestBody(reason)),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, skipped: false, error: `API AI merespons status ${response.status}.` };
    }
    const parsed = parseResponse(await response.json());
    if (!parsed) return { ok: false, skipped: false, error: 'Format respons API AI tidak dikenali.' };
    return { ok: true, ...parsed };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      skipped: false,
      error: aborted ? 'API AI tidak merespons (timeout).' : 'Gagal menghubungi API AI.',
    };
  } finally {
    clearTimeout(timer);
  }
}
