import React, { useEffect, useState } from 'react';
import { useAppStore } from '../lib/store';
import { callSupabaseAPI } from '../lib/supabase';
import { format, addDays, parseISO } from 'date-fns';
import { FileUp, Trash2, Calendar } from 'lucide-react';
import { ImportScheduleModal } from './modals/ImportScheduleModal';
import { DeleteRangeModal } from './modals/DeleteRangeModal';

interface CalendarViewProps {
  channel: string;
  startDate: string;
  endDate: string;
  sortBy: string;
  filterTL: string;
  search: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ channel, startDate, endDate, sortBy, filterTL, search }) => {
  const { settings, user } = useAppStore();
  const [data, setData] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [changeModal, setChangeModal] = useState<{ row: any, date: string, shift: string } | null>(null);
  const [newShift, setNewShift] = useState('');
  const [newColor, setNewColor] = useState('#ffffff');
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [showImport, setShowImport] = useState(false);
  const [showDeleteRange, setShowDeleteRange] = useState(false);

  const roleConf = settings.roles[user?.role || 'Agent'] || { isAdmin: false, canEditSchedule: false };
  const canEdit = roleConf.isAdmin || roleConf.canEditSchedule || user?.role === 'Admin';
  const isWFM = roleConf.isAdmin || roleConf.canEditSchedule || user?.role === 'Admin';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [res, holRes, agentsRes] = await Promise.all([
          callSupabaseAPI('wfm_schedules', 'GET', undefined, `?channel=eq.${encodeURIComponent(channel)}&date=gte.${startDate}&date=lte.${endDate}&select=*`),
          callSupabaseAPI('wfm_holidays', 'GET', undefined, `?select=*`),
          callSupabaseAPI('wfm_agents', 'GET', undefined, `?channel=eq.${encodeURIComponent(channel)}&select=*`)
        ]);

        if (res) setData(res);
        else setData([]);

        if (agentsRes) setAgentsList(agentsRes);
        else setAgentsList([]);

        // Combine DB holidays with local settings holidays
        const holMap: Record<string, string> = { ...settings.holidays };
        if (holRes) {
          holRes.forEach((h: any) => {
            if (!holMap[h.date]) holMap[h.date] = h.description;
          });
        }
        setHolidays(holMap);
      } catch (err) {
        console.error(err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [channel, startDate, endDate, settings.holidays]);

  // Generate date columns
  const dates = [];
  let d = parseISO(startDate);
  const endD = parseISO(endDate);
  while (d <= endD) {
    dates.push(format(d, 'yyyy-MM-dd'));
    d = addDays(d, 1);
  }

  // Format data by agent
  const agentMap: Record<string, any> = {};
  
  // Build agent list from schedules found in the range
  data.forEach(row => {
    if (!agentMap[row.nik]) {
      // Find agent in agentsList to get the most accurate name/tl
      const agentInfo = agentsList.find(a => a.nik === row.nik);
      agentMap[row.nik] = { 
        nik: row.nik, 
        nama: agentInfo?.nama || row.nama || row.nik, 
        tl: agentInfo?.tl || row.tl || '', 
        shifts: {} 
      };
    }
    agentMap[row.nik].shifts[row.date] = {
      code: row.shift,
      bgColor: row.bg_color || '#ffffff'
    };
  });

  const agents = Object.values(agentMap)
    .filter(agent => {
      const matchesTL = !filterTL || agent.tl === filterTL;
      const matchesSearch = !search || 
        agent.nama?.toLowerCase().includes(search.toLowerCase()) || 
        agent.nik?.toLowerCase().includes(search.toLowerCase());
      return matchesTL && matchesSearch;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'nama') return (a.nama || '').localeCompare(b.nama || '');
      const firstDate = dates[0];
      const shiftCodeA = a.shifts[firstDate]?.code || 'OFF';
      const shiftCodeB = b.shifts[firstDate]?.code || 'OFF';
      const weightA = settings.shifts[shiftCodeA]?.w || 99;
      const weightB = settings.shifts[shiftCodeB]?.w || 99;
      return weightA - weightB || (a.nama || '').localeCompare(b.nama || '');
    });

  // Summary calculation per date
  const summary: Record<string, any> = {};
  dates.forEach(date => {
    summary[date] = { shifts: {}, off: 0, leave: 0, scheduled: 0, total: agents.length };
    Object.keys(settings.shifts).forEach(k => summary[date].shifts[k] = 0);
  });

  agents.forEach((agent: any) => {
    dates.forEach(date => {
      const shift = agent.shifts[date]?.code || '-';
      const sCode = shift.toUpperCase();
      if (sCode === 'OFF' || sCode === '-') {
        summary[date].off++;
      } else if (['CUTI', 'CUMIL', 'SK', 'PR', 'AL'].includes(sCode) || sCode.includes('REQ')) {
        summary[date].leave++;
      } else {
        if (summary[date].shifts[shift] !== undefined) summary[date].shifts[shift]++;
        summary[date].scheduled++;
      }
    });
  });

  const openChangeModal = (row: any, date: string, shift: string) => {
    if (!canEdit) return;
    setNewShift(shift === '-' ? 'OFF' : shift);
    setNewColor(row.shifts[date]?.bgColor || '#ffffff');
    setChangeModal({ row, date, shift });
  };

  const saveShiftChange = async () => {
    if (!changeModal) return;
    const { row, date } = changeModal;
    
    setData(prev => {
      const newData = [...prev];
      const existingRowIndex = newData.findIndex(r => r.nik === row.nik && r.date === date);
      if (existingRowIndex >= 0) {
        newData[existingRowIndex] = { ...newData[existingRowIndex], shift: newShift, bg_color: newColor };
      } else {
        newData.push({ date, nik: row.nik, nama: row.nama, tl: row.tl, channel, shift: newShift, bg_color: newColor });
      }
      return newData;
    });
    
    setChangeModal(null);

    try {
      const existing = await callSupabaseAPI('wfm_schedules', 'GET', undefined, `?date=eq.${date}&nik=eq.${row.nik}`);
      if (existing && existing.length > 0) {
        await callSupabaseAPI('wfm_schedules', 'PATCH', { shift: newShift, bg_color: newColor }, `?date=eq.${date}&nik=eq.${row.nik}`);
      } else {
        await callSupabaseAPI('wfm_schedules', 'POST', {
          date: date, nik: row.nik, nama: row.nama, tl: row.tl, channel: channel, shift: newShift, bg_color: newColor
        });
      }
    } catch (err) {
      console.error("Failed to update shift:", err);
    }
  };

  const isDateClosed = (dateStr: string) => {
    const d = parseISO(dateStr);
    const dow = d.getDay(); // 0 = Sun
    const biz = settings.bizRules || { weekendDays: [0, 6], holidayClosed: true };
    const isWeekend = biz.weekendDays.includes(dow);
    const isHoliday = !!holidays[dateStr];
    
    if (isHoliday && biz.holidayClosed) return true;
    if (isWeekend) return true;
    if (biz.operatingHours?.[channel]?.closed) return true;
    
    return false;
  };

  const GREEN_BG = ['#00ff00', '#b7e1cd', '#d9ead3', '#93c47d'];

  return (
    <div className="h-full flex flex-col relative">
      {/* View Header/Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border-b border-slate-200 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 flex-shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Schedule Calendar</h3>
            <p className="text-[10px] text-slate-500 font-medium tracking-tight">View and manage agent schedules across dates</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowImport(true)} 
              className="flex-1 sm:flex-none justify-center px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-100 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <FileUp size={14} />
              Import Schedule
            </button>
            <button 
              onClick={() => setShowDeleteRange(true)} 
              className="flex-1 sm:flex-none justify-center px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold cursor-pointer hover:bg-rose-100 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Trash2 size={14} />
              Delete Range
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto relative scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 font-bold">Loading...</div>
        ) : (
          <table className="border-separate border-spacing-0 table-fixed w-max">
            <thead>
              <tr className="h-[22px]">
                <th rowSpan={2} className="sticky top-0 left-0 z-[130] bg-slate-100 w-[30px] border-b-2 border-slate-300 text-[9px] text-slate-700 font-extrabold">NO</th>
                <th rowSpan={2} className="sticky top-0 left-[30px] z-[130] bg-slate-100 w-[65px] border-b-2 border-slate-300 text-[9px] text-slate-700 font-extrabold">NIK</th>
                <th rowSpan={2} className="sticky top-0 left-[95px] z-[130] bg-slate-100 w-[120px] border-b-2 border-slate-300 border-r-2 border-r-slate-300 text-[9px] text-slate-700 font-extrabold text-left pl-3">AGENT NAME</th>
                {dates.map(date => {
                  const dateObj = parseISO(date);
                  const isClosed = isDateClosed(date);
                  const isHolid = !!holidays[date];
                  const bizWeekend = (settings.bizRules?.weekendDays || [0, 6]).includes(dateObj.getDay());
                  
                  let styleDay = isHolid ? "bg-rose-100 text-rose-600 font-bold" 
                              : bizWeekend ? "bg-slate-200 text-slate-600 font-bold" 
                              : "bg-slate-50 text-slate-500 font-semibold";
                  
                  if (isClosed && !isHolid && !bizWeekend) styleDay = "bg-slate-300 text-slate-700 font-bold";

                  return (
                    <th key={date} className={`sticky top-0 z-[100] border-b border-slate-200 border-r border-slate-200 text-[9px] text-center h-[22px] min-w-[50px] relative ${styleDay}`}>
                      {format(dateObj, 'EEE').toUpperCase()}
                      {isClosed && <div className="absolute top-0 right-0 w-1 h-1 bg-rose-500 rounded-full m-0.5" title="Closed"></div>}
                    </th>
                  );
                })}
                <th rowSpan={2} className="sticky top-0 right-[195px] z-[130] bg-slate-100 w-[50px] border-b-2 border-slate-300 border-l-2 border-l-slate-300 text-[9px] text-amber-600 font-extrabold">LEAVE</th>
                <th rowSpan={2} className="sticky top-0 right-[150px] z-[130] bg-slate-100 w-[45px] border-b-2 border-slate-300 text-[9px] text-slate-600 font-extrabold">OFF</th>
                <th rowSpan={2} className="sticky top-0 right-[95px] z-[130] bg-slate-100 w-[55px] border-b-2 border-slate-300 text-[9px] text-emerald-600 font-extrabold">TBCCI</th>
                <th rowSpan={2} className="sticky top-0 right-[50px] z-[130] bg-slate-100 w-[45px] border-b-2 border-slate-300 text-[9px] text-indigo-600 font-extrabold">ST</th>
                <th rowSpan={2} className="sticky top-0 right-0 z-[130] bg-slate-100 w-[50px] border-b-2 border-slate-300 text-[9px] text-indigo-700 font-extrabold leading-tight">WORK<br/>DAYS</th>
              </tr>
              <tr className="h-[22px]">
                {dates.map(date => {
                  const dateObj = parseISO(date);
                  const isClosed = isDateClosed(date);
                  const isHolid = !!holidays[date];
                  const bizWeekend = (settings.bizRules?.weekendDays || [0, 6]).includes(dateObj.getDay());
                  
                  let styleDate = isHolid ? "bg-rose-100 text-rose-600 font-extrabold" 
                              : bizWeekend ? "bg-slate-200 text-slate-600 font-extrabold" 
                              : "bg-slate-50 text-slate-800 font-extrabold";
                  
                  if (isClosed && !isHolid && !bizWeekend) styleDate = "bg-slate-300 text-slate-900 font-extrabold";

                  return (
                    <th key={date} className={`sticky top-[22px] z-[100] border-b-2 border-slate-300 border-r border-slate-200 text-[11px] text-center h-[22px] ${styleDate}`} title={holidays[date] || (isClosed ? 'Closed' : '')}>
                      {format(dateObj, 'dd')}{isHolid ? ' 🚩' : ''}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent: any, idx) => {
                let cCuti = 0, cOff = 0, cTbcci = 0, cSt = 0, cWork = 0;
                
                return (
                  <tr key={agent.nik} className="hover:bg-slate-50 h-[26px]">
                    <td className="sticky left-0 z-[110] bg-white border-b border-slate-100 border-r border-slate-200 text-center text-[10px] text-slate-600 p-1">{idx + 1}</td>
                    <td className="sticky left-[30px] z-[110] bg-white border-b border-slate-100 border-r border-slate-200 text-center text-[10px] text-slate-600 p-1">{agent.nik}</td>
                    <td className="sticky left-[95px] z-[110] bg-white border-b border-slate-100 border-r-2 border-r-slate-300 text-left pl-3 text-[10px] text-slate-600 p-1 whitespace-nowrap overflow-hidden text-ellipsis">{agent.nama}</td>
                    {dates.map(date => {
                      const shiftObj = agent.shifts[date] || { code: '-', bgColor: '#ffffff' };
                      const shift = shiftObj.code;
                      const bgColor = shiftObj.bgColor;
                      const sCode = shift.toUpperCase();

                      if (sCode === 'OFF' || sCode.includes('REQ OFF')) cOff++;
                      else if (['CUTI', 'CUMIL', 'CT'].includes(sCode) || sCode.includes('REQ CUTI')) { cCuti++; cWork++; }
                      else if (sCode === 'TBCCI') cTbcci++;
                      else if (sCode === 'ST') cSt++;
                      else if (sCode !== '-' && !['SK', 'PR', 'AL', 'RESIGN'].includes(sCode)) cWork++;

                      const isHolid = !!holidays[date];
                      const isWeekend = parseISO(date).getDay() === 0 || parseISO(date).getDay() === 6;

                      let pubStatus = (settings.publishStatus?.[channel]?.[date]) || 'ALL';
                      let isVisible = isWFM || (pubStatus === 'ALL') || (user?.role === 'Leader' && pubStatus === 'LEADER');

                      let textStyle = "text-slate-900 font-bold";
                      let displayText = shift;
                      let emoticon = '';

                      if (!isVisible) {
                        displayText = '🔒';
                        textStyle = "text-slate-400 text-[14px]";
                      } else {
                        if (shift === '-') { displayText = ''; }
                        else if (shift === 'OFF') {
                          textStyle = "text-slate-900 font-medium";
                          if (GREEN_BG.includes(bgColor.toLowerCase())) emoticon = ' 😊';
                        }
                        else if (['SK', 'PR', 'AL', 'CUTI', 'CUMIL'].includes(shift)) {
                          textStyle = "text-slate-900 font-bold";
                          if (shift === 'CUTI' || shift === 'CUMIL') emoticon = ' 😍';
                        }
                      }

                      let cellBg = isVisible ? (bgColor !== '#ffffff' ? bgColor : (isHolid ? '#fff1f2' : (isWeekend ? '#f8fafc' : undefined))) : '#f1f5f9';

                      return (
                        <td 
                          key={date} 
                          className={`border-b border-slate-100 border-r border-slate-200 text-center text-[10px] p-1 ${textStyle} ${canEdit ? 'cursor-pointer hover:brightness-95' : ''}`} 
                          style={{ backgroundColor: cellBg }}
                          onClick={() => openChangeModal(agent, date, shift)}
                          onContextMenu={(e) => { e.preventDefault(); openChangeModal(agent, date, shift); }}
                        >
                          {displayText}{emoticon}
                        </td>
                      );
                    })}
                    <td className="sticky right-[195px] z-[110] bg-amber-50 border-b border-slate-100 text-center text-[10px] text-amber-700 font-bold p-1">{cCuti}</td>
                    <td className="sticky right-[150px] z-[110] bg-slate-50 border-b border-slate-100 text-center text-[10px] text-slate-600 font-bold p-1">{cOff}</td>
                    <td className="sticky right-[95px] z-[110] bg-emerald-50 border-b border-slate-100 text-center text-[10px] text-emerald-700 font-bold p-1">{cTbcci}</td>
                    <td className="sticky right-[50px] z-[110] bg-indigo-50 border-b border-slate-100 text-center text-[10px] text-indigo-700 font-bold p-1">{cSt}</td>
                    <td className="sticky right-0 z-[110] bg-indigo-100 border-b border-slate-100 text-center text-[10px] text-indigo-800 font-bold p-1">{cWork}</td>
                  </tr>
                );
              })}

              {/* Summary Rows */}
              <tr>
                <td colSpan={3} className="sticky left-0 z-[120] bg-slate-200 h-[4px] border-none"></td>
                {dates.map(d => {
                  const isHolid = !!holidays[d];
                  return <td key={d} className={`${isHolid ? 'bg-rose-200' : 'bg-slate-300'} h-[4px] border-none`}></td>
                })}
                <td colSpan={5} className="sticky right-0 z-[120] bg-slate-300 h-[4px] border-none"></td>
              </tr>

              {Object.keys(settings.shifts).sort((a, b) => (settings.shifts[a].w || 99) - (settings.shifts[b].w || 99)).map(shiftCode => (
                <tr key={shiftCode} className="h-[26px]">
                  <td colSpan={3} className="sticky left-0 z-[110] bg-slate-50 border-b border-slate-200 text-right pr-4 text-[10px] font-bold text-slate-700">Shift {shiftCode} ({settings.shifts[shiftCode].s} - {settings.shifts[shiftCode].e})</td>
                  {dates.map(date => {
                    const isHolid = !!holidays[date];
                    return <td key={date} className={`border-b border-slate-200 border-r border-slate-100 text-center text-[10px] font-bold text-slate-700 ${isHolid ? 'bg-rose-50' : 'bg-slate-50'}`}>{summary[date].shifts[shiftCode] || 0}</td>
                  })}
                  <td colSpan={5} className="sticky right-0 z-[110] bg-slate-50 border-b border-slate-200"></td>
                </tr>
              ))}

              <tr className="h-[26px]">
                <td colSpan={3} className="sticky left-0 z-[110] bg-slate-50 border-b border-slate-200 text-right pr-4 text-[10px] font-bold text-slate-500">Off</td>
                {dates.map(date => {
                  const isHolid = !!holidays[date];
                  return <td key={date} className={`border-b border-slate-200 border-r border-slate-100 text-center text-[10px] font-bold text-slate-500 ${isHolid ? 'bg-rose-50' : 'bg-slate-50'}`}>{summary[date].off}</td>
                })}
                <td colSpan={5} className="sticky right-0 z-[110] bg-slate-50 border-b border-slate-200"></td>
              </tr>

              <tr className="h-[26px]">
                <td colSpan={3} className="sticky left-0 z-[110] bg-amber-50 border-b border-amber-200 text-right pr-4 text-[10px] font-bold text-amber-600">Leave / Permit / Sick</td>
                {dates.map(date => {
                  const isHolid = !!holidays[date];
                  return <td key={date} className={`border-b border-amber-200 border-r border-amber-100 text-center text-[10px] font-bold text-amber-600 ${isHolid ? 'bg-rose-100' : 'bg-amber-50'}`}>{summary[date].leave}</td>
                })}
                <td colSpan={5} className="sticky right-0 z-[110] bg-amber-50 border-b border-amber-200"></td>
              </tr>

              <tr className="h-[26px]">
                <td colSpan={3} className="sticky left-0 z-[110] bg-emerald-50 border-b border-emerald-200 text-right pr-4 text-[10px] font-bold text-emerald-700">Scheduled Agent</td>
                {dates.map(date => {
                  const isHolid = !!holidays[date];
                  return <td key={date} className={`border-b border-emerald-200 border-r border-emerald-100 text-center text-[10px] font-extrabold text-emerald-700 ${isHolid ? 'bg-rose-100' : 'bg-emerald-50'}`}>{summary[date].scheduled}</td>
                })}
                <td colSpan={5} className="sticky right-0 z-[110] bg-emerald-50 border-b border-emerald-200"></td>
              </tr>

              <tr className="h-[26px]">
                <td colSpan={3} className="sticky left-0 z-[110] bg-slate-100 border-b border-slate-300 text-right pr-4 text-[10px] font-bold text-slate-800">Total Agent</td>
                {dates.map(date => {
                  const isHolid = !!holidays[date];
                  return <td key={date} className={`border-b border-slate-300 border-r border-slate-200 text-center text-[10px] font-extrabold text-slate-800 ${isHolid ? 'bg-rose-100' : 'bg-slate-100'}`}>{summary[date].total}</td>
                })}
                <td colSpan={5} className="sticky right-0 z-[110] bg-slate-100 border-b border-slate-300"></td>
              </tr>

              <tr className="h-[26px]">
                <td colSpan={3} className="sticky left-0 z-[110] bg-slate-50 border-b border-slate-200 text-right pr-4 text-[10px] font-bold text-slate-800">% On-Schedule Ratio</td>
                {dates.map(date => {
                  const isHolid = !!holidays[date];
                  const pct = summary[date].total > 0 ? Math.round((summary[date].scheduled / summary[date].total) * 100) : 0;
                  const color = pct >= 75 ? 'text-emerald-600' : 'text-rose-600';
                  return (
                    <td key={date} className={`border-b border-slate-200 border-r border-slate-100 text-center text-[10px] font-extrabold ${isHolid ? 'bg-rose-50' : 'bg-slate-50'} ${color}`}>{pct}%</td>
                  );
                })}
                <td colSpan={5} className="sticky right-0 z-[110] bg-slate-50 border-b border-slate-200"></td>
              </tr>

              {agents.length === 0 && (
                <tr>
                  <td colSpan={dates.length + 8} className="text-center p-10 text-slate-500 font-bold">No data available for this date range.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Change Shift Modal */}
      {changeModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
          <div className="bg-white p-6 rounded-2xl w-[340px] shadow-2xl">
            <h3 className="mt-0 text-slate-800 font-bold mb-4">✏️ Edit Schedule Manually</h3>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs mb-4 text-slate-600">
              <b>{changeModal.row.nama}</b><br/>📅 Date: {changeModal.date}
            </div>
            
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Select New Schedule:</label>
            <select 
              className="w-full p-2.5 border border-slate-300 rounded-xl mb-4 font-bold text-indigo-600 outline-none focus:border-indigo-500"
              value={newShift}
              onChange={e => setNewShift(e.target.value)}
            >
              {Object.keys(settings.shifts).map(k => (
                <option key={k} value={k}>Shift {k} ({settings.shifts[k].s} - {settings.shifts[k].e})</option>
              ))}
              <option value="OFF">OFF</option>
              <option value="Req OFF">Req OFF</option>
              <option value="CUTI">CUTI</option>
              <option value="Req Cuti">Req Cuti</option>
              <option value="CUMIL">CUMIL</option>
              <option value="SK">SK</option>
              <option value="PR">PR</option>
              <option value="AL">AL</option>
            </select>
            
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Cell Background Color:</label>
            <div className="flex gap-2 mb-6 items-center">
              <input 
                type="color" 
                className="w-11 h-10 p-0.5 border border-slate-300 rounded-lg cursor-pointer" 
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
              />
              <select 
                className="flex-1 p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
              >
                <option value="#ffffff">⚪ White</option>
                <option value="#00ff00">🟢 Green</option>
                <option value="#eeff00">🟡 Yellow</option>
                <option value="#fce5cd">🟠 Orange</option>
                <option value="#e64a43">🔴 Red</option>
                <option value="#c9daf8">🔵 Blue</option>
                <option value="#e29fe3">🟣 Pink</option>
              </select>
            </div>
            
            <div className="flex justify-end gap-2.5">
              <button className="flex-1 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200" onClick={() => setChangeModal(null)}>Cancel</button>
              <button className="flex-1 py-2.5 bg-indigo-600 text-white border-none font-bold rounded-xl hover:bg-indigo-700" onClick={saveShiftChange}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showImport && <ImportScheduleModal onClose={() => setShowImport(false)} />}
      {showDeleteRange && <DeleteRangeModal onClose={() => setShowDeleteRange(false)} channel={channel} />}
    </div>
  );
};
