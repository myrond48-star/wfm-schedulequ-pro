import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../lib/store';
import { callSupabaseAPI } from '../../lib/supabase';

interface SwapModalProps {
  onClose: () => void;
  channel: string;
  date: string;
}

export const SwapModal: React.FC<SwapModalProps> = ({ onClose, channel, date }) => {
  const { user } = useAppStore();
  const [mode, setMode] = useState<'one' | 'two'>('one');
  const [targetAgent, setTargetAgent] = useState('');
  const [date1, setDate1] = useState(date);
  const [date2, setDate2] = useState('');
  const [reason, setReason] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await callSupabaseAPI('wfm_agents', 'GET', undefined, `?channel=eq.${encodeURIComponent(channel)}&select=nik,nama`);
        if (res) setAgents(res.filter((a: any) => a.nik !== user?.nik));
      } catch (err) {
        console.error(err);
      }
    };
    fetchAgents();
  }, [channel, user?.nik]);

  const handleSubmit = async () => {
    if (!targetAgent || !reason) return alert("Select target agent and enter reason");
    if (mode === 'two' && !date2) return alert("Target date is required for two-way swap");

    setLoading(true);
    try {
      const target = agents.find(a => a.nik === targetAgent);
      
      await callSupabaseAPI('wfm_swaps', 'POST', {
        requester_nik: user?.nik,
        requester_nama: user?.nama,
        target_nik: target.nik,
        target_nama: target.nama,
        date1: date1,
        date2: mode === 'two' ? date2 : null,
        reason: reason,
        status: 'PENDING'
      });
      
      alert("Swap request submitted successfully");
      onClose();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
      <div className="bg-white p-6 rounded-2xl w-[480px] shadow-2xl">
        <div className="text-center mb-5">
          <h3 className="m-0 text-slate-800 text-xl font-bold">🔄 Shift Swap Request</h3>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed px-5">Please ensure you have received approval from your TL & OM before submitting.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button 
            className={`flex-1 py-2.5 rounded-lg font-semibold transition-all ${mode === 'one' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setMode('one')}
          >One Way</button>
          <button 
            className={`flex-1 py-2.5 rounded-lg font-semibold transition-all ${mode === 'two' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setMode('two')}
          >Two Way</button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Requesting Agent</label>
            <input type="text" readOnly className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 outline-none" value={`${user?.nik} - ${user?.nama}`} />
          </div>
          
          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Agent</label>
            <select className="w-full p-3 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500" value={targetAgent} onChange={e => setTargetAgent(e.target.value)}>
              <option value="">-- Select Target Agent --</option>
              {agents.map(a => <option key={a.nik} value={a.nik}>{a.nik} - {a.nama}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Your Date</label>
              <input type="date" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={date1} onChange={e => setDate1(e.target.value)} />
            </div>
            {mode === 'two' && (
              <div className="flex-1">
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Target Date</label>
                <input type="date" className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={date2} onChange={e => setDate2(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Reason</label>
            <textarea rows={3} className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 resize-none" placeholder="Enter the reason for your swap request..." value={reason} onChange={e => setReason(e.target.value)}></textarea>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button className="flex-1 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 font-semibold hover:bg-slate-100" onClick={onClose}>Close</button>
          <button className="flex-[2] py-3 border-none rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processing...' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
};
