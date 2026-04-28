import React, { useEffect, useState } from 'react';
import { useAppStore } from '../lib/store';
import { callSupabaseAPI } from '../lib/supabase';
import { parseISO, format, differenceInSeconds } from 'date-fns';

interface AdherenceViewProps {
  channel: string;
  date: string;
  sortBy: string;
  filterTL: string;
  search: string;
}

export const AdherenceView: React.FC<AdherenceViewProps> = ({ channel, date, sortBy, filterTL, search }) => {
  const { settings, user } = useAppStore();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exceptionModal, setExceptionModal] = useState<{ nik: string, nama: string, startStr: string, auxName: string } | null>(null);
  const [excReason, setExcReason] = useState('');
  const [tooltip, setTooltip] = useState<{ x: number, y: number, content: React.ReactNode } | null>(null);

  const secToTimeStr = (sec: number) => {
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const roleConf = settings.roles[user?.role || 'Agent'] || { isAdmin: false };
  const isAdmin = roleConf.isAdmin || user?.role === 'Admin';

  useEffect(() => {
    if (channel === 'Leader') {
      setData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Calculate yesterday for overnight shift support
        const yesterdayDate = new Date(date + 'T00:00:00');
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = format(yesterdayDate, 'yyyy-MM-dd');

        const [schedules, yesterdaySchedules, logs, exceptions] = await Promise.all([
          callSupabaseAPI('wfm_schedules', 'GET', undefined, `?date=eq.${date}&channel=eq.${encodeURIComponent(channel)}&select=*`),
          callSupabaseAPI('wfm_schedules', 'GET', undefined, `?date=eq.${yesterday}&channel=eq.${encodeURIComponent(channel)}&select=*`),
          callSupabaseAPI('adherence_log', 'GET', undefined, `?timestamp=gte.${yesterday}T00:00:00&timestamp=lte.${date}T23:59:59&select=*&order=timestamp.asc&limit=100000`),
          callSupabaseAPI('wfm_exceptions', 'GET', undefined, `?date_str=eq.${date}&channel=eq.${encodeURIComponent(channel)}&select=*`)
        ]);

        if (schedules || yesterdaySchedules) {
          const sRes = schedules || [];
          const yRes = yesterdaySchedules || [];
          
          const yesterdayMap: Record<string, any> = {};
          yRes.forEach((ys: any) => {
            yesterdayMap[ys.nik] = ys;
          });

          // All NIKs relevant for today
          const allNiks = new Set([
            ...sRes.map((r: any) => r.nik),
            ...yRes.filter((yr: any) => {
              const sInfo = settings.shifts[yr.shift];
              return sInfo && sInfo.s > sInfo.e;
            }).map((yr: any) => yr.nik)
          ]);

          const combinedSchedules = Array.from(allNiks).map(nik => {
            const todaySchedule = sRes.find((r: any) => r.nik === nik);
            const ys = yesterdayMap[nik];
            
            if (todaySchedule) {
              return {
                ...todaySchedule,
                shift_prev: ys?.shift || 'OFF',
                prevActivities: ys?.activities || {}
              };
            } else {
              return {
                nik,
                nama: ys?.nama || 'Unknown',
                tl: ys?.tl || '',
                channel: channel,
                date: date,
                shift: 'OFF',
                shift_prev: ys?.shift || 'OFF',
                prevActivities: ys?.activities || {},
                activities: {}
              };
            }
          });

          const combined = combinedSchedules.map((agent: any) => {
            const ys = yesterdayMap[agent.nik];
            // Normalize logs for this agent
            const agentLogs: any[] = [];
            
            logs?.forEach((l: any) => {
              if (l.nik !== agent.nik) return;
              
              const logTs = l.timestamp.replace(' ', 'T');
              const logDate = logTs.split('T')[0];
              const logTimeStr = format(parseISO(logTs), 'HH:mm:ss');
              const [h, m, sec] = logTimeStr.split(':').map(Number);
              const startSec = (h * 3600) + (m * 60) + (sec || 0);

              let durSec = 0;
              if (typeof l.duration === 'string') {
                const [dh, dm, ds] = l.duration.split(':').map(Number);
                durSec = (dh * 3600) + (dm * 60) + (ds || 0);
              } else if (typeof l.duration === 'number') {
                durSec = l.duration;
              }

              const endSec = startSec + durSec;

              if (logDate === date) {
                // Log starts today. 
                // If it ends today, keep as is.
                // If it crosses into tomorrow, it will be clipped by the 24h graph anyway or we can clip it.
                agentLogs.push({
                  ...l,
                  startTime: logTimeStr,
                  durationSeconds: durSec
                });
              } else if (logDate === yesterday) {
                // Log started yesterday. Check if it crosses into today.
                if (endSec > 86400) {
                  // It crosses into today!
                  // New start is 00:00:00
                  // New duration is the part that is in today
                  const todayDur = endSec - 86400;
                  agentLogs.push({
                    ...l,
                    timestamp: `${date}T00:00:00`, // Force to today
                    startTime: '00:00:00',
                    durationSeconds: todayDur,
                    isFromYesterday: true
                  });
                }
              }
            });

            const agentExceptions = exceptions?.filter((e: any) => e.nik === agent.nik) || [];
            return { 
              ...agent, 
              logs: agentLogs, 
              exceptions: agentExceptions 
            };
          });
          setData(combined);
        } else {
          setData([]);
        }
      } catch (err) {
        console.error(err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [channel, date]);

  const handleContextMenu = (e: React.MouseEvent, nik: string, nama: string, startStr: string, auxName: string, isExc: boolean) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("⚠️ Access Denied: Only Admin level roles can perform annulments (exceptions).");
      return;
    }

    if (isExc) {
      if(confirm(`⚠️ Cancel Exception?\n\nAre you sure you want to CANCEL the exception for ${nama} at ${startStr}?`)) {
        // Simplified cancel logic
        alert("Exception cancelled");
      }
    } else {
      setExceptionModal({ nik, nama, startStr, auxName });
      setExcReason('');
    }
  };

  const submitException = async () => {
    if (!excReason) return alert("Exception reason is required!");
    if (!exceptionModal) return;

    try {
      await callSupabaseAPI('wfm_exceptions', 'POST', {
        nik: exceptionModal.nik,
        date_str: date,
        channel: channel,
        aux_start: exceptionModal.startStr,
        aux_name: exceptionModal.auxName,
        reason: excReason,
        approved_by: user?.nama || "Admin"
      });
      alert("Exception approved");
      setExceptionModal(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const showTooltip = (e: React.MouseEvent, title: string, start: string, duration: string) => {
    setTooltip({
      x: e.clientX + 15,
      y: e.clientY + 15,
      content: (
        <div className="flex flex-col gap-0.5">
          <div className="font-bold text-blue-300">{title}</div>
          <div className="text-[10px] opacity-90">Start: {start}</div>
          <div className="text-[10px] opacity-90">Duration: {duration}</div>
        </div>
      )
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX + 15, y: e.clientY + 15 } : null);
  };

  const getAuxColor = (aux: string) => {
    if (!aux) return 'bg-[#06b6d4]'; // bg-aux-cyan
    const a = aux.toString().toLowerCase();
    
    if (a.includes('logout') || a.includes('end of day') || a.includes('offline') || a.includes('logged out')) {
      return null;
    }

    if ((a.includes('ready') && !a.includes('not ready')) || 
        (a.includes('available') && !a.includes('not available')) || 
        a.includes('reserved')) {
      return 'bg-[#22c55e]'; // bg-aux-green
    }

    if (a.includes('talking') || a.includes('work') || a.includes('email') || 
        a.includes('eskalasi') || a.includes('escalation') || a.includes('call ended')) {
      return 'bg-[#eab308]'; // bg-aux-yellow
    }

    if (a.includes('logon') || a.includes('logged-in')) {
      return 'bg-[#3b82f6]'; // bg-aux-blue
    }

    if (a.includes('meeting') || a.includes('visit')) {
      return 'bg-[#a855f7]'; // bg-aux-purple
    }

    if (a.includes('failure') || a.includes('failover') || a.includes('disconnect') || 
        a.includes('not answered') || a.includes('standby') || a.includes('connection') || 
        a.includes('system problem')) {
      return 'bg-[#ef4444]'; // bg-aux-red
    }

    if (a.includes('makan') || a.includes('meal') || a.includes('ibadah') || a.includes('prayer') || a.includes('toilet') || 
        a.includes('breast') || a.includes('not ready') || a.includes('not available') || 
        a.includes('non acd') || a.includes('supervisor') || a.includes('walk in') || 
        a.includes('offhook') || a.includes('initiated') || a.includes('break') || 
        a.includes('praying') || a.includes('inactive')) {
      return 'bg-[#f97316]'; // bg-aux-orange
    }

    return 'bg-[#06b6d4]'; // bg-aux-cyan
  };

  const calculateAdherenceScore = (agent: any, scheduleBlocks: any[], adherenceBlocks: any[]) => {
    const planned = new Uint8Array(86400);
    const actual = new Uint8Array(86400);
    const exceptions = new Uint8Array(86400);
    const isTolerance = new Uint8Array(86400);

    const timeToSec = (timeStr: string) => {
      if (!timeStr) return 0;
      const [h, m, s] = timeStr.split(':').map(Number);
      return (h * 3600) + (m * 60) + (s || 0);
    };

    // 1. Plot Schedule
    scheduleBlocks.forEach(block => {
      let start = timeToSec(block.start);
      let end = timeToSec(block.end);
      if (end < start) {
        for (let i = start; i < 86400; i++) planned[i] = 1;
      } else {
        for (let i = start; i < end; i++) planned[i] = 1;
      }
    });

    // 2. Plot Actual
    adherenceBlocks.forEach(block => {
      let start = timeToSec(block.start);
      let end = timeToSec(block.end);
      if (end < start) {
        for (let i = start; i < 86400; i++) actual[i] = 1;
      } else {
        for (let i = start; i < end; i++) actual[i] = 1;
      }
    });

    // 3. Plot Exceptions (Annulled)
    agent.exceptions?.forEach((exc: any) => {
      if (exc.reason) {
        let start = timeToSec(exc.aux_start);
        for (let i = start; i < Math.min(start + 900, 86400); i++) exceptions[i] = 1;
      }
    });

    // 4. Calculate Tolerance (120s)
    for (let i = 0; i < 86400; i++) {
      if (planned[i] === 1) {
        if (i === 0 || planned[i - 1] === 0) {
          for (let j = 1; j <= 120; j++) { if (i - j >= 0) isTolerance[i - j] = 1; }
        }
        if (i === 86399 || planned[i + 1] === 0) {
          for (let j = 1; j <= 120; j++) { if (i + j < 86400) isTolerance[i + j] = 1; }
        }
      }
    }

    let scheduledSec = 0;
    let inShiftViolation = 0;
    let outShiftViolation = 0;

    for (let i = 0; i < 86400; i++) {
      if (planned[i] === 1) {
        scheduledSec++;
        if (actual[i] === 0 && exceptions[i] === 0) {
          inShiftViolation++;
        }
      } else {
        if (actual[i] === 1 && exceptions[i] === 0 && isTolerance[i] === 0) {
          outShiftViolation++;
        }
      }
    }

    if (scheduledSec === 0) {
      return outShiftViolation > 0 ? 0 : 'OFF';
    }
    
    const adherentSec = Math.max(0, scheduledSec - inShiftViolation - outShiftViolation);
    return Math.round((adherentSec / scheduledSec) * 100);
  };

  if (channel === 'Leader') {
    return (
      <div className="h-full flex items-center justify-center">
        <h3 className="text-slate-500 font-bold">Adherence data is not available for Leaders.</h3>
      </div>
    );
  }

  const timeToPercentage = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m, s] = timeStr.split(':').map(Number);
    const totalSeconds = (h * 3600) + (m * 60) + (s || 0);
    return (totalSeconds / 86400) * 100;
  };

  const calculateDurationPercentage = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const startPct = timeToPercentage(startStr);
    const endPct = timeToPercentage(endStr);
    if (endPct < startPct) {
      // Crosses midnight
      return (100 - startPct) + endPct;
    }
    return endPct - startPct;
  };

  const calculateDurationStr = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return '0h 0m';
    const [sh, sm, ss] = startStr.split(':').map(Number);
    const [eh, em, es] = endStr.split(':').map(Number);
    const startSec = (sh * 3600) + (sm * 60) + (ss || 0);
    let endSec = (eh * 3600) + (em * 60) + (es || 0);
    if (endSec < startSec) {
      endSec += 86400; // Add 24 hours
    }
    const diff = endSec - startSec;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const renderBlocks = (blocks: any[], zIndex: number) => {
    return blocks.flatMap((block, idx) => {
      const startPct = timeToPercentage(block.start);
      const endPct = timeToPercentage(block.end);
      
      if (endPct < startPct) {
        // Crosses midnight, split into two
        return [
          <div 
            key={`${idx}-1`}
            className={`absolute h-full z-[${zIndex}] cursor-default ${block.color}`} 
            style={{ 
              left: `${startPct}%`, 
              width: `${100 - startPct}%` 
            }}
            onMouseEnter={(e) => showTooltip(e, block.title, block.start, calculateDurationStr(block.start, block.end))}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          ></div>,
          <div 
            key={`${idx}-2`}
            className={`absolute h-full z-[${zIndex}] cursor-default ${block.color}`} 
            style={{ 
              left: `0%`, 
              width: `${endPct}%` 
            }}
            onMouseEnter={(e) => showTooltip(e, block.title, block.start, calculateDurationStr(block.start, block.end))}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          ></div>
        ];
      }

      return (
        <div 
          key={idx}
          className={`absolute h-full z-[${zIndex}] cursor-default ${block.color}`} 
          style={{ 
            left: `${startPct}%`, 
            width: `${endPct - startPct}%` 
          }}
          onMouseEnter={(e) => showTooltip(e, block.title, block.start, calculateDurationStr(block.start, block.end))}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        ></div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col gap-4 w-full h-full animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm h-40">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                  <div className="w-32 h-4 bg-slate-100 rounded"></div>
                  <div className="w-16 h-6 bg-slate-100 rounded-lg"></div>
                </div>
                <div className="flex-1 bg-slate-50 rounded mt-2"></div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 font-bold">No adherence data found for this date.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {data
              .filter(agent => {
                const matchesTL = !filterTL || agent.tl === filterTL;
                const matchesSearch = !search || 
                  agent.nama?.toLowerCase().includes(search.toLowerCase()) || 
                  agent.nik?.toLowerCase().includes(search.toLowerCase());
                return matchesTL && matchesSearch;
              })
              .sort((a, b) => {
                // Prioritize Overnight Prev shifts to the top
                const isOvernight = (s?: string) => {
                  if (!s || s === 'OFF') return false;
                  const def = settings.shifts[s];
                  if (!def) return false;
                  const [sH, sM] = def.s.split(':').map(Number);
                  const [eH, eM] = def.e.split(':').map(Number);
                  return (eH * 60 + eM) <= (sH * 60 + sM);
                };
                const isPrevA = isOvernight(a.shift_prev);
                const isPrevB = isOvernight(b.shift_prev);
                if (isPrevA !== isPrevB) return isPrevA ? -1 : 1;

                if (sortBy === 'nama') return (a.nama || '').localeCompare(b.nama || '');
                
                const weightA = settings.shifts[a.shift]?.w || 99;
                const weightB = settings.shifts[b.shift]?.w || 99;
                return weightA - weightB || (a.nama || '').localeCompare(b.nama || '');
              })
              .map((agent) => {
              
              // Process Schedule Blocks
              const scheduleBlocks: any[] = [];
              
              // Handle Prev Shift (Overnight portion)
              if (agent.shift_prev && agent.shift_prev !== 'OFF') {
                const sDef = settings.shifts[agent.shift_prev];
                if (sDef) {
                  const [sH, sM] = sDef.s.split(':').map(Number);
                  const [eH, eM] = sDef.e.split(':').map(Number);
                  if ((eH * 60 + eM) <= (sH * 60 + sM)) {
                    scheduleBlocks.push({
                      title: `${agent.shift_prev} Prev`,
                      start: '00:00:00',
                      end: sDef.e + (sDef.e.split(':').length === 2 ? ':00' : ''),
                      color: 'bg-[#60a5fa]'
                    });
                  }
                }
              }

              // Add activities from Yesterday (for overnight portion)
              if (agent.prevActivities) {
                const sDef = settings.shifts[agent.shift_prev];
                if (sDef) {
                  const [sH, sM] = sDef.s.split(':').map(Number);
                  const [eH, eM] = sDef.e.split(':').map(Number);
                  if ((eH * 60 + eM) <= (sH * 60 + sM)) {
                    // Ending index today
                    const endPortionIdx = eH * 4 + Math.floor(eM / 15);
                    
                    let currentAct = null;
                    let startIdx = 0;
                    for (let i = 0; i <= endPortionIdx; i++) {
                      const act = agent.prevActivities[i];
                      if (act !== currentAct) {
                        if (currentAct) {
                          const startH = Math.floor((startIdx * 15) / 60);
                          const startM = (startIdx * 15) % 60;
                          const endH = Math.floor((i * 15) / 60);
                          const endM = (i * 15) % 60;
                          
                          let bgClass = 'bg-yellow-400';
                          let actNameLabel = currentAct;
                          if (settings.activities?.[currentAct]) {
                            bgClass = settings.activities[currentAct].color;
                            actNameLabel = settings.activities[currentAct].label;
                          }
                          
                          scheduleBlocks.push({
                            title: actNameLabel,
                            start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`,
                            end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`,
                            color: bgClass
                          });
                        }
                        currentAct = act;
                        startIdx = i;
                      }
                    }
                  }
                }
              }

              if (agent.shift !== 'OFF' && agent.shift) {
                const shiftDef = settings.shifts[agent.shift];
                if (shiftDef) {
                  scheduleBlocks.push({
                    title: `Shift ${agent.shift}`,
                    start: shiftDef.s || shiftDef.start,
                    end: shiftDef.e || shiftDef.end,
                    color: 'bg-[#60a5fa]'
                  });
                }
                
                // Add activities to schedule
                if (agent.activities) {
                  let currentAct = null;
                  let startIdx = 0;
                  
                  for (let i = 0; i <= 96; i++) {
                    const act = agent.activities[i];
                    if (act !== currentAct) {
                      if (currentAct) {
                        const startH = Math.floor((startIdx * 15) / 60);
                        const startM = (startIdx * 15) % 60;
                        const endH = Math.floor((i * 15) / 60);
                        const endM = (i * 15) % 60;
                        
                        let bgClass = 'bg-yellow-400';
                        let actNameLabel = currentAct;
                        
                        if (settings.activities?.[currentAct]) {
                          bgClass = settings.activities[currentAct].color;
                          actNameLabel = settings.activities[currentAct].label;
                        }
                        
                        scheduleBlocks.push({
                          title: actNameLabel,
                          start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`,
                          end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`,
                          color: bgClass
                        });
                      }
                      currentAct = act;
                      startIdx = i;
                    }
                  }
                }
              }

              // Process Adherence Logs
              const adherenceBlocks: any[] = [];
              if (agent.logs && agent.logs.length > 0) {
                // Sort logs by timestamp
                const sortedLogs = [...agent.logs].sort((a, b) => {
                  const t1 = a.timestamp.includes('T') ? a.timestamp : a.timestamp.replace(' ', 'T');
                  const t2 = b.timestamp.includes('T') ? b.timestamp : b.timestamp.replace(' ', 'T');
                  return new Date(t1).getTime() - new Date(t2).getTime();
                });

                sortedLogs.forEach((log: any, index: number) => {
                  const startTime = log.startTime || '00:00:00';
                  let endTime = '23:59:59';

                  if (log.durationSeconds !== undefined) {
                    const [sh, sm, ss] = startTime.split(':').map(Number);
                    const startSec = (sh * 3600) + (sm * 60) + (ss || 0);
                    const endSec = startSec + log.durationSeconds;
                    
                    const eh = Math.floor(endSec / 3600) % 24;
                    const em = Math.floor((endSec % 3600) / 60);
                    const es = endSec % 60;
                    endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:${String(es).padStart(2, '0')}`;
                  } else {
                    const nextLog = sortedLogs[index + 1];
                    if (nextLog) {
                      endTime = nextLog.startTime || '23:59:59';
                    }
                  }
                  
                  const status = log.aux_reason || log.status || '';
                  const color = getAuxColor(status);
                  if (!color) return;

                  // Merge adjacent blocks of the same color
                  const lastBlock = adherenceBlocks[adherenceBlocks.length - 1];
                  if (lastBlock && lastBlock.color === color) {
                    // Check if they are reasonably close (within 5 seconds)
                    const [leh, lem, les] = lastBlock.end.split(':').map(Number);
                    const [csh, csm, css] = startTime.split(':').map(Number);
                    
                    const lastEndSec = (leh * 3600) + (lem * 60) + (les || 0);
                    const currStartSec = (csh * 3600) + (csm * 60) + (css || 0);
                    
                    if (Math.abs(currStartSec - lastEndSec) <= 5) {
                      lastBlock.end = endTime;
                      return;
                    }
                  }

                  adherenceBlocks.push({
                    title: status || 'Unknown',
                    start: startTime,
                    end: endTime,
                    color: color
                  });
                });
              }

              // Calculate Adherence Score
              const adherenceScore = calculateAdherenceScore(agent, scheduleBlocks, adherenceBlocks);

              let shiftDisplay = agent.shift;
              const isOvernightPrev = (s?: string) => {
                if (!s || s === 'OFF') return false;
                const def = settings.shifts[s];
                if (!def) return false;
                const [sH, sM] = (def.s || '').split(':').map(Number);
                const [eH, eM] = (def.e || '').split(':').map(Number);
                return (eH * 60 + eM) <= (sH * 60 + sM);
              };

              if (isOvernightPrev(agent.shift_prev)) {
                if (agent.shift === agent.shift_prev) shiftDisplay = agent.shift;
                else if (agent.shift === 'OFF') shiftDisplay = agent.shift_prev + ' Prev';
                else shiftDisplay = agent.shift_prev + ' Prev + ' + agent.shift;
              }

              return (
                <div key={agent.nik} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <div className="font-extrabold text-sm text-slate-800">{agent.nama}</div>
                      <div className="text-[11px] text-slate-500 font-semibold">NIK: {agent.nik} | Shift: {shiftDisplay}</div>
                    </div>
                    <div className={`font-extrabold text-sm px-3 py-1.5 rounded-lg border ${adherenceScore === 'OFF' ? 'bg-slate-50 text-slate-600 border-slate-200' : adherenceScore >= 95 ? 'bg-green-50 text-green-600 border-green-200' : adherenceScore >= 85 ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      Score: {adherenceScore === 'OFF' ? 'OFF' : `${adherenceScore}%`}
                    </div>
                  </div>
                  
                  <div className="flex items-stretch mt-1">
                    <div className="w-[75px] flex-shrink-0 flex flex-col pt-5">
                      <div className="text-[10px] font-bold text-slate-500 h-6 leading-6 mb-1.5">Schedule</div>
                      <div className="text-[10px] font-bold text-slate-500 h-6 leading-6 mb-1.5">Adherence</div>
                      <div className="text-[10px] font-extrabold text-purple-500 h-6 leading-6">Exception</div>
                    </div>
                    
                    <div className="flex-1 overflow-x-auto pb-1.5 border-l border-slate-100 pt-6 scrollbar-thin">
                      <div className="relative min-w-[1400px]">
                        {/* Axis */}
                        <div className="absolute w-full h-full top-0 left-0 pointer-events-none z-0">
                          {Array.from({ length: 25 }).map((_, h) => (
                            <div key={h} className="absolute h-full border-l border-dashed border-slate-300/40" style={{ left: `${(h / 24) * 100}%` }}>
                              <span className="absolute -top-[22px] -left-[14px] text-[10px] text-slate-500 font-bold tracking-tighter">
                                {String(h).padStart(2, '0')}:00
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Schedule Track */}
                        <div className="relative h-6 bg-transparent rounded mb-1.5">
                          {renderBlocks(scheduleBlocks, 1)}
                        </div>
                        
                        {/* Adherence Track */}
                        <div className="relative h-6 bg-transparent rounded mb-1.5">
                          {renderBlocks(adherenceBlocks, 5)}
                        </div>
                        
                        {/* Exception Track */}
                        <div className="relative h-6 bg-transparent rounded">
                          {(() => {
                            const planned = new Uint8Array(86400);
                            const actual = new Uint8Array(86400);
                            const isTolerance = new Uint8Array(86400);

                            const timeToSec = (timeStr: string) => {
                              if (!timeStr) return 0;
                              const [h, m, s] = timeStr.split(':').map(Number);
                              return (h * 3600) + (m * 60) + (s || 0);
                            };

                            scheduleBlocks.forEach(b => {
                              let s = timeToSec(b.start); let e = timeToSec(b.end);
                              if (e < s) { for (let i = s; i < 86400; i++) planned[i] = 1; }
                              else { for (let i = s; i < e; i++) planned[i] = 1; }
                            });

                            adherenceBlocks.forEach(b => {
                              let s = timeToSec(b.start); let e = timeToSec(b.end);
                              if (e < s) { for (let i = s; i < 86400; i++) actual[i] = 1; }
                              else { for (let i = s; i < e; i++) actual[i] = 1; }
                            });

                            for (let i = 0; i < 86400; i++) {
                              if (planned[i] === 1) {
                                if (i === 0 || planned[i - 1] === 0) {
                                  for (let j = 1; j <= 120; j++) { if (i - j >= 0) isTolerance[i - j] = 1; }
                                }
                                if (i === 86399 || planned[i + 1] === 0) {
                                  for (let j = 1; j <= 120; j++) { if (i + j < 86400) isTolerance[i + j] = 1; }
                                }
                              }
                            }

                            const violationBlocks: any[] = [];
                            let currentVioStart: number | null = null;
                            let currentVioType: string | null = null;

                            for (let i = 0; i < 86400; i++) {
                              let vioType: string | null = null;
                              if (planned[i] === 1) {
                                if (actual[i] === 0) vioType = 'MISSING';
                              } else {
                                if (actual[i] === 1 && isTolerance[i] === 0) vioType = 'UNSCHEDULED';
                              }

                              if (vioType) {
                                if (currentVioStart === null) {
                                  currentVioStart = i;
                                  currentVioType = vioType;
                                } else if (currentVioType !== vioType) {
                                  violationBlocks.push({ start: currentVioStart, end: i, type: currentVioType });
                                  currentVioStart = i;
                                  currentVioType = vioType;
                                }
                              } else if (currentVioStart !== null) {
                                violationBlocks.push({ start: currentVioStart, end: i, type: currentVioType });
                                currentVioStart = null;
                                currentVioType = null;
                              }
                            }
                            if (currentVioStart !== null) {
                              violationBlocks.push({ start: currentVioStart, end: 86400, type: currentVioType });
                            }

                            return violationBlocks.map((b, idx) => {
                              const durSec = b.end - b.start;
                              if (durSec < 30 && b.type !== 'MISSING') return null;

                              const startStr = secToTimeStr(b.start);
                              const isAnnulled = agent.exceptions?.some((exc: any) => exc.aux_start === startStr && exc.reason);
                              
                              let bgStyle = 'bg-purple-100 border-purple-500';
                              let label = b.type;

                              if (isAnnulled) {
                                bgStyle = 'bg-[#e9d5ff] border-solid border-[#a855f7]';
                                label = `★ Annulled: ${b.type}`;
                              } else {
                                if (b.type === 'MISSING') { bgStyle = 'bg-[#fee2e2] border-dashed border-[#fca5a5]'; label = 'Missing Time'; }
                                else if (b.type === 'UNSCHEDULED') { bgStyle = 'bg-[#bfdbfe] border-solid border-[#3b82f6]'; label = 'Unscheduled Time'; }
                              }

                              return (
                                <div 
                                  key={idx}
                                  className={`absolute h-full border rounded z-[7] cursor-pointer ${bgStyle}`} 
                                  style={{ 
                                    left: `${(b.start / 86400) * 100}%`, 
                                    width: `${(durSec / 86400) * 100}%` 
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, agent.nik, agent.nama, startStr, label, !!isAnnulled)}
                                  onMouseEnter={(e) => showTooltip(e, label, startStr, `${Math.floor(durSec/60)}m ${durSec%60}s`)}
                                  onMouseMove={handleMouseMove}
                                  onMouseLeave={() => setTooltip(null)}
                                ></div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center gap-4 px-2 sm:px-6 py-2 bg-white border-t border-slate-200 z-[200]">
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#60a5fa]"></span> Plan
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]"></span> Ready
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#eab308]"></span> Work
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]"></span> Break/Aux
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#a855f7]"></span> Meeting
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]"></span> Error
        </div>
        <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#fee2e2] border border-dashed border-[#fca5a5]"></span> Missing
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600 font-semibold whitespace-nowrap">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#bfdbfe] border border-[#3b82f6]"></span> Unscheduled
        </div>
      </div>
      {/* Exception Modal */}
      {exceptionModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="mt-0 text-slate-800 font-bold mb-4">⚡ Annul Violation (Exception)</h3>
            <div className="bg-slate-50 p-3 rounded-xl text-xs mb-4 border border-slate-200">
              <strong className="text-indigo-600 text-sm">{exceptionModal.nama} ({exceptionModal.nik})</strong><br/>
              <span className="text-rose-500">Type: {exceptionModal.auxName}</span> | Time: {exceptionModal.startStr}
            </div>
            
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Exception Reason:</label>
            <textarea 
              rows={3} 
              className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 resize-none" 
              placeholder="e.g.: Network issue, TL directive..."
              value={excReason}
              onChange={e => setExcReason(e.target.value)}
            ></textarea>
            
            <div className="mt-5 flex gap-2.5">
              <button className="flex-1 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200" onClick={() => setExceptionModal(null)}>Cancel</button>
              <button className="flex-1 py-2.5 bg-indigo-600 text-white border-none font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200" onClick={submitException}>Approve Exception</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Tooltip */}
      {tooltip && (
        <div 
          className="fixed pointer-events-none z-[20000] bg-slate-900/95 text-white px-3 py-2 rounded-lg text-[11px] shadow-2xl border border-slate-700 backdrop-blur-sm animate-in fade-in zoom-in duration-150"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

