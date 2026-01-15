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
  stats: QuestionStats; // Added statistics
}

export interface PotentialResult {
  name: PotentialType;
  score: number; // Percentage score (Area based)
  questions: QuestionResult[];
  area: number;
  maxArea: number;
}

export interface OverallResult {
  potentials: Record<PotentialType, PotentialResult>;
  overallResilience: number; // Total Percentage
  totalRespondents: number; // Added field for sample size
  warnings: string[]; // List of unmapped values found in survey
}

// Global declaration for SheetJS loaded via CDN
declare global {
  interface Window {
    XLSX: any;
  }
}