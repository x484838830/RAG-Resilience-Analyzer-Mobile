import { LikertMapping, PotentialResult, PotentialType, QuestionResult, QuestionMapping } from '../types';

// --- Scoring Logic ---

const getScoreByKeywords = (answer: string): number | null => {
  const a = answer.trim().toLowerCase();
  
  // Score 1
  if (['very disagree', 'strongly disagree', 'not at all', 'rarely', '非常不', '強烈不', '完全不', '少部分', '極少'].some(kw => a.includes(kw))) return 1;
  // Score 2
  if (['disagree', 'partially', 'sometimes', '不同意', '部分符合', '部分可', '稍微', '偶爾'].some(kw => a.includes(kw))) return 2;
  // Score 3 (Neutral)
  if (['neutral', 'average', 'not sure', 'maybe', 'moderate', '普通', '無意見', '不確定', '可能', '中等'].some(kw => a.includes(kw))) return 3;
  // Score 5 (Strong Positive - Check before 4 to avoid overlap)
  if (['very agree', 'strongly agree', 'completely', 'always', 'excellent', '非常同', '強烈同', '完全符', '總是', '極高'].some(kw => a.includes(kw))) return 5;
  // Score 4
  if (['agree', 'mostly', 'often', 'good', '同意', '大部分', '符合', '經常'].some(kw => a.includes(kw))) return 4;

  return null;
};

export const convertAnswerToScore = (answer: any, mapping: LikertMapping): number => {
  if (answer === null || answer === undefined) return 3; // Default for empty
  const strAnswer = String(answer).trim();

  // 1. Exact Match
  if (mapping[strAnswer]) return mapping[strAnswer];

  // 2. Partial Match in Mapping Keys
  for (const key in mapping) {
    if (strAnswer.includes(key) || key.includes(strAnswer)) {
      return mapping[key];
    }
  }

  // 3. Keyword Fuzzy Match
  const keywordScore = getScoreByKeywords(strAnswer);
  if (keywordScore !== null) return keywordScore;

  // 4. Default
  return 3;
};

// --- Area Calculation (Shoelace Formula) ---

export const calculatePolygonArea = (scores: number[]): number => {
  const n = scores.length;
  if (n < 3) return 0;

  // Angles distributed evenly around circle
  const angles = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n);

  // Convert polar (score, angle) to cartesian (x, y)
  // Note: We don't need to offset angle by -PI/2 for area calc, 
  // but usually radar charts start at 12 o'clock. Math works either way.
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
  
  // Initialize results grouping
  const potentialData: Record<PotentialType, { focus: string; total: number; count: number; scores: number[] }> = {
    Response: { focus: '', total: 0, count: 0, scores: [] }, // temp structure
    Monitor: { focus: '', total: 0, count: 0, scores: [] },
    Anticipate: { focus: '', total: 0, count: 0, scores: [] },
    Learn: { focus: '', total: 0, count: 0, scores: [] }
  };

  // We need to track individual question averages
  const questionAverages: QuestionResult[] = [];

  // Iterate through defined questions
  questions.forEach((q, idx) => {
    const colIndex = startColumn + idx;
    
    // Collect all answers for this column
    let sum = 0;
    let count = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (row.length > colIndex) {
        const val = row[colIndex];
        sum += convertAnswerToScore(val, likertMap);
        count++;
      }
    }

    const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;

    questionAverages.push({
      id: idx + 1,
      potential: q.potential,
      focus: q.focus,
      averageScore: avg
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

  return {
    potentials: finalPotentials as Record<PotentialType, PotentialResult>,
    overallResilience,
    questionDetails: questionAverages
  };
};