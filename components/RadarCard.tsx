import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { PotentialResult } from '../types';

interface RadarCardProps {
  data: PotentialResult;
  color: string;
}

const RadarCard: React.FC<RadarCardProps> = ({ data, color }) => {
  // Transform data for Recharts
  const chartData = data.questions.map(q => ({
    subject: q.focus,
    A: q.averageScore,
    fullMark: 5
  }));

  // Recharts radar doesn't close automatically nicely if we don't handle it, 
  // but the library usually handles polygon closure.

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
      <h3 className="text-lg font-bold text-gray-800 mb-2">{data.name}</h3>
      <div className="text-3xl font-extrabold mb-4" style={{ color }}>
        {data.score.toFixed(1)}%
      </div>
      
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#6b7280', fontSize: 10 }} 
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 5]} 
              tickCount={6} 
              tick={{ fontSize: 10 }}
            />
            <Radar
              name={data.name}
              dataKey="A"
              stroke={color}
              fill={color}
              fillOpacity={0.4}
            />
            <Tooltip 
              formatter={(value: number) => [value.toFixed(2), "Score"]}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Area-based Score (Actual / Max)
      </p>
    </div>
  );
};

export default RadarCard;