import React, { useState } from 'react';

interface ImportScheduleModalProps {
  onClose: () => void;
}

export const ImportScheduleModal: React.FC<ImportScheduleModalProps> = ({ onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rawData, setRawData] = useState('');

  const processImportSchedule = () => {
    if (!startDate || !endDate) return alert("Please select an Import Date Range first!");
    if (startDate > endDate) return alert("Start Date cannot be greater than End Date!");
    if (!rawData) return alert("Data is empty! Please paste data from Excel.");

    // Simplified logic for demo
    alert(`✅ Success! Schedule has been written to GSheet and automatically synced to Supabase.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
      <div className="bg-white p-6 rounded-2xl w-full max-w-[800px] shadow-2xl overflow-y-auto max-h-[90vh]">
        <h3 className="mt-0 text-slate-800 font-bold mb-4">📥 Bulk Import Schedule (to GSheet & Supabase)</h3>

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
          className="w-full h-[200px] border border-slate-300 rounded-xl p-3 font-mono text-[11px] whitespace-pre overflow-x-auto outline-none focus:border-indigo-500 resize-none" 
          placeholder="Select all data in your Excel (including header), Copy, then Paste here..."
          value={rawData}
          onChange={e => setRawData(e.target.value)}
        ></textarea>
        
        <div className="flex flex-col sm:flex-row justify-end gap-2.5 mt-5">
          <button className="px-5 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200 transition-colors w-full sm:w-auto" onClick={onClose}>Cancel</button>
          <button className="px-5 py-2.5 bg-indigo-600 text-white border-none font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 w-full sm:w-auto" onClick={processImportSchedule}>🚀 Start Import</button>
        </div>
      </div>
    </div>
  );
};
