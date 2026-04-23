import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../lib/store';
import { callSupabaseAPI } from '../../lib/supabase';

interface ApprovalModalProps {
  onClose: () => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({ onClose }) => {
  const { user } = useAppStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await callSupabaseAPI('wfm_swaps', 'GET', undefined, `?status=eq.PENDING&select=*`);
      if (res) setRequests(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApproval = async (id: number, action: 'APPROVED' | 'REJECT') => {
    if (!confirm(`Confirm ${action} for this request?`)) return;
    const req = requests.find(r => r.id === id);
    try {
      await callSupabaseAPI('wfm_swaps', 'PATCH', { status: action }, `?id=eq.${id}`);
      
      // Notify
      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: 'Request ' + action,
          message: `Swap request between ${req?.requester_nama} and ${req?.target_nama} has been ${action.toLowerCase()}`,
          type: action === 'APPROVED' ? 'success' : 'warning',
          category: 'swap',
          requesterNik: req?.requester_nik,
          targetNik: req?.target_nik
        }
      }));

      alert(`Request ${action}`);
      fetchRequests();
    } catch (err: any) {
      alert("Failed: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
      <div className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-[450px] shadow-2xl">
        <h3 className="mt-0 mb-6 text-slate-800 text-xl font-bold">Pending Swap Requests</h3>
        
        <div className="max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
          {loading ? (
            <div className="text-center py-5 text-slate-500">⏳ Loading pending requests...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-5 text-slate-400">No pending requests.</div>
          ) : (
            requests.map(r => (
              <div key={r.id} className="border border-slate-200 rounded-2xl p-4 mb-3 bg-white shadow-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">ID: {r.id}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">📅 {r.date1} {r.date2 ? ' ↔ ' + r.date2 : ''}</span>
                </div>
                <div className="text-[13px] font-bold text-slate-800 mb-1">
                  {r.requester_nama} <span className="text-slate-400 font-normal">swap with</span> {r.target_nama}
                </div>
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg mb-3 border-l-2 border-slate-300 italic">
                  "{r.reason}"
                </div>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button className="flex-1 py-2.5 bg-emerald-500 text-white border-none rounded-xl cursor-pointer font-bold text-xs hover:bg-emerald-600 transition-colors" onClick={() => handleApproval(r.id, 'APPROVED')}>Approve</button>
                  <button className="flex-1 py-2.5 bg-rose-500 text-white border-none rounded-xl cursor-pointer font-bold text-xs hover:bg-rose-600 transition-colors" onClick={() => handleApproval(r.id, 'REJECT')}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>

        <button className="w-full mt-5 py-3 bg-indigo-600 text-white border-none rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
