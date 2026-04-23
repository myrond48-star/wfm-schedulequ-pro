import React, { useState, useEffect } from 'react';
import { callSupabaseAPI } from '../../lib/supabase';
import { Users, AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface DeleteRangeModalProps {
  onClose: () => void;
  channel: string;
}

export const DeleteRangeModal: React.FC<DeleteRangeModalProps> = ({ onClose, channel }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetNik, setTargetNik] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [agents, setAgents] = useState<{ nik: string; nama: string }[]>([]);
  const [isFetchingAgents, setIsFetchingAgents] = useState(false);

  const [isConfirming, setIsConfirming] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      setIsFetchingAgents(true);
      try {
        const res = await callSupabaseAPI('wfm_agents', 'GET', undefined, `?channel=eq.${encodeURIComponent(channel)}&select=nik,nama&order=nama.asc`);
        if (res) setAgents(res);
      } catch (err) {
        console.error("Failed to fetch agents for deletion dropdown:", err);
      } finally {
        setIsFetchingAgents(false);
      }
    };
    fetchAgents();
  }, [channel]);

  const processDeleteRange = async () => {
    if (!startDate || !endDate) {
      alert("⚠️ Please select a valid Date Range first!");
      return;
    }
    
    if (startDate > endDate) {
      alert("⚠️ Error: Start Date cannot be later than End Date!");
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setIsLoading(true);
    setIsConfirming(false);
    
    try {
      // In Supabase DELETE, we append the filters to the URL
      let query = `?channel=eq.${encodeURIComponent(channel)}&date=gte.${startDate}&date=lte.${endDate}`;
      if (targetNik !== 'ALL') {
        query += `&nik=eq.${encodeURIComponent(targetNik)}`;
      }

      await callSupabaseAPI('wfm_schedules', 'DELETE', undefined, query);
      
      setIsSuccess(true);
      
      // Send notification
      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: 'Delete Success',
          message: `Schedules cleared for ${targetLabel} (${startDate} to ${endDate})`,
          type: 'success'
        }
      }));

    } catch (err: any) {
      console.error("Delete operation failed:", err);
      alert("❌ Delete Error: " + (err.message || 'Operation failed. Please check your connection or database permissions.'));
    } finally {
      setIsLoading(false);
    }
  };

  const targetLabel = targetNik === 'ALL' ? 'ALL AGENTS' : `NIK ${targetNik}`;

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[20000]">
        <div className="bg-white p-8 rounded-3xl w-full max-w-[400px] shadow-2xl text-center flex flex-col gap-5 border border-slate-100">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
             <Trash2 size={32} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 mb-1 uppercase tracking-tight">Data Cleared!</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Successfully removed records for <b>{targetLabel}</b> during the selected period.
            </p>
          </div>
          <button 
            onClick={() => { 
                onClose(); 
                window.dispatchEvent(new CustomEvent('wfm-refresh'));
            }}
            className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all text-xs uppercase tracking-widest"
          >
            Done & Update View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[20000] animate-in fade-in duration-200">
      <div className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-[450px] shadow-2xl border border-slate-100 flex flex-col gap-6">
        <div className="flex items-center gap-3 text-rose-600">
          <div className="p-2.5 bg-rose-50 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight m-0">Permanent Delete</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Scheduled Data Removal</p>
          </div>
        </div>

        {isConfirming ? (
          <div className="flex flex-col gap-5 animate-in slide-in-from-bottom-2 duration-300">
            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200">
              <h4 className="text-sm font-black text-amber-800 uppercase mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Final Warning
              </h4>
              <p className="text-xs text-amber-700 font-medium leading-relaxed mb-4">
                You are about to delete schedules for <b className="text-amber-900">{targetLabel}</b> from <b className="text-amber-900">{startDate}</b> to <b className="text-amber-900">{endDate}</b>. 
                This action is IRREVERSIBLE.
              </p>
              <div className="text-[10px] font-bold text-amber-600/80 italic">
                * All matching records in channel "{channel}" will be destroyed.
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-xs" 
                onClick={() => setIsConfirming(false)}
              >
                Back
              </button>
              <button 
                className="flex-[2] py-3.5 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 active:scale-[0.98] transition-all text-xs shadow-xl shadow-rose-200" 
                onClick={processDeleteRange}
              >
                Yes, Delete Forever
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
              <p className="text-xs text-rose-700/80 m-0 leading-relaxed font-medium">
                Use this tool to clear schedule records for a specific date range. This process is <b>irreversible</b> and will clean up the database immediately.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase ml-1">Start Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-bold text-xs" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-500 uppercase ml-1">End Date</label>
                <input 
                  type="date" 
                  className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-bold text-xs" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase ml-1">Target Agent</label>
              <div className="relative">
                <Users size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  disabled={isFetchingAgents || isLoading}
                  className="w-full p-3 pl-10 rounded-2xl border border-slate-200 bg-slate-50 appearance-none outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-bold text-xs cursor-pointer disabled:opacity-50"
                  value={targetNik}
                  onChange={e => setTargetNik(e.target.value)}
                >
                  <option value="ALL">--- DELETE ALL AGENTS ---</option>
                  {agents.map(a => (
                    <option key={a.nik} value={a.nik}>
                      {a.nama} ({a.nik})
                    </option>
                  ))}
                </select>
                {isFetchingAgents && (
                  <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button 
                disabled={isLoading} 
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-xs disabled:opacity-50" 
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                disabled={isLoading || !startDate || !endDate} 
                className="flex-[2] py-3.5 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-700 active:scale-[0.98] transition-all text-xs shadow-xl shadow-rose-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2" 
                onClick={processDeleteRange}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting Data...
                  </>
                ) : (
                  <>🗑️ Permanent Delete</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>

  );
};
