import React, { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
// @ts-ignore
import html2canvas from 'html2canvas';
import { OverallResult, PotentialType } from '../types';

interface DiamondChartProps {
  data: OverallResult;
  colors: Record<string, string>;
}

const DiamondChart: React.FC<DiamondChartProps> = ({ data, colors }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Configuration
  const size = 500;
  const center = size / 2;
  const maxRadius = size / 2 - 60; // Padding

  // Order of axes: Top (Response), Right (Monitor), Bottom (Learn), Left (Anticipate)
  const axes: { id: PotentialType; angle: number; color: string }[] = [
    { id: 'Response', angle: -90, color: colors.Response || '#3b82f6' }, // 12 o'clock (-90 deg)
    { id: 'Monitor', angle: 0, color: colors.Monitor || '#ef4444' },    // 3 o'clock (0 deg)
    { id: 'Learn', angle: 90, color: colors.Learn || '#22c55e' },     // 6 o'clock (90 deg)
    { id: 'Anticipate', angle: 180, color: colors.Anticipate || '#f97316' } // 9 o'clock (180 deg)
  ];

  // Helper to get coordinates
  const getCoords = (angleDeg: number, percentage: number) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    // percentage is 0-100. Scale to 0-1.
    const radius = (percentage / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angleRad),
      y: center + radius * Math.sin(angleRad),
    };
  };

  // Generate polygon points for data
  const polyPoints = axes.map(axis => {
    const score = data.potentials[axis.id].score;
    const { x, y } = getCoords(axis.angle, score);
    return `${x},${y}`;
  }).join(' ');

  const handleDownload = async () => {
    if (!chartRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `RAG_Diamond_Assessment.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div ref={chartRef} className="flex flex-col items-center justify-center bg-white p-6 rounded-xl shadow-lg border border-gray-100 relative group">
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

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Overall Resilience Assessment</h2>
      
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background Grid Lines (25%, 50%, 75%, 100%) */}
          {[25, 50, 75, 100].map((tick) => (
            <path
              key={tick}
              d={axes.map(axis => {
                const { x, y } = getCoords(axis.angle, tick);
                return `${x},${y}`;
              }).join(' ') + ' Z'}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray={tick === 100 ? "4 4" : "0"}
            />
          ))}

          {/* Axes Lines */}
          <line x1={center} y1={center - maxRadius} x2={center} y2={center + maxRadius} stroke="#e5e7eb" />
          <line x1={center - maxRadius} y1={center} x2={center + maxRadius} y2={center} stroke="#e5e7eb" />

          {/* Data Polygon */}
          <polygon
            points={polyPoints}
            fill="#a855f7"
            fillOpacity="0.2"
            stroke="#a855f7"
            strokeWidth="3"
          />

          {/* Data Points and Labels */}
          {axes.map(axis => {
            const score = data.potentials[axis.id].score;
            const pos = getCoords(axis.angle, score);
            const labelPos = getCoords(axis.angle, 115); // Place label outside

            return (
              <g key={axis.id}>
                {/* Dot */}
                <circle cx={pos.x} cy={pos.y} r="6" fill={axis.color} stroke="white" strokeWidth="2" />
                
                {/* Score Text near dot */}
                <text 
                  x={pos.x} 
                  y={pos.y - 12} 
                  textAnchor="middle" 
                  className="text-xs font-bold fill-gray-600"
                >
                  {score.toFixed(1)}%
                </text>

                {/* Axis Label */}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-sm font-bold fill-gray-800 uppercase tracking-wider"
                >
                  {axis.id}
                </text>
              </g>
            );
          })}

          {/* Center Text */}
          <foreignObject x={center - 60} y={center - 40} width="120" height="80">
            <div className="flex flex-col items-center justify-center h-full bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 p-1">
              <span className="text-xs text-gray-500 font-semibold uppercase">Overall</span>
              <span className="text-2xl font-black text-purple-600">
                {data.overallResilience.toFixed(1)}%
              </span>
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>
  );
};

export default DiamondChart;