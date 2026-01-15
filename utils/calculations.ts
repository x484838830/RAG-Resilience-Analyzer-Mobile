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
      // If multiple modes, pick the higher score (optimistic approach for this context)
      mode = Math.max(mode, v);
    }
  }
  return mode;
};

const calculateStdDev = (values: number[], mean: number): number => {
  if (values.length < 2) return 0;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / (values.length - 1); // Sample StdDev
  return Math.sqrt(avgSquareDiff);
};

// --- Area Calculation (Shoelace Formula) ---

export const calculatePolygonArea = (scores: number[]): number => {
  const n = scores.length;
  if (n < 3) return 0;

  // Angles distributed evenly around circle
  const angles = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n);

  // Convert polar (score, angle) to cartesian (x, y)
  const points = scores.map((r, i) => ({
    x: r * Math.cos(angles[i]),
    y: r * Math.sin(angles[i])
  }));

  // Shoelace formula
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
  rawData: any[][], // Array of arrays from Excel
  config: { startColumn: number; likertMap: LikertMapping; questions: QuestionMapping[] }
) => {
  const { startColumn, likertMap, questions } = config;
  
  // Track individual question averages
  const questionAverages: QuestionResult[] = [];
  
  // Set to collect unmapped values for error reporting
  const unmappedValues = new Set<string>();

  // Iterate through defined questions
  questions.forEach((q, idx) => {
    const colIndex = startColumn + idx;
    
    // Collect all answers for this column
    const scores: number[] = [];

    // Skip header row (index 0)
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (row.length > colIndex) {
        const val = row[colIndex];
        // Only consider if row is not completely empty
        if (row.length > 0 && val !== undefined && val !== null && String(val).trim() !== '') {
           const score = convertAnswerToScore(val, likertMap);
           if (score !== null) {
             scores.push(score);
           } else {
             // Collect the problematic value
             unmappedValues.add(String(val));
           }
        }
      }
    }

    const count = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;

    // Calculate Descriptive Stats
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

  // Aggregate by Potential for Radar Calculation
  const finalPotentials: Record<string, PotentialResult> = {};
  
  const potentials: PotentialType[] = ['Response', 'Monitor', 'Anticipate', 'Learn'];
  
  potentials.forEach(p => {
    // Filter questions for this potential
    const pQuestions = questionAverages.filter(q => q.potential === p);
    
    // Get array of scores for Shoelace
    const scores = pQuestions.map(q => q.averageScore);
    const maxScores = pQuestions.map(() => 5); // Ideal case

    const area = calculatePolygonArea(scores);
    const maxArea = calculatePolygonArea(maxScores);
    
    // Safety for 0 division
    const percentage = maxArea > 0 ? (area / maxArea) * 100 : 0;

    finalPotentials[p] = {
      name: p,
      score: percentage,
      questions: pQuestions,
      area,
      maxArea
    };
  });

  // Overall Resilience
  const totalActualArea = Object.values(finalPotentials).reduce((acc, curr) => acc + curr.area, 0);
  const totalMaxArea = Object.values(finalPotentials).reduce((acc, curr) => acc + curr.maxArea, 0);
  const overallResilience = totalMaxArea > 0 ? (totalActualArea / totalMaxArea) * 100 : 0;

  // Count total respondents (excluding header and empty rows)
  const totalRespondents = rawData.slice(1).filter(r => r.length > 0).length;

  return {
    potentials: finalPotentials as Record<PotentialType, PotentialResult>,
    overallResilience,
    totalRespondents,
    questionDetails: questionAverages,
    warnings: Array.from(unmappedValues)
  };
};