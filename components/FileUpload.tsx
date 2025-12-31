import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept: string;
  onFileSelect: (file: File) => void;
  status: 'idle' | 'success' | 'error';
  fileName?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, accept, onFileSelect, status, fileName }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors cursor-pointer
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'}
          ${status === 'error' ? 'border-red-300 bg-red-50' : ''}
          ${status === 'success' ? 'border-green-300 bg-green-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept={accept}
          onChange={(e) => e.target.files && onFileSelect(e.target.files[0])}
        />
        
        {status === 'success' ? (
          <>
            <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
            <p className="text-sm font-medium text-green-700">{fileName}</p>
            <p className="text-xs text-green-600">File loaded successfully</p>
          </>
        ) : (
          <>
            {status === 'error' ? (
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
            ) : (
              <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-2" />
            )}
            <p className="text-sm text-gray-600 text-center">
              <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">Excel (.xlsx, .xls) or CSV</p>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;