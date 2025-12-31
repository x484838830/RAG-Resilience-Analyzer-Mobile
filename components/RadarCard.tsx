import React, { useRef, useState } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Download, Loader2 } from 'lucide-react';
// @ts-ignore
import html2canvas from 'html2canvas';
import { PotentialResult } from '../types';

interface RadarCardProps {
  data: PotentialResult;
  color: string;
}

const RadarCard: React.FC<RadarCardProps> = ({ data, color }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Transform data for Recharts
  const chartData = data.questions.map(q => ({
    subject: q.focus,
    A: q.averageScore,
    fullMark: 5
  }));

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `RAG_Radar_${data.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div ref={cardRef} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center relative group">
      <div 
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10" 
        data-html2canvas-ignore
      >
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-full transition-colors border border-gray-200"
          title="Download Chart as PNG"
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      </div>

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