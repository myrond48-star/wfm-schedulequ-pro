import React, { useState } from 'react';
import { useAppStore } from '../../lib/store';

interface PublishModalProps {
  onClose: () => void;
  channel: string;
  date: string;
}

export const PublishModal: React.FC<PublishModalProps> = ({ onClose, channel, date }) => {
  const { settings } = useAppStore();
  const [pubChannel, setPubChannel] = useState(channel);
  const [startDate, setStartDate] = useState(date);
  const [endDate, setEndDate] = useState(date);
  const [target, setTarget] = useState('ALL');

  const handleSubmit = (action: 'PUBLISH' | 'UNPUBLISH') => {
    if (!startDate || !endDate) return alert("Select start and end dates!");
    if (startDate > endDate) return alert("Start Date cannot be greater than End Date!");

    // Simplified logic for demo
    alert(`Schedule for ${pubChannel} from ${startDate} to ${endDate} successfully ${action.toLowerCase()}ed!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
      <div className="bg-white p-6 rounded-2xl w-[400px] shadow-2xl">
        <h3 className="mt-0 text-slate-800 font-bold mb-4">📢 Publish / Unpublish Schedule</h3>
        
        <label className="text-xs font-bold text-slate-700 mb-1.5 block">Channel:</label>
        <select className="w-full p-2.5 border border-slate-300 rounded-xl mb-3 font-bold text-indigo-600 outline-none focus:border-indigo-500" value={pubChannel} onChange={e => setPubChannel(e.target.value)}>
          {settings.channels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">Start Date:</label>
            <input type="date" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">End Date:</label>
            <input type="date" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        <label className="text-xs font-bold text-slate-700 mb-1.5 block">Visibility Target (If Publish):</label>
        <select className="w-full p-2.5 border border-slate-300 rounded-xl mb-4 outline-none focus:border-indigo-500" value={target} onChange={e => setTarget(e.target.value)}>
          <option value="ALL">All (Agent & Leader)</option>
          <option value="LEADER">Leader Only</option>
        </select>

        <div className="mb-5 border border-slate-200 rounded-xl bg-slate-50 p-3">
          <label className="text-[11px] font-bold text-slate-500 block mb-2">🔒 Unpublished Dates (Draft):</label>
          <div className="max-h-[80px] overflow-y-auto text-[11px] font-semibold text-rose-500 flex flex-col gap-1">
            <div>• {startDate} <span className="text-slate-400 font-normal">to</span> {endDate}</div>
          </div>
        </div>

        <div className="flex justify-between gap-2.5">
          <button className="flex-1 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200 transition-colors" onClick={onClose}>Cancel</button>
          <button className="flex-1 py-2.5 bg-rose-500 text-white border-none font-bold rounded-xl hover:bg-rose-600 transition-colors" onClick={() => handleSubmit('UNPUBLISH')}>🔒 Unpublish</button>
          <button className="flex-1 py-2.5 bg-emerald-500 text-white border-none font-bold rounded-xl hover:bg-emerald-600 transition-colors" onClick={() => handleSubmit('PUBLISH')}>📢 Publish</button>
        </div>
      </div>
    </div>
  );
};
