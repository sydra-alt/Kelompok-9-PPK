import model from '../../ai/model-edom.json';
import { createSentimentClassifier, type SentimentLabel } from '../../ai/sentiment.js';

const classifySentiment = createSentimentClassifier(model);
const SENTIMENT_LABELS = ['negatif', 'netral', 'positif'] as const satisfies readonly SentimentLabel[];

function isSentimentLabel(label: string): label is SentimentLabel {
  return SENTIMENT_LABELS.some((supportedLabel) => supportedLabel === label);
}

export type ClassificationOutcome =
  | { ok: true; sentiment: SentimentLabel }
  | { ok: false; error: string };

/** Classify permission-reason sentiment locally; the text is never sent to an AI API. */
export function classifyReason(reason: string): ClassificationOutcome {
  const prediction = classifySentiment(reason);
  if (prediction.label === null) {
    return {
      ok: false,
      error:
        prediction.status === 'empty_input'
          ? 'Alasan tidak berisi teks yang dapat dianalisis.'
          : 'Model tidak mengenali kata pada alasan ini.',
    };
  }

  if (!isSentimentLabel(prediction.label)) {
    return { ok: false, error: 'Model menghasilkan label sentimen yang tidak didukung.' };
  }

  return { ok: true, sentiment: prediction.label };
}
