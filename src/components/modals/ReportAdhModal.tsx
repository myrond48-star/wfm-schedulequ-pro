import React, { useState } from 'react';
import { useAppStore } from '../../lib/store';

interface ReportAdhModalProps {
  onClose: () => void;
  channel: string;
  date: string;
}

export const ReportAdhModal: React.FC<ReportAdhModalProps> = ({ onClose, channel, date }) => {
  const { settings } = useAppStore();
  const [repChannel, setRepChannel] = useState(channel);
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(date);

  const generateReportAdh = () => {
    if (!startDate || !endDate) return alert("Select start and end dates!");
    if (startDate > endDate) return alert("Start date cannot be greater than end date!");

    // Simplified logic for demo
    alert(`✅ Sucessfully Downloaded!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
      <div className="bg-white p-6 rounded-2xl w-[400px] shadow-2xl">
        <h3 className="mt-0 text-slate-800 font-bold mb-4">📈 Export Adherence Report</h3>
        <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
          The system will calculate real-time Adherence scores per agent based on the selected date range.
        </p>

        <label className="text-xs font-bold text-slate-700 block mb-1.5">Channel:</label>
        <select className="w-full p-2.5 border border-slate-300 rounded-xl mb-3 font-bold text-sky-600 outline-none focus:border-sky-500" value={repChannel} onChange={e => setRepChannel(e.target.value)}>
          {settings.channels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex gap-2.5 mb-5">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Start Date:</label>
            <input type="date" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-sky-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">End Date:</label>
            <input type="date" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-sky-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <button className="px-5 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200 transition-colors" onClick={onClose}>Cancel</button>
          <button className="px-5 py-2.5 bg-sky-500 text-white border-none font-bold rounded-xl hover:bg-sky-600 transition-colors shadow-lg shadow-sky-200" onClick={generateReportAdh}>📥 Export to Excel</button>
        </div>
      </div>
    </div>
  );
};
