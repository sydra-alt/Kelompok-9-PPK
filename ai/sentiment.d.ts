export type SentimentLabel = 'negatif' | 'netral' | 'positif';

export interface SentimentModel {
  schema_version: number;
  status: string;
  algorithm: string;
  labels: string[];
  aliases: Record<string, string>;
  vocabulary: Record<string, number>;
  idf: number[];
  weights: number[][];
  bias: number[];
  preprocessing: string;
}

export interface SentimentPrediction {
  label: string | null;
  status: 'predicted' | 'unknown_vocabulary' | 'empty_input';
  scores: number[] | null;
  scoreType: 'decision_margin' | 'log_score' | 'none';
  experimental: boolean;
}

export function createSentimentClassifier(
  model: SentimentModel,
): (text: string) => SentimentPrediction;
