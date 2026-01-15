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

// 輔助函數：移除 Focus 名稱開頭的編號
const removePrefix = (text: string): string => {
  return text.replace(/^\d+\.\d+\.?\s*/, '');
};

const RadarCard: React.FC<RadarCardProps> = ({ data, color }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Helper to determine prefix based on potential name
  const getPrefix = (name: string) => {
    switch(name) {
      case 'Response': return '1';
      case 'Monitor': return '2';
      case 'Anticipate': return '3';
      case 'Learn': return '4';
      default: return 'Q';
    }
  };

  const prefix = getPrefix(data.name);

  // Transform data for Recharts using numbered labels
  const chartData = data.questions.map((q, i) => ({
    code: `${prefix}.${i + 1}`,
    fullText: q.focus,
    cleanText: removePrefix(q.focus),
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
    <div ref={cardRef} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center relative group h-full">
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

      <div className="flex flex-col items-center mb-2">
        <h3 className="text-xl font-bold text-gray-800">{data.name}</h3>
        <div className="text-3xl font-extrabold" style={{ color }}>
          {data.score.toFixed(1)}%
        </div>
      </div>
      
      {/* Radar Chart */}
      <div className="w-full h-80 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid />
            <PolarAngleAxis 
              dataKey="code" 
              tick={{ fill: '#4b5563', fontSize: 14, fontWeight: 600 }} 
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
              labelFormatter={(label) => {
                 const item = chartData.find(d => d.code === label);
                 return item ? `${label} - ${item.cleanText}` : label;
              }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Table */}
      <div className="w-full mt-auto">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Code
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item / Focus
                </th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chartData.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 whitespace-nowrap text-sm font-bold text-gray-900">
                    {item.code}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {item.cleanText}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-medium" style={{ color }}>
                    {item.A.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default RadarCard;