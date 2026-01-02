import React, { useState, useRef } from 'react';
import { Download, RefreshCw, ChevronRight, Activity, ShieldCheck, BookOpen, Eye, FileDown } from 'lucide-react';
import { utils, read, writeFile } from 'xlsx';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
import FileUpload from './components/FileUpload';
import RadarCard from './components/RadarCard';
import DiamondChart from './components/DiamondChart';
import { processSurveyData } from './utils/calculations';
import { LikertMapping, OverallResult, QuestionMapping, SurveyConfig } from './types';

// Fallback types for window.XLSX
const getXLSX = () => {
  if (typeof window !== 'undefined' && window.XLSX) {
    return window.XLSX;
  }
  return { utils, read, writeFile };
};

const App: React.FC = () => {
  const [step, setStep] = useState<'upload' | 'processing' | 'results'>('upload');
  const [surveyFile, setSurveyFile] = useState<File | null>(null);
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [results, setResults] = useState<OverallResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  const defaultColors = {
    Response: '#3b82f6',
    Monitor: '#ef4444',
    Anticipate: '#f97316',
    Learn: '#22c55e'
  };

  const [chartColors, setChartColors] = useState<Record<string, string>>(defaultColors);
  
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleDownloadTemplate = () => {
    try {
      const XLSX = getXLSX();
      const wb = XLSX.utils.book_new();

      // 1. Settings Sheet
      const settingsData = [
        ['項目', '值'],
        ['問題起始欄位', 2]
      ];
      const settingsSheet = XLSX.utils.aoa_to_sheet(settingsData);
      XLSX.utils.book_append_sheet(wb, settingsSheet, "Settings");

      // 2. Likert_Mapping Sheet
      const likertData = [
        ['回答選項', '分數'],
        ['非常不同意', 1],
        ['不同意', 2],
        ['普通', 3],
        ['同意', 4],
        ['非常同意', 5],
        ['Strongly Disagree', 1],
        ['Disagree', 2],
        ['Neutral', 3],
        ['Agree', 4],
        ['Strongly Agree', 5]
      ];
      const likertSheet = XLSX.utils.aoa_to_sheet(likertData);
      XLSX.utils.book_append_sheet(wb, likertSheet, "Likert_Mapping");

      // 3. Question_Mapping Sheet
      const qMapData = [
        ['Potential', 'Focus'],
        ['Response', '1.1 Event Response'],
        ['Response', '1.2 Speed'],
        ['Monitor', '2.1 Indicators'],
        ['Monitor', '2.2 Tracking'],
        ['Anticipate', '3.1 Risk Forecast'],
        ['Learn', '4.1 Feedback Loop']
      ];
      const qMapSheet = XLSX.utils.aoa_to_sheet(qMapData);
      XLSX.utils.book_append_sheet(wb, qMapSheet, "Question_Mapping");

      // 4. Colors Sheet (Optional)
      const colorData = [
        ['Potential', 'Color (Hex/Name)'],
        ['Response', '#3b82f6'],
        ['Monitor', '#ef4444'],
        ['Anticipate', '#f97316'],
        ['Learn', '#22c55e']
      ];
      const colorSheet = XLSX.utils.aoa_to_sheet(colorData);
      XLSX.utils.book_append_sheet(wb, colorSheet, "Colors");

      XLSX.writeFile(wb, "RAG_Config_Template.xlsx");
    } catch (e) {
      console.error("Error generating template", e);
      alert("Could not generate template. Please ensure Excel libraries are loaded.");
    }
  };

  const handleAnalyze = async () => {
    if (!surveyFile || !configFile) {
      setError("Please upload both the Survey file and the Configuration file.");
      return;
    }

    setStep('processing');
    setProgress(10);
    setError(null);

    try {
      const XLSX = getXLSX();

      setProgress(20);
      const configBuffer = await configFile.arrayBuffer();
      let configWb;
      try {
        configWb = XLSX.read(configBuffer);
      } catch (e) {
        throw new Error("Failed to parse Configuration file. Ensure it is a valid Excel file.");
      }
      
      // --- VALIDATION: REQUIRED SHEETS ---
      const requiredSheets = ['Settings', 'Likert_Mapping', 'Question_Mapping'];
      const missingSheets = requiredSheets.filter(s => !configWb.SheetNames.includes(s));
      if (missingSheets.length > 0) {
        throw new Error(`Configuration File is missing sheets: ${missingSheets.join(', ')}. Please download and use the template.`);
      }

      // --- VALIDATION: SETTINGS ---
      const settingsSheet = configWb.Sheets['Settings'];
      // Use header:1 to get raw array for safer parsing
      const settingsDataRaw = XLSX.utils.sheet_to_json(settingsSheet, { header: 1 }) as any[][];
      
      const settingsRowRaw = settingsDataRaw.find(row => 
        row.some(cell => String(cell).toLowerCase().match(/(start|起始|begin)/))
      );
      
      let startColumn = -1;
      if (settingsRowRaw) {
        // Try to find a number in the row
        const val = settingsRowRaw.find(cell => typeof cell === 'number');
        if (val !== undefined) {
          startColumn = val;
        } else {
           // Try parsing string to int
           const numVal = settingsRowRaw.find(cell => !isNaN(parseInt(String(cell))) && String(cell).length < 5);
           if (numVal !== undefined) startColumn = parseInt(String(numVal));
        }
      } 
      
      if (startColumn === -1) {
         // Fallback default or error? Let's error to be robust.
         throw new Error("Sheet 'Settings': Could not locate a valid 'Start Column' (問題起始欄位) value. It must be a number.");
      }

      setProgress(30);
      
      // --- VALIDATION: LIKERT ---
      const likertSheet = configWb.Sheets['Likert_Mapping'];
      const likertJson = XLSX.utils.sheet_to_json(likertSheet, { header: 1 }) as any[][];
      const likertMap: LikertMapping = {};
      let likertCount = 0;
      
      likertJson.slice(1).forEach((row, idx) => {
        if (row && row.length >= 2) {
           const key = String(row[0]).trim();
           const val = row[1];
           if (key && val !== undefined && val !== null) {
              const numVal = Number(val);
              if (!isNaN(numVal)) {
                 likertMap[key] = numVal;
                 likertCount++;
              }
           }
        }
      });

      if (likertCount === 0) {
        throw new Error("Sheet 'Likert_Mapping': No valid mappings found. Format: Column A (Text) -> Column B (Number).");
      }

      setProgress(40);
      
      // --- VALIDATION: QUESTIONS ---
      const questionSheet = configWb.Sheets['Question_Mapping'];
      const questionJson = XLSX.utils.sheet_to_json(questionSheet);
      if (questionJson.length === 0) throw new Error("Sheet 'Question_Mapping': No questions found.");

      const validPotentialsLower = ['response', 'monitor', 'anticipate', 'learn'];
      const questions: QuestionMapping[] = [];
      
      questionJson.forEach((row: any, i: number) => {
        // Robust key finding (case insensitive)
        const pKey = Object.keys(row).find(k => k.toLowerCase() === 'potential');
        const fKey = Object.keys(row).find(k => k.toLowerCase() === 'focus');

        if (!pKey || !fKey) {
           throw new Error(`Sheet 'Question_Mapping' Row ${i+2}: Missing 'Potential' or 'Focus' column.`);
        }

        const rawP = String(row[pKey]).trim();
        const rawF = String(row[fKey]).trim();

        if (!validPotentialsLower.includes(rawP.toLowerCase())) {
           throw new Error(`Sheet 'Question_Mapping' Row ${i+2}: Invalid Potential '${rawP}'. Allowed: Response, Monitor, Anticipate, Learn.`);
        }
        
        // Normalize
        const normalizedP = rawP.charAt(0).toUpperCase() + rawP.slice(1).toLowerCase();

        questions.push({
          potential: normalizedP as any,
          focus: rawF
        });
      });

      // --- OPTIONAL: COLORS ---
      const colorSheet = configWb.Sheets['Colors'];
      let customColors: Record<string, string> | undefined = undefined;
      
      if (colorSheet) {
          const colorJson = XLSX.utils.sheet_to_json(colorSheet, { header: 1 }) as any[][];
          if (colorJson.length > 1) {
             const foundColors: any = {};
             colorJson.slice(1).forEach(row => {
                 if (row[0] && row[1]) {
                     const key = String(row[0]).trim();
                     // Normalize simple case
                     const normalizedKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
                     if (['Response', 'Monitor', 'Anticipate', 'Learn'].includes(normalizedKey)) {
                         foundColors[normalizedKey] = String(row[1]).trim();
                     }
                 }
             });
             if (Object.keys(foundColors).length > 0) {
                 customColors = foundColors;
             }
          }
      }

      const config: SurveyConfig = { startColumn, likertMap, questions, colors: customColors };

      setProgress(60);
      const surveyBuffer = await surveyFile.arrayBuffer();
      let surveyWb;
      try {
        surveyWb = XLSX.read(surveyBuffer);
      } catch (e) {
        throw new Error("Failed to parse Survey file. Ensure it is a valid Excel or CSV file.");
      }
      
      const firstSheetName = surveyWb.SheetNames[0];
      const surveySheet = surveyWb.Sheets[firstSheetName];
      const surveyData = XLSX.utils.sheet_to_json(surveySheet, { header: 1 }) as any[][];

      // --- VALIDATION: SURVEY DATA ---
      if (!surveyData || surveyData.length < 2) {
        throw new Error("Survey Data file appears to be empty or contains only a header row.");
      }

      const surveyHeader = surveyData[0];
      
      if (startColumn >= surveyHeader.length) {
         throw new Error(`Configuration Error: 'Start Column' is set to ${startColumn}, but Survey file only has ${surveyHeader.length} columns.`);
      }

      const requiredEndColumn = startColumn + questions.length;
      if (surveyHeader.length < requiredEndColumn) {
         throw new Error(`Survey Data Mismatch: Configuration expects ${questions.length} questions starting at column ${startColumn} (requires ${requiredEndColumn} columns), but file only has ${surveyHeader.length} columns.`);
      }

      setProgress(80);
      const calculatedResults = processSurveyData(surveyData, config);
      
      setResults(calculatedResults);
      if (config.colors) {
         setChartColors({ ...defaultColors, ...config.colors });
      } else {
         setChartColors(defaultColors);
      }

      setProgress(100);
      setTimeout(() => setStep('results'), 500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during analysis. Please check file formats.");
      setStep('upload');
    }
  };

  const handleReset = () => {
    setSurveyFile(null);
    setConfigFile(null);
    setResults(null);
    setStep('upload');
    setProgress(0);
    setError(null);
    setChartColors(defaultColors);
  };

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

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              RAG Resilience Analyzer
            </h1>
          </div>
          {step === 'results' && (
            <div className="flex space-x-4">
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
                onClick={handleReset}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="w-4 h-4" />
                <span>New Analysis</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Start Assessment</h2>
              <p className="text-gray-500 text-center mb-8">
                Upload your survey data and configuration file to generate a comprehensive resilience report.
              </p>
              
              <FileUpload 
                label="1. Survey Data (Excel/CSV)" 
                accept=".xlsx,.xls,.csv" 
                onFileSelect={setSurveyFile} 
                status={surveyFile ? 'success' : error ? 'error' : 'idle'}
                fileName={surveyFile?.name}
              />
              
              <FileUpload 
                label="2. Configuration File (Excel)" 
                accept=".xlsx,.xls" 
                onFileSelect={setConfigFile} 
                status={configFile ? 'success' : error ? 'error' : 'idle'}
                fileName={configFile?.name}
              />

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm flex items-start">
                   <span className="mr-2 mt-0.5">⚠️</span> 
                   <span className="flex-1">{error}</span>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!surveyFile || !configFile}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-[0.98]
                  ${(!surveyFile || !configFile) 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'}
                `}
              >
                Start Analysis
              </button>
              
              <div className="mt-6 text-center">
                <button 
                  onClick={handleDownloadTemplate}
                  className="text-sm text-indigo-500 hover:underline flex items-center justify-center mx-auto"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Configuration Template
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="max-w-md mx-auto text-center py-20">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <svg className="animate-spin w-full h-full text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Analyzing Data</h2>
            <p className="text-gray-500 mb-6">Calculating Shoelace areas and aggregating scores...</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {step === 'results' && results && (
          <div ref={resultsRef} className="animate-fade-in bg-slate-50 p-4">
            {/* Top Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="lg:col-span-1">
                 <DiamondChart data={results} colors={chartColors} />
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col justify-center">
                 <h2 className="text-2xl font-bold text-gray-900 mb-4">Executive Summary</h2>
                 <p className="text-gray-600 leading-relaxed mb-6">
                   Based on the analysis of <strong>{results.potentials.Response.questions.length + results.potentials.Monitor.questions.length + results.potentials.Anticipate.questions.length + results.potentials.Learn.questions.length} questions</strong>, 
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <RadarCard data={results.potentials.Response} color={chartColors.Response} />
              <RadarCard data={results.potentials.Monitor} color={chartColors.Monitor} />
              <RadarCard data={results.potentials.Anticipate} color={chartColors.Anticipate} />
              <RadarCard data={results.potentials.Learn} color={chartColors.Learn} />
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
                    {Object.values(results.potentials).flatMap((p: any) => p.questions).map((q, i) => (
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
        )}
      </main>
    </div>
  );
};

export default App;