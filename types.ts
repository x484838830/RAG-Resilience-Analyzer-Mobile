

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

export interface QuestionResult {
  id: number;
  potential: PotentialType;
  focus: string;
  averageScore: number;
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
}

// Global declaration for SheetJS loaded via CDN
declare global {
  interface Window {
    XLSX: any;
  }
}
