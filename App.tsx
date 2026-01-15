import React, { useState } from 'react';
import { Download, Activity, AlertTriangle } from 'lucide-react';
import { utils, read, writeFile } from 'xlsx';
import FileUpload from './components/FileUpload';
import ResultsReport from './components/ResultsReport';
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
  
  const defaultColors = {
    Response: '#3b82f6',
    Monitor: '#ef4444',
    Anticipate: '#f97316',
    Learn: '#22c55e'
  };

  const [chartColors, setChartColors] = useState<Record<string, string>>(defaultColors);
  
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
          {/* Header buttons are now managed inside ResultsReport for the Results view */}
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
          <>
            {results.warnings && results.warnings.length > 0 && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Data Warning: Unmapped Likert Values Detected
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p className="mb-2">
                          The following values found in your survey data were not found in the Configuration (Likert_Mapping) and were excluded from calculation:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 max-h-32 overflow-y-auto">
                          {results.warnings.map((val, idx) => (
                            <li key={idx}>"{val}"</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs font-semibold">
                          Please update your Configuration file's "Likert_Mapping" sheet to include these variations if they are valid.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <ResultsReport 
              results={results} 
              chartColors={chartColors} 
              onReset={handleReset} 
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;