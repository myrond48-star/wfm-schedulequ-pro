import React, { useState } from 'react';
import { callSupabaseAPI } from '../../lib/supabase';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';

interface ImportScheduleModalProps {
  onClose: () => void;
}

export const ImportScheduleModal: React.FC<ImportScheduleModalProps> = ({ onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rawData, setRawData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [isSuccess, setIsSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const processImportSchedule = async () => {
    if (!startDate || !endDate) return alert("Please select an Import Date Range first!");
    if (startDate > endDate) return alert("Start Date cannot be greater than End Date!");
    if (!rawData) return alert("Data is empty! Please paste data from Excel.");

    const lines = rawData.split('\n').filter(l => l.trim());
    if (lines.length < 2) return alert("No valid data found. Make sure to include header and at least one agent row.");

    setIsLoading(true);
    setProgress(5);
    setIsSuccess(false);

    try {
      const header = lines[0].split('\t');
      const agents = lines.slice(1);
      const startD = parseISO(startDate);
      const endD = parseISO(endDate);
      const daysCount = differenceInDays(endD, startD) + 1;

      const scheduleData: any[] = [];

      agents.forEach((line) => {
        const cols = line.split('\t');
        if (cols.length < 5) return;

        const nik = cols[1]?.trim();
        const nama = cols[2]?.trim();
        const tl = cols[3]?.trim();
        const channel = cols[4]?.trim();

        if (!nik || !channel) return;

        for (let i = 0; i < daysCount; i++) {
          const currentDate = format(addDays(startD, i), 'yyyy-MM-dd');
          const scheduleCode = cols[5 + i]?.trim();

          if (scheduleCode) {
            scheduleData.push({
              nik,
              nama,
              tl,
              channel,
              date: currentDate,
              shift: scheduleCode
            });
          }
        }
      });

      if (scheduleData.length === 0) {
        throw new Error("No schedule codes found in the pasted data range.");
      }

      setImportedCount(scheduleData.length);
      setProgress(30);

      const query = `?on_conflict=nik,date`;
      const batchSize = 500; // Smaller batches for better reliability
      
      for (let i = 0; i < scheduleData.length; i += batchSize) {
        const batch = scheduleData.slice(i, i + batchSize);
        await callSupabaseAPI('wfm_schedules', 'POST', batch, query);
        setProgress(30 + Math.round((i / scheduleData.length) * 70));
      }

      setProgress(100);
      setIsSuccess(true);
      
      // Notify parent about success
      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: 'Import Success',
          message: `Successfully imported ${scheduleData.length} records to the database.`,
          type: 'success'
        }
      }));
    } catch (err: any) {
      console.error("Import failed:", err);
      alert("❌ Import failed: " + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
        <div className="bg-white p-8 rounded-3xl w-full max-w-[400px] shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Import Successful!</h2>
          <p className="text-sm text-slate-500 mb-6 font-medium">
            Successfully imported <b>{importedCount}</b> schedule records to the database.
          </p>
          <button 
            onClick={() => { 
                onClose(); 
                window.dispatchEvent(new CustomEvent('wfm-refresh'));
            }}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all font-black text-xs uppercase tracking-widest"
          >
            Done & Refresh View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
      <div className="bg-white p-6 rounded-2xl w-full max-w-[800px] shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="mt-0 text-slate-800 font-bold">📥 Bulk Import Schedule</h3>
          {!isLoading && (
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 sm:items-center">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 block mb-1">Start Date (First Schedule Column):</label>
            <input type="date" className="w-full p-2 rounded-lg border border-slate-300 outline-none focus:border-indigo-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="font-bold text-slate-400 mt-4">-</div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 block mb-1">End Date (Last Schedule Column):</label>
            <input type="date" className="w-full p-2 rounded-lg border border-slate-300 outline-none focus:border-indigo-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-2.5">
          <b>Required Column Format (Left to Right):</b> No | NIK | Name | TL | Channel | Day 1 Schedule | Day 2 Schedule | etc...
        </p>
        <textarea 
          disabled={isLoading}
          className="w-full h-[200px] border border-slate-300 rounded-xl p-3 font-mono text-[11px] whitespace-pre overflow-x-auto outline-none focus:border-indigo-500 resize-none shadow-inner" 
          placeholder="Select all data in your Excel (including header), Copy, then Paste here..."
          value={rawData}
          onChange={e => setRawData(e.target.value)}
        ></textarea>
        
        {isLoading && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 animate-pulse">
            <div className="flex justify-between items-center mb-2">
               <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Uploading Data...</span>
               <span className="text-[10px] font-black text-indigo-600">{progress}%</span>
            </div>
            <div className="w-full bg-indigo-200 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div className="bg-indigo-600 h-full transition-all duration-300 shadow-lg" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-[10px] text-center mt-2.5 text-indigo-500/70 font-bold italic tracking-tight">Please do not close this window or refresh the page.</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-2.5 mt-5">
          <button disabled={isLoading} className="px-5 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200 transition-colors w-full sm:w-auto flex-shrink-0" onClick={onClose}>Cancel</button>
          <button disabled={isLoading} className="px-5 py-3.5 bg-indigo-600 text-white border-none font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 w-full sm:w-auto flex items-center justify-center gap-2 min-w-[140px]" onClick={processImportSchedule}>
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Importing...
              </>
            ) : (
              <>🚀 Start Import</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
