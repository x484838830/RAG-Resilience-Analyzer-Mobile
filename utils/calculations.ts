import { LikertMapping, PotentialResult, PotentialType, QuestionResult, QuestionMapping, QuestionStats } from '../types';

// --- Scoring Logic ---

/**
 * Converts a raw survey answer to a score based STRICTLY on the provided Likert Mapping.
 * Returns null if no match is found.
 */
export const convertAnswerToScore = (answer: any, mapping: LikertMapping): number | null => {
  if (answer === null || answer === undefined || String(answer).trim() === '') return null;
  
  const strAnswer = String(answer).trim().toLowerCase();

  // Iterate through mapping keys to find a case-insensitive match
  for (const key in mapping) {
    if (key.trim().toLowerCase() === strAnswer) {
      return mapping[key];
    }
  }

  // No match found in configuration
  return null;
};

// --- Math Helpers ---

const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const calculateMode = (values: number[]): number => {
  if (values.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxFreq = 0;
  let mode = values[0];

  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > maxFreq) {
      maxFreq = counts[v];
      mode = v;
    } else if (counts[v] === maxFreq) {
      mode = Math.max(mode, v);
    }
  }
  return mode;
};

const calculateStdDev = (values: number[], mean: number): number => {
  if (values.length < 2) return 0;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(avgSquareDiff);
};

// --- Area Calculation (Shoelace Formula) ---

export const calculatePolygonArea = (scores: number[]): number => {
  const n = scores.length;
  if (n < 3) return 0;

  const angles = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n);

  const points = scores.map((r, i) => ({
    x: r * Math.cos(angles[i]),
    y: r * Math.sin(angles[i])
  }));

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) * 0.5;
};

// --- Main Processing ---

export const processSurveyData = (
  rawData: any[][],
  config: { startColumn: number; likertMap: LikertMapping; questions: QuestionMapping[] }
) => {
  const { startColumn, likertMap, questions } = config;
  
  const questionAverages: QuestionResult[] = [];
  const unmappedValues = new Set<string>();

  questions.forEach((q, idx) => {
    const colIndex = startColumn + idx;
    const scores: number[] = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row.length > colIndex) {
        const val = row[colIndex];
        if (row.length > 0 && val !== undefined && val !== null && String(val).trim() !== '') {
           const score = convertAnswerToScore(val, likertMap);
           if (score !== null) {
             scores.push(score);
           } else {
             unmappedValues.add(String(val));
           }
        }
      }
    }

    const count = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;

    const stats: QuestionStats = {
      n: count,
      median: calculateMedian(scores),
      mode: calculateMode(scores),
      stdDev: Number(calculateStdDev(scores, avg).toFixed(2)),
      min: count > 0 ? Math.min(...scores) : 0,
      max: count > 0 ? Math.max(...scores) : 0
    };

    questionAverages.push({
      id: idx + 1,
      potential: q.potential,
      focus: q.focus,
      averageScore: avg,
      stats: stats
    });
  });

  const finalPotentials: Record<string, PotentialResult> = {};
  const potentials: PotentialType[] = ['Response', 'Monitor', 'Anticipate', 'Learn'];
  
  potentials.forEach(p => {
    const pQuestions = questionAverages.filter(q => q.potential === p);
    const scores = pQuestions.map(q => q.averageScore);
    const maxScores = pQuestions.map(() => 5);

    const area = calculatePolygonArea(scores);
    const maxArea = calculatePolygonArea(maxScores);
    const percentage = maxArea > 0 ? (area / maxArea) * 100 : 0;

    finalPotentials[p] = {
      name: p,
      score: percentage,
      questions: pQuestions,
      area,
      maxArea
    };
  });

  const totalActualArea = Object.values(finalPotentials).reduce((acc, curr) => acc + curr.area, 0);
  const totalMaxArea = Object.values(finalPotentials).reduce((acc, curr) => acc + curr.maxArea, 0);
  const overallResilience = totalMaxArea > 0 ? (totalActualArea / totalMaxArea) * 100 : 0;

  const totalRespondents = rawData.slice(1).filter(r => r && r.length > 0).length;

  return {
    potentials: finalPotentials as Record<PotentialType, PotentialResult>,
    overallResilience,
    totalRespondents,
    questionDetails: questionAverages,
    warnings: Array.from(unmappedValues)
  };
};