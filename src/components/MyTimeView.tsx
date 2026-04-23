import React, { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import { callSupabaseAPI } from '../lib/supabase';
import { Calendar, Clock, FileText, CheckCircle2, XCircle, Clock4, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { format, parseISO, addDays, isWithinInterval } from 'date-fns';

interface MyTimeViewProps {
  channel: string;
  startDate: string;
  endDate: string;
  search: string;
  filterTL: string;
  masterKey: boolean;
  myTimeTab: 'personal' | 'request_calendar' | 'request_list';
  setMyTimeTab: (tab: 'personal' | 'request_calendar' | 'request_list') => void;
}

const TYPE_MAP: Record<string, string> = {
  'Cuti': 'Leave',
  'Sakit': 'Sick',
  'Ijin': 'Permission',
  'Alpha': 'Alpha',
  'OFF': 'OFF',
  'Other': 'Other'
};

const COLOR_MAP: Record<string, string> = {
  'Leave': '#a78bfa',
  'Sick': '#f43f5e',
  'Permission': '#f59e0b',
  'Alpha': '#52525b',
  'OFF': '#94a3b8'
};

export const MyTimeView: React.FC<MyTimeViewProps> = ({
  channel, startDate, endDate, search, filterTL, masterKey, myTimeTab, setMyTimeTab
}) => {
  const { user, settings } = useAppStore();
  const [requests, setRequests] = useState<any[]>([]); // personal requests
  const [teamRequests, setTeamRequests] = useState<any[]>([]); // channel requests
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Form State
  const shiftOptions = Object.keys(settings.shifts || {});
  const requestOptions = [
    'Leave', 'Sick', 'Permission', 'Alpha', 'OFF', ...shiftOptions, 'Other'
  ];
  
  const [type, setType] = useState('Leave');
  const [reqStart, setReqStart] = useState(new Date().toISOString().split('T')[0]);
  const [reqEnd, setReqEnd] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (myTimeTab === 'personal') {
      fetchPersonalRequests();
    } else {
      fetchTeamRequests();
    }
  }, [user, myTimeTab, channel, startDate, endDate]);

  const fetchPersonalRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await callSupabaseAPI('cuti_requests', 'GET', undefined, `?nik=eq.${user.nik}&order=id.desc`);
      if (res) setRequests(res);
    } catch (err: any) {
      console.warn("fetchPersonalRequests error:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamRequests = async () => {
    setLoading(true);
    try {
      // Fetch agents, schedules, and holidays in parallel
      const [agents, holRes] = await Promise.all([
        callSupabaseAPI('wfm_agents', 'GET', undefined, `?channel=eq.${encodeURIComponent(channel)}&select=nik,nama`),
        callSupabaseAPI('wfm_holidays', 'GET', undefined, `?select=*`)
      ]);
      
      // Combine DB holidays with settings
      const holMap: Record<string, string> = { ...settings.holidays };
      if (holRes) {
        holRes.forEach((h: any) => {
          if (h.date && h.description) holMap[h.date] = h.description;
        });
      }
      setHolidays(holMap);

      // Fetch schedules to get TL mappings
      const schedulesMap: Record<string, string> = {};
      try {
        const schedules = await callSupabaseAPI('wfm_schedules', 'GET', undefined, `?channel=eq.${encodeURIComponent(channel)}&date=gte.${startDate}&date=lte.${endDate}&select=nik,tl`);
        if (schedules) {
          schedules.forEach((s: any) => {
            if (s.nik && s.tl) {
              schedulesMap[s.nik] = s.tl;
            }
          });
        }
      } catch (e) {
        console.warn("Could not fetch schedules for TL mapping", e);
      }

      const enhancedAgents = (agents || []).map((a: any) => ({
        ...a,
        tl: schedulesMap[a.nik] || ''
      }));

      setAgentsList(enhancedAgents);
      
      const reqs = await callSupabaseAPI('cuti_requests', 'GET', undefined, `?start_date=lte.${endDate}&end_date=gte.${startDate}&order=id.desc`);
      
      const channelNiks = new Set(enhancedAgents.map((a: any) => a.nik));
      const filteredReqs = (reqs || []).filter((r: any) => channelNiks.has(r.nik));
      setTeamRequests(filteredReqs);
    } catch (err: any) {
      console.warn("fetchTeamRequests error:", err);
      setTeamRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (start: string, end: string) => {
    try {
      const s = parseISO(start);
      const e = parseISO(end);
      const diffTime = Math.abs(e.getTime() - s.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 1;
    }
  };

  const getSisaCuti = () => {
    let used = 0;
    requests.forEach(req => {
      if (req.jenis === 'Leave' && (req.status === 'APPROVED' || req.status === 'PENDING' || req.status === 'Pending')) {
        used += calculateDays(req.start_date, req.end_date);
      }
    });
    return Math.max(0, 12 - used);
  };

  const sakit = requests.filter(r => r.jenis === 'Sick' && (r.status === 'APPROVED' || r.status === 'Approved')).reduce((acc, curr) => acc + calculateDays(curr.start_date, curr.end_date), 0);
  const ijin = requests.filter(r => r.jenis === 'Permission' && (r.status === 'APPROVED' || r.status === 'Approved')).reduce((acc, curr) => acc + calculateDays(curr.start_date, curr.end_date), 0);
  const alpha = requests.filter(r => r.jenis === 'Alpha' && (r.status === 'APPROVED' || r.status === 'Approved')).reduce((acc, curr) => acc + calculateDays(curr.start_date, curr.end_date), 0);

  const totalAbsences = sakit + ijin + alpha;
  const totalTheoreticalWorkingDays = 260;
  let attendancePct = 100;
  if (totalTheoreticalWorkingDays > 0) {
    attendancePct = Math.max(0, Math.round(((totalTheoreticalWorkingDays - totalAbsences) / totalTheoreticalWorkingDays) * 100));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const isOther = type === 'Other';
    if (isOther && !otherText.trim()) return alert("Please specify the 'Other' request type");
    if (!reason.trim()) return alert("Please provide a mandatory reason for this request");

    setSubmitting(true);
    let finalType = isOther ? `Other: ${otherText}` : type;

    try {
      await callSupabaseAPI('cuti_requests', 'POST', {
        nik: user.nik,
        jenis: finalType,
        start_date: reqStart,
        end_date: reqEnd,
        alasan: reason,
        status: 'Pending'
      });

      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: 'Request Submitted',
          message: `Your ${finalType} request has been submitted.`,
          type: 'success',
          category: 'activity',
          targetNik: user.nik
        }
      }));

      alert("Request submitted successfully!");
      setReason('');
      setOtherText('');
      fetchPersonalRequests();
    } catch (err: any) {
      if (err.message?.includes('23503')) {
        alert("Submission Failed: Your account's NIK does not exist in the referenced 'pegawai' table. Please ensure your NIK is registered in the master employee database.");
      } else {
        alert("Error submitting request: " + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (req: any, status: 'APPROVED' | 'REJECTED') => {
    try {
      await callSupabaseAPI('cuti_requests', 'PATCH', { status }, `?id=eq.${req.id}`);
      
      // If approved, sync to wfm_schedules so CalendarView can see it seamlessly
      if (status === 'APPROVED') {
        let d = parseISO(req.start_date);
        const endD = parseISO(req.end_date);
        
        while (d <= endD) {
          const dtStr = format(d, 'yyyy-MM-dd');
          
          // Determine BG Color
          let color = COLOR_MAP[req.jenis] || '#cbd5e1';
          if (settings.shifts && settings.shifts[req.jenis]) color = settings.shifts[req.jenis];

          // Check if schedule exists
          const existing = await callSupabaseAPI('wfm_schedules', 'GET', undefined, `?date=eq.${dtStr}&nik=eq.${req.nik}`);
          if (existing && existing.length > 0) {
            await callSupabaseAPI('wfm_schedules', 'PATCH', { shift: req.jenis, bg_color: color }, `?date=eq.${dtStr}&nik=eq.${req.nik}`);
          } else {
            const agentInf = agentsList.find(a => a.nik === req.nik) || {};
            await callSupabaseAPI('wfm_schedules', 'POST', {
              date: dtStr,
              nik: req.nik,
              nama: agentInf.nama || req.nik,
              channel: channel,
              tl: agentInf.tl || '',
              shift: req.jenis,
              bg_color: color,
              activities: []
            });
          }
          d = addDays(d, 1);
        }
      }

      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: `Request ${status}`,
          message: `Your request for ${req.jenis} has been ${status.toLowerCase()}.`,
          type: status === 'APPROVED' ? 'success' : 'warning',
          category: 'activity',
          targetNik: req.nik
        }
      }));
      fetchTeamRequests();
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />;
      case 'REJECTED': return <XCircle size={16} className="text-rose-500 flex-shrink-0" />;
      default: return <Clock4 size={16} className="text-amber-500 flex-shrink-0" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  // Grid Data
  const dates: string[] = [];
  let currD = parseISO(startDate);
  const endD = parseISO(endDate);
  while (currD <= endD) {
    dates.push(format(currD, 'yyyy-MM-dd'));
    currD = addDays(currD, 1);
  }

  const agentRequestMap: Record<string, { nik: string, nama: string, tl: string, requests: Record<string, any> }> = {};
  
  // First, populate all agents from the selected channel
  agentsList.forEach(agent => {
    agentRequestMap[agent.nik] = { nik: agent.nik, nama: agent.nama, tl: agent.tl, requests: {} };
  });

  // Then map the requests to these agents
  teamRequests.forEach(req => {
    if (!agentRequestMap[req.nik]) {
      const agent = agentsList.find(a => a.nik === req.nik);
      agentRequestMap[req.nik] = { nik: req.nik, nama: agent?.nama || req.nik, tl: agent?.tl || '', requests: {} };
    }
    
    let rd = parseISO(req.start_date);
    const rend = parseISO(req.end_date);
    while (rd <= rend) {
      const dt = format(rd, 'yyyy-MM-dd');
      // only map if it's within current range
      if (dt >= startDate && dt <= endDate) {
        agentRequestMap[req.nik].requests[dt] = req;
      }
      rd = addDays(rd, 1);
    }
  });

  const displayAgents = Object.values(agentRequestMap).filter(agent => {
    const matchesTL = !filterTL || agent.tl === filterTL;
    const matchesSearch = !search || 
      agent.nama.toLowerCase().includes(search.toLowerCase()) || 
      agent.nik.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && matchesTL;
  }).sort((a,b) => a.nama.localeCompare(b.nama));

  const listAgents = teamRequests.map(req => {
    const agent = agentsList.find(a => a.nik === req.nik);
    return { ...req, nama: agent?.nama || req.nik, tl: agent?.tl || '' };
  }).filter(req => {
    const searchMatch = !search || (req.nama && req.nama.toLowerCase().includes(search.toLowerCase())) || req.nik.toLowerCase().includes(search.toLowerCase());
    const tlMatch = !filterTL || req.tl === filterTL;
    return searchMatch && tlMatch;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      {/* Internal Tabs */}
      <div className="flex border-b border-slate-200 bg-white sticky top-0 z-20 px-4 sm:px-6">
        <button 
          onClick={() => setMyTimeTab('personal')}
          className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${myTimeTab === 'personal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          My Dashboard
        </button>
        <button 
          onClick={() => setMyTimeTab('request_calendar')}
          className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${myTimeTab === 'request_calendar' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Request Grid
        </button>
        {masterKey && (
          <button 
            onClick={() => setMyTimeTab('request_list')}
            className={`py-4 px-4 text-sm font-bold border-b-2 transition-colors ${myTimeTab === 'request_list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            All Requests
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {myTimeTab === 'personal' && (
          <div className="max-w-6xl mx-auto space-y-6 pb-32">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-1">
                <Calendar size={24} className="text-indigo-600" />
                My Time Dashboard
              </h2>
              <p className="text-sm text-slate-500 font-medium">Manage your attendance, time-offs, and shift requests.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center gap-2 text-slate-500 font-bold mb-2">
                  <FileText size={16} className="text-indigo-500" />
                  <span className="text-xs uppercase tracking-wider">Leave balance</span>
                </div>
                <div className="text-3xl font-black text-slate-800 tracking-tight">{getSisaCuti()} <span className="text-sm text-slate-400 font-medium tracking-normal">/ 12 Days</span></div>
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center opacity-50 pointer-events-none">
                  <FileText size={40} className="text-indigo-200" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 font-bold mb-2">
                  <AlertCircle size={16} className="text-emerald-500" />
                  <span className="text-xs uppercase tracking-wider">Sick</span>
                </div>
                <div className="text-3xl font-black text-slate-800 tracking-tight">{sakit} <span className="text-sm text-slate-400 font-medium tracking-normal">Days</span></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-slate-500 font-bold mb-2">
                  <AlertCircle size={16} className="text-amber-500" />
                  <span className="text-xs uppercase tracking-wider">Permissions</span>
                </div>
                <div className="text-3xl font-black text-slate-800 tracking-tight">{ijin} <span className="text-sm text-slate-400 font-medium tracking-normal">Days</span></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-indigo-200 shadow-lg">
                <div className="flex items-center gap-2 font-bold mb-2 text-indigo-100">
                  <Clock size={16} />
                  <span className="text-xs uppercase tracking-wider">Attendance</span>
                </div>
                <div className="text-3xl font-black tracking-tight">{attendancePct}%</div>
                <div className="text-xs text-indigo-200 mt-1 font-medium">Est. Annual Rate</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm lg:col-span-1 h-fit">
                <h3 className="text-base font-black text-slate-800 mb-6 flex items-center gap-2">
                  New Request
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Request Type</label>
                    <select 
                      value={type} 
                      onChange={(e) => setType(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all shadow-inner"
                    >
                      {requestOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {type === 'Other' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Specify Type</label>
                      <input 
                        type="text" 
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="E.g. Dispenisation"
                        className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Start Date</label>
                      <input 
                        type="date" 
                        value={reqStart}
                        onChange={(e) => setReqStart(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">End Date</label>
                      <input 
                        type="date" 
                        value={reqEnd}
                        onChange={(e) => setReqEnd(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1 px-1">
                      Reason <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[10px] text-slate-400 mb-2 px-1">Mandatory. Please briefly explain your request.</p>
                    <textarea 
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why you are requesting this..."
                      rows={4}
                      required
                      className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all shadow-inner resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm lg:col-span-2">
                <h3 className="text-base font-black text-slate-800 mb-6 flex items-center gap-2">
                  My History
                </h3>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <RefreshCw size={24} className="animate-spin text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-widest">Loading Records...</span>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                      <FileText size={24} className="text-slate-300" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">No requests found</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-colors gap-3">
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-xl border ${getStatusColor(req.status)} mt-0.5`}>
                            {getStatusIcon(req.status)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-800">{req.jenis}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {format(parseISO(req.start_date), 'MMM d, yyyy')}
                                {req.start_date !== req.end_date && ` - ${format(parseISO(req.end_date), 'MMM d, yyyy')}`}
                              </span>
                            </div>
                            <div className="mt-2 text-[11px]">
                              <span className="font-bold text-slate-700">Reason:</span>
                              <p className="text-slate-600 m-0 leading-relaxed max-w-lg">{req.alasan}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center sm:flex-col sm:items-end w-full sm:w-auto mt-2 sm:mt-0 gap-2 flex-shrink-0">
                           <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${getStatusColor(req.status)} w-full sm:w-auto text-center`}>
                             {req.status}
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {myTimeTab === 'request_calendar' && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <RefreshCw size={24} className="animate-spin text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-widest">Compiling Request Grid...</span>
              </div>
            ) : displayAgents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className="text-5xl mb-4 opacity-50">📭</div>
                <h3 className="text-lg font-bold text-slate-800">No requests in this view</h3>
                <p className="text-sm text-slate-500">There are no requests matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1 relative rounded-b-[2rem]">
                <table className="w-full text-left border-separate border-spacing-0 min-w-max relative max-h-[100%]">
                  <thead className="bg-[#6755f2] text-white">
                    <tr>
                      <th className="p-3 text-center text-[10px] w-12 min-w-[48px] max-w-[48px] uppercase tracking-wider font-bold sticky top-0 left-0 z-[40] bg-[#6755f2] border-b border-indigo-400/30">No</th>
                      <th className="p-3 text-left text-[10px] uppercase tracking-wider font-bold sticky top-0 left-[48px] z-[40] bg-[#6755f2] w-[80px] min-w-[80px] border-b border-indigo-400/30">NIK</th>
                      <th className="p-3 text-left text-[10px] uppercase tracking-wider font-bold sticky top-0 left-[128px] z-[40] bg-[#6755f2] w-[200px] min-w-[200px] border-b border-indigo-400/30">Agent Name</th>
                      {dates.map(date => {
                         const isHoliday = !!holidays[date];
                         const d = parseISO(date);
                         const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                         
                         return (
                           <th key={date} 
                             className={`p-2 text-center text-[10px] tracking-wider font-bold min-w-[75px] leading-tight sticky top-0 z-[30] border-b border-indigo-400/30 ${isHoliday ? 'bg-rose-500' : isWeekend ? 'bg-slate-500' : 'bg-[#6755f2]'}`}
                             title={isHoliday ? holidays[date] : undefined}
                           >
                             <div className="uppercase opacity-80 mb-0.5" style={{fontSize: '9px'}}>{format(d, 'EEE')}</div>
                             <div>{format(d, 'dd/MM')}</div>
                           </th>
                         );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {displayAgents.map((agent, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors group">
                         <td className="p-3 text-center text-[10px] font-bold text-black border-b border-slate-100 sticky left-0 z-[20] bg-white group-hover:bg-slate-50 transition-colors w-12 min-w-[48px] max-w-[48px]">
                           {i + 1}
                         </td>
                         <td className="p-3 border-b border-slate-100 sticky left-[48px] z-[20] bg-white group-hover:bg-slate-50 text-[10px] font-mono font-bold tracking-widest text-black transition-colors w-[80px] min-w-[80px]">
                           {agent.nik}
                         </td>
                         <td className="p-3 border-b border-slate-100 sticky left-[128px] z-[20] bg-white group-hover:bg-slate-50 font-bold text-xs text-black truncate w-[200px] min-w-[200px] transition-colors">
                           {agent.nama}
                         </td>
                         {dates.map(date => {
                           const req = agent.requests[date];
                           const isHoliday = !!holidays[date];
                           const d = parseISO(date);
                           const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                           return (
                             <td key={date} className={`p-1 border-b border-r border-slate-100/50 text-center relative group h-full align-middle ${isHoliday ? 'bg-rose-50' : isWeekend ? 'bg-slate-50' : ''}`}>
                               {req ? (
                                 <div 
                                   className={`w-full h-8 flex items-center justify-center rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 text-white ${(req.status?.toUpperCase()) === 'PENDING' ? 'opacity-50 border-dashed border-2' : ''}`}
                                   style={{ 
                                     backgroundColor: COLOR_MAP[req.jenis] || settings.shifts?.[req.jenis] || '#cbd5e1',
                                     borderColor: (req.status?.toUpperCase()) === 'PENDING' ? '#94a3b8' : 'transparent' 
                                   }}
                                   title={`[${req.status}] ${req.jenis} - ${req.alasan}`}
                                 >
                                   {req.jenis.substring(0,3).toUpperCase()}
                                 </div>
                               ) : (
                                  <div className="w-full h-8"></div>
                               )}
                             </td>
                           );
                         })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {masterKey && myTimeTab === 'request_list' && (
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in">
             <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600" />
                  All Agent Requests
                </h3>
             </div>
             
             {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw size={24} className="animate-spin text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-widest">Loading Requests...</span>
                </div>
             ) : listAgents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                  <div className="text-5xl mb-4 opacity-50">📭</div>
                  <h3 className="text-lg font-bold text-slate-800">No requests found</h3>
                  <p className="text-sm text-slate-500">There are no agent requests matching your filters.</p>
                </div>
             ) : (
                <div className="overflow-auto flex-1 p-2 pb-32">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-3">Agent</th>
                        <th className="p-3 min-w-[150px]">Date span</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {listAgents.map((req, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition-colors group">
                           <td className="p-3">
                             <div className="font-bold text-xs text-slate-800">{req.nama}</div>
                             <div className="text-[9px] text-slate-400 font-mono">{req.nik}</div>
                           </td>
                           <td className="p-3 whitespace-nowrap">
                             <div className="text-xs font-semibold text-slate-700">
                               {format(parseISO(req.start_date), 'dd MMM yyyy')}
                               {req.start_date !== req.end_date && ` - ${format(parseISO(req.end_date), 'dd MMM yyyy')}`}
                             </div>
                             <div className="text-[9px] text-slate-400">
                               {calculateDays(req.start_date, req.end_date)} Day(s) total
                             </div>
                           </td>
                           <td className="p-3 text-xs font-bold text-indigo-600">{req.jenis}</td>
                           <td className="p-3 text-xs text-slate-600 max-w-[200px] truncate" title={req.alasan}>{req.alasan}</td>
                           <td className="p-3 text-center">
                             <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${getStatusColor(req.status)}`}>
                               {req.status}
                             </span>
                           </td>
                           <td className="p-3 text-right space-x-2">
                             {(req.status?.toUpperCase()) === 'PENDING' ? (
                               <>
                                 <button onClick={() => handleStatusChange(req, 'APPROVED')} className="px-3 py-1.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white border border-emerald-200 rounded-lg transition-colors">Approve</button>
                                 <button onClick={() => handleStatusChange(req, 'REJECTED')} className="px-3 py-1.5 text-[10px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-200 rounded-lg transition-colors">Reject</button>
                               </>
                             ) : (
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2 group-hover:opacity-50 transition-opacity">Resolved</span>
                             )}
                           </td>
                         </tr>
                       ))}
                    </tbody>
                  </table>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
