export type PotentialType = 'Response' | 'Monitor' | 'Anticipate' | 'Learn';

export interface LikertMapping {
  [key: string]: number;
}

export interface QuestionMapping {
  potential: PotentialType;
  focus: string;
  originalIndex?: number; 
}

export interface SurveyConfig {
  startColumn: number;
  likertMap: LikertMapping;
  questions: QuestionMapping[];
  colors?: Record<string, string>;
}

export interface QuestionStats {
  n: number;        // Count
  median: number;
  mode: number;
  stdDev: number;   // Standard Deviation
  min: number;
  max: number;
}

export interface QuestionResult {
  id: number;
  potential: PotentialType;
  focus: string;
  averageScore: number;
  stats?: QuestionStats;
}

export interface PotentialResult {
  name: PotentialType;
  score: number;
  questions: QuestionResult[];
  area: number;
  maxArea: number;
}

export interface OverallResult {
  potentials: Record<PotentialType, PotentialResult>;
  overallResilience: number;
  totalRespondents?: number;
  warnings?: string[];
}

declare global {
  interface Window {
    XLSX: any;
  }
}