import React, { useRef, useState } from 'react';
import { Activity, ShieldCheck, BookOpen, Eye, FileDown, RefreshCw, Users } from 'lucide-react';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
import RadarCard from './RadarCard';
import DiamondChart from './DiamondChart';
import { OverallResult, PotentialResult } from '../types';

interface ResultsReportProps {
  results: OverallResult;
  chartColors: Record<string, string>;
  onReset: () => void;
}

const ResultsReport: React.FC<ResultsReportProps> = ({ results, chartColors, onReset }) => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    if (!resultsRef.current) return;
    setIsExporting(true);

    try {
      // Small delay to ensure UI is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const element = resultsRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const imgHeightInPdf = imgHeight * ratio;

      let heightLeft = imgHeightInPdf;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
      heightLeft -= pdfHeight;

      // Add subsequent pages if needed
      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeightInPdf);
        heightLeft -= pdfHeight;
      }

      pdf.save(`RAG_Assessment_Report_${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (err) {
      console.error("PDF Export failed", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const questions = (Object.values(results.potentials) as PotentialResult[]).flatMap(p => p.questions);

  return (
    <>
      {/* Action Bar */}
      <div className="flex justify-end mb-4 space-x-4 print:hidden">
        <button 
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center space-x-2 text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {isExporting ? (
             <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
             <FileDown className="w-4 h-4" />
          )}
          <span>Export PDF</span>
        </button>
        <button 
          onClick={onReset}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
          <span>New Analysis</span>
        </button>
      </div>

      {/* Report Content */}
      <div ref={resultsRef} className="animate-fade-in bg-slate-50 p-4">
        {/* Top Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="lg:col-span-1">
             <DiamondChart data={results} colors={chartColors} />
          </div>
          
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col justify-center">
             <h2 className="text-2xl font-bold text-gray-900 mb-4">Executive Summary</h2>
             <p className="text-gray-600 leading-relaxed mb-6">
               Based on the analysis of <strong>{questions.length} questions</strong>, 
               the organization demonstrates an overall resilience score of <strong className="text-purple-600">{results.overallResilience.toFixed(1)}%</strong>.
             </p>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100" style={{ borderColor: chartColors.Response + '40', backgroundColor: chartColors.Response + '10' }}>
                   <div className="text-sm font-semibold mb-1 flex items-center" style={{ color: chartColors.Response }}><Activity className="w-4 h-4 mr-1"/> Response</div>
                   <div className="text-2xl font-bold" style={{ color: chartColors.Response }}>{results.potentials.Response.score.toFixed(1)}%</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-100" style={{ borderColor: chartColors.Monitor + '40', backgroundColor: chartColors.Monitor + '10' }}>
                   <div className="text-sm font-semibold mb-1 flex items-center" style={{ color: chartColors.Monitor }}><ShieldCheck className="w-4 h-4 mr-1"/> Monitor</div>
                   <div className="text-2xl font-bold" style={{ color: chartColors.Monitor }}>{results.potentials.Monitor.score.toFixed(1)}%</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100" style={{ borderColor: chartColors.Anticipate + '40', backgroundColor: chartColors.Anticipate + '10' }}>
                   <div className="text-sm font-semibold mb-1 flex items-center" style={{ color: chartColors.Anticipate }}><Eye className="w-4 h-4 mr-1"/> Anticipate</div>
                   <div className="text-2xl font-bold" style={{ color: chartColors.Anticipate }}>{results.potentials.Anticipate.score.toFixed(1)}%</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100" style={{ borderColor: chartColors.Learn + '40', backgroundColor: chartColors.Learn + '10' }}>
                   <div className="text-sm font-semibold mb-1 flex items-center" style={{ color: chartColors.Learn }}><BookOpen className="w-4 h-4 mr-1"/> Learn</div>
                   <div className="text-2xl font-bold" style={{ color: chartColors.Learn }}>{results.potentials.Learn.score.toFixed(1)}%</div>
                </div>
             </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="w-1 h-8 bg-indigo-600 rounded-full mr-3"></span>
          Potential Breakdowns
        </h2>
        {/* Changed grid layout to 2x2 (grid-cols-2) for larger charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <RadarCard data={results.potentials.Response} color={chartColors.Response} />
          <RadarCard data={results.potentials.Monitor} color={chartColors.Monitor} />
          <RadarCard data={results.potentials.Anticipate} color={chartColors.Anticipate} />
          <RadarCard data={results.potentials.Learn} color={chartColors.Learn} />
        </div>

        {/* Descriptive Statistics Table */}
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="w-1 h-8 bg-indigo-600 rounded-full mr-3"></span>
          Descriptive Statistics (敘述性統計)
        </h2>

        {/* Sample Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-center max-w-sm">
            <div className="mr-4 p-2 bg-blue-100 rounded-full text-blue-600">
                <Users className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs text-blue-800 font-semibold uppercase tracking-wider">Total Sample Size</p>
                <p className="text-2xl font-bold text-blue-900">{results.totalRespondents} <span className="text-sm font-normal text-blue-600">respondents</span></p>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">Focus</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">Mean</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Median</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Mode</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SD</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Min</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Max</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Count</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questions.map((q, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                       <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: (chartColors as any)[q.potential] }}></span>
                          <div className="font-medium">{q.focus}</div>
                       </div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm font-bold text-indigo-700 bg-indigo-50/30 border-r border-indigo-50">
                      {q.averageScore.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-gray-600">{q.stats.median}</td>
                    <td className="px-3 py-3 text-center text-sm text-gray-600">{q.stats.mode}</td>
                    <td className="px-3 py-3 text-center text-sm text-gray-600">{q.stats.stdDev}</td>
                    <td className="px-3 py-3 text-center text-sm text-gray-500 bg-red-50/30">{q.stats.min}</td>
                    <td className="px-3 py-3 text-center text-sm text-gray-500 bg-green-50/30">{q.stats.max}</td>
                    <td className="px-3 py-3 text-center text-xs text-gray-400">{q.stats.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="w-1 h-8 bg-indigo-600 rounded-full mr-3"></span>
          Detailed Item Scores
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Potential</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Focus / Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questions.map((q, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: (chartColors as any)[q.potential] + '20', 
                          color: (chartColors as any)[q.potential] 
                        }}>
                        {q.potential}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{q.focus}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{q.averageScore.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${q.averageScore >= 4 ? 'bg-green-500' : q.averageScore >= 3 ? 'bg-yellow-400' : 'bg-red-500'}`} 
                          style={{ width: `${(q.averageScore / 5) * 100}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResultsReport;