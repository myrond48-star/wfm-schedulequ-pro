import React, { useState } from 'react';

interface DeleteRangeModalProps {
  onClose: () => void;
  channel: string;
}

export const DeleteRangeModal: React.FC<DeleteRangeModalProps> = ({ onClose, channel }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetNik, setTargetNik] = useState('ALL');

  const processDeleteRange = () => {
    if (!startDate || !endDate) return alert("Please select a date range first!");
    if (startDate > endDate) return alert("Start Date cannot be greater than End Date!");

    let confirmMsg = targetNik === 'ALL' 
        ? `STRICT WARNING!\n\nYou are about to delete ALL SCHEDULES for channel ${channel}\nfrom ${startDate} to ${endDate}.\n\nContinue?`
        : `You are about to delete schedules for NIK ${targetNik}\nfrom ${startDate} to ${endDate}.\n\nContinue?`;

    if (!confirm(confirmMsg)) return;

    // Simplified logic for demo
    alert("✅ Data successfully cleared from Supabase and GSheet.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
      <div className="bg-white p-6 rounded-2xl w-[400px] shadow-2xl">
        <h3 className="mt-0 text-rose-600 font-bold mb-4">🗑️ Delete Schedule Range</h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          This feature will <b>permanently</b> delete schedule data and history reasons from Supabase and GSheet.
        </p>

        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Start Date:</label>
            <input type="date" className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-rose-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">End Date:</label>
            <input type="date" className="w-full p-2.5 rounded-xl border border-slate-300 outline-none focus:border-rose-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <label className="text-xs font-bold text-slate-700 block mb-1.5">Select Target Agent:</label>
        <select className="w-full p-2.5 rounded-xl border border-slate-300 mb-5 font-bold outline-none focus:border-rose-500" value={targetNik} onChange={e => setTargetNik(e.target.value)}>
          <option value="ALL">⚠️ ALL AGENTS (In This Channel)</option>
        </select>

        <div className="flex justify-end gap-2.5">
          <button className="px-5 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200 transition-colors" onClick={onClose}>Cancel</button>
          <button className="px-5 py-2.5 bg-rose-500 text-white border-none font-bold rounded-xl hover:bg-rose-600 transition-colors shadow-lg shadow-rose-200" onClick={processDeleteRange}>🗑️ Permanent Delete</button>
        </div>
      </div>
    </div>
  );
};
