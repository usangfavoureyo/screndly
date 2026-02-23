import { useState, useRef } from 'react';
import { BottomSheet, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription, BottomSheetBody, BottomSheetFooter } from './ui/bottom-sheet';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ScrollArea } from './ui/scroll-area';
import { FileSpreadsheet, AlertCircle, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { haptics } from '../utils/haptics';
// Dynamic import for xlsx - only loaded when needed
// import * as XLSX from 'xlsx';

interface SceneImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (scenes: any[], replace: boolean, movieName?: string) => void;
}

interface ParsedScene {
  description: string;
  startTime: string;
  endTime: string;
  details: string;
  startSeconds: number;
  endSeconds: number;
}

export function SceneImportDialog({ isOpen, onClose, onImport }: SceneImportDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedScenes, setParsedScenes] = useState<ParsedScene[]>([]);
  const [movieName, setMovieName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    haptics.light();
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      haptics.light();
      processFile(e.target.files[0]);
    }
  };

  const parseTime = (timeStr: string | number): number => {
    if (typeof timeStr === 'number') return timeStr;
    if (!timeStr) return 0;
    
    const str = timeStr.toString().trim();
    
    // Handle HH:MM:SS or MM:SS
    if (str.includes(':')) {
      const parts = str.split(':').map(Number);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
    }
    
    // Handle plain seconds
    const seconds = parseFloat(str);
    return isNaN(seconds) ? 0 : seconds;
  };

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/)) {
      setError('Please upload a valid spreadsheet (.csv, .xlsx, .xls)');
      return;
    }

    setFile(file);
    setError(null);
    setParsedScenes([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Dynamically import xlsx when needed
        const XLSX = await import('xlsx');
        
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          setError('The spreadsheet appears to be empty.');
          return;
        }

        // Validate and map data
        const scenes: ParsedScene[] = [];
        let detectedMovieName = '';

        // Try to identify columns flexibly
        const firstRow = jsonData[0] as any;
        const keys = Object.keys(firstRow);
        
        // Helper to find key case-insensitively
        const findKey = (search: string) => keys.find(k => k.toLowerCase().includes(search.toLowerCase()));

        const movieKey = findKey('Movie');
        const descKey = findKey('Scene Description') || findKey('Description') || findKey('Title');
        const startKey = findKey('Start Time') || findKey('Start');
        const endKey = findKey('End Time') || findKey('End');
        const detailsKey = findKey('Scene Details') || findKey('Dialogue') || findKey('Context') || findKey('Details');

        if (!descKey || !startKey || !endKey) {
          setError('Could not identify required columns (Scene Description, Start Time, End Time). Please check the spreadsheet format.');
          return;
        }

        if (movieKey && firstRow[movieKey]) {
            detectedMovieName = firstRow[movieKey];
            setMovieName(detectedMovieName);
        }

        jsonData.forEach((row: any, index) => {
          const startTime = row[startKey];
          const endTime = row[endKey];
          const startSeconds = parseTime(startTime);
          const endSeconds = parseTime(endTime);

          if (startSeconds >= 0 && endSeconds > startSeconds) {
            scenes.push({
              description: row[descKey] || `Scene ${index + 1}`,
              startTime: startTime?.toString() || '',
              endTime: endTime?.toString() || '',
              details: detailsKey ? row[detailsKey] || '' : '',
              startSeconds,
              endSeconds
            });
          }
        });

        if (scenes.length === 0) {
          setError('No valid scenes found. Please check timestamp formats.');
        } else {
          setParsedScenes(scenes);
          haptics.success();
        }

      } catch (err) {
        console.error(err);
        setError('Failed to parse the file. Please ensure it is a valid spreadsheet.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = () => {
    if (parsedScenes.length === 0) return;
    haptics.success();
    onImport(parsedScenes, importMode === 'replace', movieName);
    onClose();
    setFile(null);
    setParsedScenes([]);
    setError(null);
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()} heightMode="auto">
      <BottomSheetHeader>
        <BottomSheetTitle>Import Scenes from Spreadsheet</BottomSheetTitle>
        <BottomSheetDescription>
          Upload a CSV or Excel file with columns: Movie, Scene Description, Start Time, End Time, Scene Details.
        </BottomSheetDescription>
      </BottomSheetHeader>

      <BottomSheetBody>
        {!parsedScenes.length ? (
          <div 
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-gray-300 dark:border-[#333333] hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              haptics.light();
              fileInputRef.current?.click();
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
            />
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-gray-600 dark:text-[#9CA3AF]" />
              <p className="text-sm text-gray-900 dark:text-white">Click to browse or drag file here</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Supports .xlsx, .xls, .csv</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-green-100 dark:bg-green-950 p-2 rounded-full">
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-900 dark:text-white">{file?.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{parsedScenes.length} scenes found {movieName && `• ${movieName}`}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                    haptics.light();
                    setParsedScenes([]);
                    setFile(null);
                }}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="h-[200px] border border-gray-200 dark:border-[#333333] rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scene</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedScenes.map((scene, i) => (
                    <TableRow key={i}>
                      <TableCell>{scene.description}</TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {scene.startTime} - {scene.endTime}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                        {scene.details}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-2">
                    <input 
                        type="radio" 
                        id="replace" 
                        name="mode" 
                        checked={importMode === 'replace'} 
                        onChange={() => {
                          haptics.light();
                          setImportMode('replace');
                        }}
                        onFocus={() => haptics.light()}
                        className="text-red-600 focus:ring-red-500"
                    />
                    <label htmlFor="replace" className="text-sm cursor-pointer text-gray-900 dark:text-white">Replace existing scenes</label>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="radio" 
                        id="append" 
                        name="mode" 
                        checked={importMode === 'append'} 
                        onChange={() => {
                          haptics.light();
                          setImportMode('append');
                        }}
                        onFocus={() => haptics.light()}
                        className="text-red-600 focus:ring-red-500"
                    />
                    <label htmlFor="append" className="text-sm cursor-pointer text-gray-900 dark:text-white">Append to list</label>
                </div>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </BottomSheetBody>

      <BottomSheetFooter>
        <Button variant="outline" onClick={() => {
          haptics.light();
          onClose();
        }}>Cancel</Button>
        <Button onClick={handleImport} disabled={parsedScenes.length === 0}>
          Import {parsedScenes.length > 0 ? `${parsedScenes.length} Scenes` : ''}
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  );
}