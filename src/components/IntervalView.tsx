import React, { useEffect, useState, useRef } from 'react';
import { Logo } from './Logo';
import { useAppStore } from '../lib/store';
import { callSupabaseAPI } from '../lib/supabase';
import { 
  Utensils, 
  RefreshCw, 
  Trash2, 
  Users, 
  ChevronRight, 
  ChevronLeft,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MoreHorizontal
} from 'lucide-react';

interface IntervalViewProps {
  channel: string;
  date: string;
  sortBy: string;
  filterTL: string;
  search: string;
}

const SkeletonRow = () => (
  <tr className="animate-pulse h-[22px]">
    <td className="sticky left-0 bg-slate-50 border-b border-slate-100 z-[50]" colSpan={5}></td>
    {Array.from({ length: 96 }).map((_, i) => (
      <td key={i} className="bg-slate-50/50 border-b border-slate-100 min-w-[18px]"></td>
    ))}
  </tr>
);

export const IntervalView: React.FC<IntervalViewProps> = ({ channel, date, sortBy, filterTL, search }) => {
  const { settings, user } = useAppStore();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'cell' | 'agent', row: any, colIdx?: number } | null>(null);
  const [reasonModal, setReasonModal] = useState<{ row: any, colIdx: number, type: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonDuration, setReasonDuration] = useState('1');
  const [customDuration, setCustomDuration] = useState('');
  const [agentModal, setAgentModal] = useState<{ type: 'ADD' | 'UPDATE' | 'MOVE' | 'REMOVE', row?: any } | null>(null);
  const [agentForm, setAgentForm] = useState({ nik: '', nama: '', channel: 'Call', tl: '', date: date });
  const [leaders, setLeaders] = useState<string[]>([]);
  const [showBreakManager, setShowBreakManager] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [reqs, setReqs] = useState<number[]>(Array(96).fill(0));
  const [demographics, setDemographics] = useState<Record<string, any>>({});
  const [reasons, setReasons] = useState<any[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, content: React.ReactNode } | null>(null);

  const isBreakCode = React.useCallback((v: string | unknown) => {
    if (typeof v !== 'string') return false;
    return settings.activities?.[v]?.category === 'break' || v === 'LB' || v === 'SB';
  }, [settings.activities]);

  const indexToTime = (idx: number) => {
    const total = idx * 15;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const isTimeOperational = (idx: number) => {
    const d = new Date(`${date}T${indexToTime(idx)}:00Z`);
    const dateStr = date;
    const dow = d.getUTCDay();
    
    const biz = settings.bizRules || { weekendDays: [0, 6], holidayClosed: true, operatingHours: {} };
    const isWeekend = biz.weekendDays.includes(dow);
    const isHoliday = !!settings.holidays[dateStr];
    
    if (isHoliday && biz.holidayClosed) return false;
    if (isWeekend) return false;
    if (biz.operatingHours?.[channel]?.closed) return false;
    
    const chanRules = biz.operatingHours?.[channel];
    if (!chanRules) return true;
    
    const timeStr = indexToTime(idx);
    return timeStr >= chanRules.start && timeStr <= chanRules.end;
  };

  const processedRows = React.useMemo(() => {
    const rows: any[] = [];
    data.forEach(r => {
      // Add S4 Prev row if applicable
      if (r.shift_prev === 'S4') {
        rows.push({ ...r, isPrev: true, sortW: 0 });
      }
      // Add regular row
      const weight = settings.shifts[r.shift]?.w || 99;
      rows.push({ ...r, isPrev: false, sortW: weight });
    });
    return rows;
  }, [data, settings.shifts]);

  const filteredData = React.useMemo(() => {
    return processedRows
      .filter(row => {
        const matchesTL = !filterTL || row.tl === filterTL;
        const matchesSearch = !search || 
          (row.nama || '').toLowerCase().includes(search.toLowerCase()) || 
          (row.nik || '').toLowerCase().includes(search.toLowerCase());
        return matchesTL && matchesSearch;
      })
      .sort((a, b) => {
        // Always prioritize S4 Prev (isPrev) to the very top
        if (a.isPrev !== b.isPrev) return a.isPrev ? -1 : 1;
        
        if (sortBy === 'nama') return (a.nama || '').localeCompare(b.nama || '');
        return (a.sortW || 99) - (b.sortW || 99) || (a.nama || '').localeCompare(b.nama || '');
      });
  }, [processedRows, filterTL, sortBy, search]);

  const roleConf = settings.roles[user?.role || 'Agent'] || { isAdmin: false, canEditSchedule: false, allowedActivities: [] };
  const canEdit = roleConf.isAdmin || roleConf.canEditSchedule || user?.role === 'Admin';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [res, demoRes, reqRes, reasonsRes, forRes] = await Promise.all([
          callSupabaseAPI('wfm_schedules', 'GET', undefined, `?date=eq.${date}&channel=eq.${encodeURIComponent(channel)}&select=*`),
          callSupabaseAPI('wfm_agents', 'GET', undefined, `?select=nik,religion,gender`),
          callSupabaseAPI('wfm_requirements', 'GET', undefined, `?date=eq.${date}&channel=eq.${encodeURIComponent(channel)}&select=requirements`).catch(() => null),
          callSupabaseAPI('wfm_activity_reasons', 'GET', undefined, `?date_str=eq.${date}&select=*`).catch(() => null),
          callSupabaseAPI('wfm_traffic_forecast', 'GET', undefined, `?channel=eq.${channel}&timestamp=gte.${date}T00:00:00Z&timestamp=lte.${date}T23:59:59Z&type=eq.interval_agents&select=timestamp,volume`).catch(() => null)
        ]);

        if (res) {
          setData(res);
          // Derived leaders from schedule
          const scheduleLeaders = Array.from(new Set(res.map((r: any) => r.tl).filter(Boolean))).sort() as string[];
          setLeaders(scheduleLeaders);
        } else {
          setData([]);
          setLeaders([]);
        }

        if (demoRes) {
          const demoMap: Record<string, any> = {};
          demoRes.forEach((d: any) => {
            demoMap[d.nik] = { religion: d.religion, gender: d.gender };
          });
          setDemographics(demoMap);
        }

        if (reqRes && reqRes[0]?.requirements) {
          setReqs(reqRes[0].requirements);
        } else if (forRes && forRes.length > 0) {
          const fReqs = Array(96).fill(0);
          forRes.forEach((item: any) => {
            const dt = new Date(item.timestamp);
            const hour = dt.getUTCHours();
            const min = dt.getUTCMinutes();
            const idx = hour * 4 + Math.floor(min / 15);
            if (idx >= 0 && idx < 96) fReqs[idx] = item.volume || 0;
          });
          setReqs(fReqs);
        } else {
          setReqs(Array(96).fill(0));
        }

        if (reasonsRes) {
          setReasons(reasonsRes);
        } else {
          setReasons([]);
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

  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, type: 'cell' | 'agent', row: any, colIdx?: number) => {
    if (!canEdit && type === 'agent') return; // Only editors can edit agents
    e.preventDefault();
    e.stopPropagation();
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Menu dimensions (approximate)
    const menuWidth = 200;
    const menuHeight = type === 'cell' ? 450 : 250;
    
    // Adjust if menu goes off screen
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
    
    // Ensure it doesn't go off the top/left
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    setContextMenu({ x, y, type, row, colIdx });
  };

  const handleAction = async (actionCode: string) => {
    if (!contextMenu || contextMenu.type !== 'cell') return;
    const { row, colIdx } = contextMenu;
    const nik = row.nik;
    const startIdx = colIdx!;
    
    setContextMenu(null);

    let left = startIdx;
    let right = startIdx;

    if (actionCode === 'REMOVE') {
      const currentAct = row.activities?.[startIdx];
      if (!currentAct) return;
      while (left > 0 && row.activities?.[left - 1] === currentAct) left--;
      while (right < 95 && row.activities?.[right + 1] === currentAct) right++;
    } else {
      let span = 4; // 1 hour default
      const configuredDuration = settings.activities?.[actionCode]?.duration;
      if (configuredDuration && configuredDuration !== 'custom' && configuredDuration !== 'full') {
        span = parseInt(configuredDuration) || 4;
      }
      right = left + span - 1;
    }

    const newActivities = { ...row.activities };
    if (actionCode === 'REMOVE') {
      for (let i = left; i <= right; i++) delete newActivities[i];
    } else {
      for (let i = left; i <= right; i++) newActivities[i] = actionCode;
    }

    setData(prev => prev.map(r => r.nik === nik ? { ...r, activities: newActivities } : r));

    try {
      await callSupabaseAPI('wfm_schedules', 'PATCH', { activities: newActivities }, `?date=eq.${date}&nik=eq.${nik}`);
      if (actionCode === 'REMOVE') {
        await callSupabaseAPI('wfm_activity_reasons', 'DELETE', undefined, `?date_str=eq.${date}&nik=eq.${nik}&interval_idx=gte.${left}&interval_idx=lte.${right}`);
      }
    } catch (err) {
      console.error("Failed to sync to DB:", err);
      alert("Failed to sync to DB");
    }
  };

  const handleMouseEnter = React.useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    if (contextMenu || !content) return;
    setTooltip({ x: e.clientX + 15, y: e.clientY + 15, content });
  }, [contextMenu]);

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX + 15, y: e.clientY + 15 } : null);
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    setTooltip(null);
  }, []);

  const saveReasonActivity = async () => {
    if (!reasonModal) return;
    const { row, colIdx, type } = reasonModal;
    const nik = row.nik;
    
    let duration = parseInt(reasonDuration);
    if (reasonDuration === 'full') duration = 96; // Simplified
    else if (reasonDuration === 'custom') duration = Math.ceil(parseInt(customDuration) / 15) || 1;

    const newActivities = { ...row.activities };
    for (let i = colIdx; i < colIdx + duration && i < 96; i++) {
      newActivities[i] = type;
    }

    setData(prev => prev.map(r => r.nik === nik ? { ...r, activities: newActivities } : r));
    setReasonModal(null);

    try {
      await callSupabaseAPI('wfm_schedules', 'PATCH', { activities: newActivities }, `?date=eq.${date}&nik=eq.${nik}`);
      await callSupabaseAPI('wfm_activity_reasons', 'POST', {
        date_str: date, nik: nik, interval_idx: colIdx,
        activity_code: type, reason: reasonText, count: duration
      });

      // Notify
      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: 'Activity Added',
          message: `Reason for "${type}" added for ${row.nama}`,
          type: 'info',
          category: 'activity',
          targetNik: nik
        }
      }));
    } catch (err) {
      console.error("Failed to save reason:", err);
    }
  };

  const saveAgentAction = async () => {
    if (!agentModal) return;
    const { type, row } = agentModal;
    
    try {
      if (type === 'ADD') {
        if (!agentForm.nik || !agentForm.nama || !agentForm.tl) return alert("Fill required fields");
        // Add to Users
        await callSupabaseAPI('wfm_agents', 'POST', {
          nik: agentForm.nik, nama: agentForm.nama, username: agentForm.nik, password: agentForm.nik,
          role: 'Agent', channel: agentForm.channel, status: 'NEW'
        });
        // Add to Schedules
        await callSupabaseAPI('wfm_schedules', 'POST', {
          date: date, nik: agentForm.nik, nama: agentForm.nama, tl: agentForm.tl, channel: agentForm.channel, shift: 'OFF'
        });
        alert("Agent added successfully");
      } else if (type === 'UPDATE') {
        if (!agentForm.tl) return alert("Select TL");
        await callSupabaseAPI('wfm_schedules', 'PATCH', { tl: agentForm.tl }, `?nik=eq.${row.nik}`);
        alert("Agent updated successfully");
      } else if (type === 'MOVE') {
        // Simplified move logic
        await callSupabaseAPI('wfm_agents', 'PATCH', { channel: agentForm.channel }, `?nik=eq.${row.nik}`);
        await callSupabaseAPI('wfm_schedules', 'PATCH', { channel: agentForm.channel }, `?nik=eq.${row.nik}&date=gte.${agentForm.date}`);
        alert("Agent moved successfully");
      } else if (type === 'REMOVE') {
        await callSupabaseAPI('wfm_agents', 'PATCH', { status: 'INACTIVE' }, `?nik=eq.${row.nik}`);
        await callSupabaseAPI('wfm_schedules', 'PATCH', { shift: 'OFF' }, `?nik=eq.${row.nik}&date=gte.${agentForm.date}`);
        alert("Agent removed successfully");
      }
      
      setAgentModal(null);
      // Refresh data
      const res = await callSupabaseAPI('wfm_schedules', 'GET', undefined, `?date=eq.${date}&channel=eq.${encodeURIComponent(channel)}&select=*`);
      setData(res || []);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const calculateGap = (req: number[], acts: any, idx: number) => {
    let gap = 0;
    for (let i = idx - 1; i >= 0; i--) {
      if (acts[i]) break;
      if (req[i] > 0) gap += req[i];
    }
    for (let i = idx + 1; i < req.length; i++) {
      if (acts[i]) break;
      if (req[i] > 0) gap += req[i];
    }
    return gap;
  };

  const findBestDistributedBreakIdx = (req: number[], acts: any, rules: string[], breakCounter: Record<number, number>) => {
    if (!rules || rules.length === 0) return null;

    let bestIdx: number | null = null;
    let bestScore = -Infinity;

    rules.forEach(ruleTime => {
      const [h, m] = ruleTime.split(':').map(Number);
      const idx = h * 4 + Math.floor(m / 15);
      
      if (idx < 0 || idx >= 96) return;
      if (acts[idx]) return;
      if (req[idx] < -5) return;

      const gap = calculateGap(req, acts, idx);
      const distPenalty = (breakCounter[idx] || 0) * 2; // BREAK_PENALTY = 2

      const score = gap - distPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx === null) {
      let maxGap = -Infinity;
      let fallbackIdx: number | null = null;
      rules.forEach(ruleTime => {
        const [h, m] = ruleTime.split(':').map(Number);
        const idx = h * 4 + Math.floor(m / 15);
        if (idx < 0 || idx >= 96) return;
        if (acts[idx]) return;

        const gap = calculateGap(req, acts, idx);
        if (gap > maxGap) {
          maxGap = gap;
          fallbackIdx = idx;
        }
      });
      return fallbackIdx;
    }
    return bestIdx;
  };

  const showStatus = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleAutoBreak = React.useCallback(async (isReAuto = false) => {
    if (!canEdit) {
      showStatus("❌ You do not have permission to edit the schedule.");
      return;
    }
    
    if (data.length === 0) {
      showStatus("⚠️ No agent data to process.");
      return;
    }
    
    console.log("Starting Auto Break, isReAuto:", isReAuto);
    setLoading(true);
    const newData = JSON.parse(JSON.stringify(data)); // Deep clone to be safe
    const updates = [];

    const isFriday = new Date(date).getDay() === 5;
    const isRamadanMonth = settings.puasa.some((p: any) => {
      const d = new Date(date);
      d.setHours(0,0,0,0);
      const start = new Date(p.start);
      const end = new Date(p.end);
      return d >= start && d <= end;
    });

    // Build break counter
    const breakCounter: Record<number, number> = {};
    newData.forEach((r: any) => {
      const activities = { ...(r.activities || {}) };
      if (isReAuto) {
        Object.keys(activities).forEach(idx => {
          if (isBreakCode(activities[idx])) delete activities[idx];
        });
        r.activities = activities;
      }
      Object.entries(r.activities || {}).forEach(([idx, v]) => {
        if (isBreakCode(v)) {
          const i = Number(idx);
          breakCounter[i] = (breakCounter[i] || 0) + 1;
        }
      });
    });

    try {
      const { url, key } = await import('../lib/supabase').then(m => m.getDbCredentials());
      if (!url || !key) throw new Error("Database API is not configured in System Settings.");
      
      for (let r of newData) {
        const activities = { ...(r.activities || {}) };
        let changed = false;

        // 1. Handle S4 Prev (00:00 - 07:00)
        if (r.shift_prev === 'S4') {
          const hasPrevBreak = Object.entries(activities).some(([idx, v]) => Number(idx) < 28 && isBreakCode(v));
          if (isReAuto || !hasPrevBreak) {
            const rules = (settings.autoBreak['S4'] || []).filter(t => {
              const h = parseInt(t.split(':')[0]);
              return h < 7;
            });
            const bIdx = findBestDistributedBreakIdx(reqs, activities, rules, breakCounter);
            if (bIdx !== null) {
              for (let i = bIdx; i < bIdx + 4; i++) if (i < 28) activities[i] = 'LB';
              changed = true;
              breakCounter[bIdx] = (breakCounter[bIdx] || 0) + 1;
            }
          }
        }

        // 2. Handle Current Shift (excluding S4 start part)
        if (r.shift !== 'OFF' && r.shift !== 'S4' && settings.shifts[r.shift]) {
          const hasCurrentBreak = Object.entries(activities).some(([idx, v]) => Number(idx) >= 28 && isBreakCode(v));
          if (isReAuto || !hasCurrentBreak) {
            const demo = demographics[r.nik] || {};
            const rel = (demo.religion || '').toUpperCase();
            const gen = (demo.gender || '').toUpperCase();
            const isMuslimMale = rel === 'ISLAM' && (['L', 'LAKI-LAKI', 'MALE', 'PRIA'].includes(gen));

            let breakIdx: number | null = null;
            let span = 4;

            if (isFriday && isMuslimMale && ['S1', 'S2', 'H'].includes(r.shift)) {
              breakIdx = isRamadanMonth ? 48 : 46; 
              span = isRamadanMonth ? 4 : 6;
            } else {
              const rules = settings.autoBreak[r.shift] || [];
              if (rules.length === 0) {
                const shift = settings.shifts[r.shift];
                const parseTime = (t: string) => {
                  const [h, m] = t.split(':').map(Number);
                  return h * 4 + Math.floor(m / 15);
                };
                const startIdx = parseTime(shift.s);
                let endIdx = parseTime(shift.e);
                if (endIdx <= startIdx) endIdx += 96;
                const mid = Math.floor((startIdx + endIdx) / 2);
                breakIdx = mid - 2;
              } else {
                breakIdx = findBestDistributedBreakIdx(reqs, activities, rules, breakCounter);
              }
              span = (isRamadanMonth && (r.shift === 'S2' || r.shift === 'H')) ? 2 : 4;
            }

            if (breakIdx !== null) {
              for (let i = breakIdx; i < breakIdx + span; i++) {
                if (i >= 0 && i < 96) activities[i] = 'LB';
              }
              changed = true;
              breakCounter[breakIdx] = (breakCounter[breakIdx] || 0) + 1;
            }
          }
        }

        if (changed || isReAuto) {
          r.activities = activities;
          updates.push({
            date: date, nik: r.nik, nama: r.nama, tl: r.tl, channel: channel,
            shift: r.shift, shift_prev: r.shift_prev, bg_color: r.bg_color,
            activities: activities
          });
        }
      }

      if (updates.length > 0) {
        const res = await fetch(`${url}/rest/v1/wfm_schedules?on_conflict=date,nik`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates, return=minimal'
          },
          body: JSON.stringify(updates)
        });
        
        if (!res.ok) throw new Error(await res.text());
        
        setData(newData);
        showStatus(`✅ Success: ${updates.length} break schedules updated.`);
      } else {
        showStatus("ℹ️ No schedules need updating.");
      }
    } catch (err: any) {
      console.error("Auto-break failed:", err);
      showStatus("❌ Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [canEdit, data, settings, date, channel, demographics, reqs]);

  const handleDeleteAllBreaks = React.useCallback(async () => {
    if (!canEdit) {
      showStatus("❌ You do not have permission to edit the schedule.");
      return;
    }
    
    if (data.length === 0) {
      showStatus("⚠️ No agent data to process.");
      return;
    }
    
    console.log("Starting Delete All Breaks");
    setLoading(true);
    const newData = JSON.parse(JSON.stringify(data)); // Deep clone
    const updates = [];

    try {
      const { url, key } = await import('../lib/supabase').then(m => m.getDbCredentials());
      if (!url || !key) throw new Error("Database API not configured in System Settings.");
      
      for (let r of newData) {
        const activities = { ...(r.activities || {}) };
        let changed = false;
        Object.keys(activities).forEach(idx => {
          if (isBreakCode(activities[idx])) {
            delete activities[idx];
            changed = true;
          }
        });

        if (changed) {
          r.activities = activities;
          updates.push({
            date: date,
            nik: r.nik,
            nama: r.nama,
            tl: r.tl,
            channel: channel,
            shift: r.shift,
            shift_prev: r.shift_prev,
            bg_color: r.bg_color,
            activities: activities
          });
        }
      }

      if (updates.length > 0) {
        const res = await fetch(`${url}/rest/v1/wfm_schedules?on_conflict=date,nik`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates, return=minimal'
          },
          body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error(await res.text());

        setData(newData);
        showStatus(`✅ Success: ${updates.length} break schedules deleted.`);
      } else {
        showStatus("ℹ️ No break schedules found.");
      }
    } catch (err: any) {
      console.error("Delete breaks failed:", err);
      showStatus("❌ Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [canEdit, data, date, channel]);

  useEffect(() => {
    const handleTrigger = () => {
      console.log("Break manager triggered");
      setShowBreakManager(true);
    };
    window.addEventListener('wfm-trigger-breakmanager', handleTrigger);
    return () => window.removeEventListener('wfm-trigger-breakmanager', handleTrigger);
  }, []);

  const renderIntervals = () => {
    const intervals = [];
    let t = new Date('1970-01-01T00:00:00');
    for (let i = 0; i < 96; i++) {
      intervals.push(t.toTimeString().substring(0, 5));
      t.setMinutes(t.getMinutes() + 15);
    }
    return intervals;
  };

  const intervals = renderIntervals();
  const actuals = React.useMemo(() => {
    const counts = Array(96).fill(0);
    processedRows.forEach(row => {
      let startIdx = -1, endIdx = -1;
      if (row.isPrev) {
        startIdx = 0;
        endIdx = 28; // 07:00
      } else {
        const shiftInfo = settings.shifts[row.shift];
        if (shiftInfo) {
          const parseTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 4 + Math.floor(m / 15);
          };
          startIdx = parseTime(shiftInfo.s);
          endIdx = parseTime(shiftInfo.e);
          if (endIdx <= startIdx) endIdx += 96;
        }
      }

      for (let i = 0; i < 96; i++) {
        const isWithinShift = startIdx <= i && i < endIdx;
        if (row.activities?.[i] === '1' || (isWithinShift && row.activities?.[i] === undefined)) {
          counts[i]++;
        }
      }
    });
    return counts;
  }, [processedRows, settings.shifts]);

  return (
    <div className="h-full flex flex-col relative">
      <div className="absolute left-0 top-0 z-[200] pointer-events-none w-[270px] h-[118px] flex items-center justify-center">
        <Logo centered className="scale-[0.9]" />
      </div>

      <div className="flex-1 overflow-auto relative scrollbar-thin">

        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 font-bold">Loading...</div>
        ) : (
          <table className="border-separate border-spacing-0 table-fixed w-max">
            <thead>
              {/* Required Staff */}
              <tr className="bg-slate-50">
                <th className="sticky top-0 left-0 z-[110] bg-slate-50 w-[30px] h-[32px]"></th>
                <th className="sticky top-0 left-[30px] z-[110] bg-slate-50 w-[65px] h-[32px]"></th>
                <th className="sticky top-0 left-[95px] z-[110] bg-slate-50 w-[120px] h-[32px]"></th>
                <th className="sticky top-0 left-[215px] z-[110] bg-slate-50 w-[55px] h-[32px]"></th>
                <th className="sticky top-0 left-[270px] z-[110] bg-slate-50 w-[90px] h-[32px] text-left pl-3 text-[9px] text-slate-600 font-semibold">REQUIRED STAFF</th>
                {reqs.map((v, i) => {
                  const operational = isTimeOperational(i);
                  return (
                    <th 
                      key={i} 
                      className={`sticky top-0 z-[100] bg-slate-50 min-w-[18px] w-[18px] text-[9px] text-slate-700 font-medium ${!operational ? 'opacity-30' : ''}`}
                      onMouseEnter={(e) => handleMouseEnter(e, <div className="font-bold text-rose-300">Required: {v} agents</div>)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    >
                      {v}
                    </th>
                  );
                })}
              </tr>
              {/* Actual Online */}
              <tr className="bg-white">
                <th className="sticky top-[32px] left-0 z-[110] bg-white w-[30px] h-[32px]"></th>
                <th className="sticky top-[32px] left-[30px] z-[110] bg-white w-[65px] h-[32px]"></th>
                <th className="sticky top-[32px] left-[95px] z-[110] bg-white w-[120px] h-[32px]"></th>
                <th className="sticky top-[32px] left-[215px] z-[110] bg-white w-[55px] h-[32px]"></th>
                <th className="sticky top-[32px] left-[270px] z-[110] bg-white w-[90px] h-[32px] text-left pl-3 text-[9px] text-slate-600 font-semibold">ACTUAL ONLINE</th>
                {actuals.map((v, i) => (
                  <th 
                    key={i} 
                    className="sticky top-[32px] z-[100] bg-white min-w-[18px] w-[18px] text-[9px] text-slate-700 font-medium"
                    onMouseEnter={(e) => handleMouseEnter(e, <div className="font-bold text-green-300">Actual: {v} agents</div>)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    {v}
                  </th>
                ))}
              </tr>
              {/* Coverage Gap */}
              <tr className="bg-white">
                <th className="sticky top-[64px] left-0 z-[110] bg-white w-[30px] h-[32px]"></th>
                <th className="sticky top-[64px] left-[30px] z-[110] bg-white w-[65px] h-[32px]"></th>
                <th className="sticky top-[64px] left-[95px] z-[110] bg-white w-[120px] h-[32px]"></th>
                <th className="sticky top-[64px] left-[215px] z-[110] bg-white w-[55px] h-[32px]"></th>
                <th className="sticky top-[64px] left-[270px] z-[110] bg-white w-[90px] h-[32px] text-left pl-3 text-[9px] text-slate-600 font-semibold border-b border-slate-200">COVERAGE GAP</th>
                {actuals.map((v, i) => {
                  const gap = v - reqs[i];
                  const gapClass = gap < 0 ? 'bg-red-50 text-red-600 font-semibold' : gap > 0 ? 'bg-green-50 text-green-600 font-semibold' : '';
                  return (
                    <th 
                      key={i} 
                      className={`sticky top-[64px] z-[100] bg-white min-w-[18px] w-[18px] text-[9px] text-slate-700 font-medium border-b border-slate-200 ${gapClass}`}
                      onMouseEnter={(e) => handleMouseEnter(e, <div className={`font-bold ${gap < 0 ? 'text-red-300' : 'text-green-300'}`}>Gap: {gap > 0 ? '+' : ''}{gap}</div>)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                    >
                      {gap}
                    </th>
                  );
                })}
              </tr>
              {/* Hour Row */}
              <tr className="bg-slate-50">
                <th className="sticky top-[96px] left-0 z-[110] bg-slate-50 w-[30px] h-[22px]"></th>
                <th className="sticky top-[96px] left-[30px] z-[110] bg-slate-50 w-[65px] h-[22px]"></th>
                <th className="sticky top-[96px] left-[95px] z-[110] bg-slate-50 w-[120px] h-[22px]"></th>
                <th className="sticky top-[96px] left-[215px] z-[110] bg-slate-50 w-[55px] h-[22px]"></th>
                <th className="sticky top-[96px] left-[270px] z-[110] bg-slate-50 w-[90px] h-[22px] text-left pl-3 text-[9px] text-slate-600 font-bold border-b border-slate-300">INTERVAL</th>
                {intervals.filter((_, i) => i % 4 === 0).map((t, i) => (
                  <th key={i} colSpan={4} className="sticky top-[96px] z-[100] bg-slate-50 min-w-[72px] w-[72px] text-[9px] text-slate-700 font-bold border-b border-slate-300">{t.split(':')[0]}:00</th>
                ))}
              </tr>
              {/* Header Row */}
              <tr className="bg-slate-100">
                <th className="sticky top-[118px] left-0 z-[110] bg-slate-100 w-[30px] h-[22px] text-[8px] text-slate-600 font-bold border-b-2 border-slate-300">NO</th>
                <th className="sticky top-[118px] left-[30px] z-[110] bg-slate-100 w-[65px] h-[22px] text-[8px] text-slate-600 font-bold border-b-2 border-slate-300">NIK</th>
                <th className="sticky top-[118px] left-[95px] z-[110] bg-slate-100 w-[120px] h-[22px] text-[8px] text-slate-600 font-bold border-b-2 border-slate-300 border-r-2 border-r-slate-300 text-left pl-3">AGENT NAME</th>
                <th className="sticky top-[118px] left-[215px] z-[110] bg-slate-100 w-[55px] h-[22px] text-[8px] text-slate-600 font-bold border-b-2 border-slate-300">SHIFT</th>
                <th className="sticky top-[118px] left-[270px] z-[110] bg-slate-100 w-[90px] h-[22px] text-[8px] text-slate-600 font-bold border-b-2 border-slate-300 border-r-2 border-r-slate-300">TIME</th>
                {intervals.map((t, i) => {
                  const operational = isTimeOperational(i);
                  return (
                    <th key={i} className={`sticky top-[118px] z-[100] bg-slate-100 min-w-[18px] w-[18px] h-[22px] text-[8px] text-slate-500 font-medium border-b-2 border-slate-300 text-center ${!operational ? 'bg-slate-200' : ''}`}>
                      {t.split(':')[1]}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={101} className="text-center p-10 text-slate-500 font-bold">No data available for this date.</td>
                </tr>
              ) : (
                filteredData.map((row, idx) => {
                  let startIdx = -1, endIdx = -1;
                  let shiftDisplay = row.shift;
                  let timeDisplay = '-';

                  if (row.isPrev) {
                    startIdx = 0;
                    endIdx = 28;
                    shiftDisplay = 'S4';
                    timeDisplay = '22:00 - 07:00';
                  } else {
                    const shiftInfo = settings.shifts[row.shift];
                    if (shiftInfo) {
                      const parseTime = (t: string) => {
                        const [h, m] = t.split(':').map(Number);
                        return h * 4 + Math.floor(m / 15);
                      };
                      startIdx = parseTime(shiftInfo.s);
                      endIdx = parseTime(shiftInfo.e);
                      if (endIdx <= startIdx) endIdx += 96;
                      timeDisplay = `${shiftInfo.s} - ${shiftInfo.e}`;
                    }
                  }

                  return (
                    <tr key={`${row.nik}-${row.isPrev}`} className="hover:bg-slate-50 group h-[22px]">
                      <td className="sticky left-0 z-[50] bg-white group-hover:bg-slate-100 border-b border-slate-100 border-r border-slate-200 text-center text-[9px] text-slate-600 box-border transition-colors">{idx + 1}</td>
                      <td className="sticky left-[30px] z-[50] bg-white group-hover:bg-slate-100 border-b border-slate-100 border-r border-slate-200 text-center text-[9px] text-slate-600 box-border transition-colors">{row.nik}</td>
                      <td 
                        className="sticky left-[95px] z-[50] bg-white border-b border-slate-100 border-r-2 border-r-slate-300 text-left pl-3 text-[9px] text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis box-border cursor-pointer hover:bg-slate-200 group-hover:bg-slate-100 transition-colors"
                        onContextMenu={(e) => handleContextMenu(e, 'agent', row)}
                        onClick={() => {
                          if (window.innerWidth < 768) {
                            setAgentForm({ ...agentForm, nik: row.nik, nama: row.nama, tl: row.tl }); 
                            setAgentModal({ type: 'UPDATE', row: row });
                          }
                        }}
                      >
                        {row.nama} {row.isPrev && <span className="text-indigo-600 text-[8px] font-bold ml-1">Prev</span>}
                      </td>
                      <td className="sticky left-[215px] z-[50] bg-white group-hover:bg-slate-100 border-b border-slate-100 border-r border-slate-200 text-center text-[9px] text-slate-600 box-border transition-colors">{shiftDisplay}</td>
                      <td className="sticky left-[270px] z-[50] bg-white group-hover:bg-slate-100 border-b border-slate-100 border-r-2 border-r-slate-300 text-center text-[9px] text-slate-600 box-border font-medium transition-colors">
                        {timeDisplay}
                      </td>
                      {intervals.map((_, i) => {
                        const getActType = (index: number) => {
                          if (index < 0 || index >= 96) return '';
                          const within = startIdx <= index && index < endIdx;
                          if (!within) return '';
                          const a = row.activities?.[index];
                          if (a) return a;
                          return '1';
                        };

                        const currentType = getActType(i);
                        const operational = isTimeOperational(i);
                        const prevType = getActType(i - 1);
                        const nextType = getActType(i + 1);

                        // Determine if it's a break/activity or just shift work
                        const isWithinShift = startIdx <= i && i < endIdx;
                        const isBreak = currentType && currentType !== '1';

                        let bgClass = '';
                        let actNameLabel = '';

                        if (isBreak && settings.activities?.[currentType]) {
                          bgClass = settings.activities[currentType].color;
                          actNameLabel = settings.activities[currentType].label;
                        }

                        // Tooltip logic: Activity + Time
                        const timeStr = intervals[i];
                        
                        // Prepare content for memoized handler
                        let content: React.ReactNode = null;
                        if (currentType && currentType !== '1') {
                          const actName = actNameLabel;
                          
                          // Find the start and end of this activity block
                          let startOfBlock = i;
                          while (startOfBlock > 0 && getActType(startOfBlock - 1) === currentType) {
                            startOfBlock--;
                          }
                          let endOfBlock = i;
                          while (endOfBlock < 95 && getActType(endOfBlock + 1) === currentType) {
                            endOfBlock++;
                          }

                          const blockReason = reasons.find(r => r.nik === row.nik && r.interval_idx === startOfBlock && r.activity_code === currentType);

                          content = (
                            <div className="flex flex-col gap-0.5">
                              <div className="font-bold text-indigo-300">{actName}</div>
                              <div className="text-[10px] opacity-90">{indexToTime(startOfBlock)} - {indexToTime(endOfBlock + 1)}</div>
                              {blockReason?.reason && (
                                <div className="mt-1 pt-1 border-t border-slate-700 text-[10px] italic text-amber-300">
                                  💬 "{blockReason.reason}"
                                </div>
                              )}
                            </div>
                          );
                        } else if (isWithinShift) {
                          content = (
                            <div className="flex flex-col gap-0.5">
                              <div className="font-bold text-blue-300">Shift Work</div>
                              <div className="text-[10px] opacity-90">{indexToTime(startIdx)} - {indexToTime(endIdx)}</div>
                            </div>
                          );
                        }

                        // Shift Bar Capsule Logic (Base Layer)
                        const isShiftStart = i === startIdx;
                        const isShiftEnd = i === endIdx - 1;
                        const shiftRoundedClass = `${isShiftStart ? 'rounded-l-full' : ''} ${isShiftEnd ? 'rounded-r-full' : ''}`;

                        // Break Bar Capsule Logic (Top Layer)
                        const isBreakStart = isBreak && currentType !== prevType;
                        const isBreakEnd = isBreak && currentType !== nextType;
                        const breakRoundedClass = `${isBreakStart ? 'rounded-l-full' : ''} ${isBreakEnd ? 'rounded-r-full' : ''}`;

                        return (
                          <td 
                            key={i} 
                            className="min-w-[18px] w-[18px] border-b border-slate-100 p-0 m-0 box-border cursor-crosshair hover:bg-slate-50 relative"
                            onContextMenu={(e) => handleContextMenu(e, 'cell', row, i)}
                            onClick={(e) => {
                              // On mobile, single tap acts as right-click to show actions
                              if (window.innerWidth < 768) {
                                handleContextMenu(e as unknown as React.MouseEvent, 'cell', row, i);
                              }
                            }}
                            onMouseEnter={(e) => handleMouseEnter(e, content)}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                          >
                            {!operational && (
                              <div className="absolute inset-0 bg-slate-200/50 z-10 pointer-events-none"></div>
                            )}
                            {/* Render Shift Bar (Base) - Continuous across shift duration */}
                            {isWithinShift && (
                              <div className={`absolute inset-0 mx-[0px] my-[1px] bg-[#60a5fa] ${shiftRoundedClass} transition-all z-0`}></div>
                            )}
                            {/* Render Break/Activity Bar (On Top) */}
                            {isBreak && (
                              <div className={`absolute inset-0 mx-[0px] my-[3px] ${bgClass} ${breakRoundedClass} transition-all z-20`}></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Context Menus */}
      {contextMenu && contextMenu.type === 'cell' && (
        <div 
          className="fixed bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 min-w-[180px] z-[9999]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {Object.entries(settings.activities || {}).map(([actKey, actConfig]: [string, any]) => {
            if (!roleConf.allowedActivities.includes(actKey)) return null;
            
            return (
              <div 
                key={actKey}
                className="p-2.5 cursor-pointer rounded-lg text-[11px] text-slate-700 flex items-center gap-2 font-medium hover:bg-slate-100 hover:text-indigo-600" 
                onClick={() => {
                  if (actConfig.duration === 'custom') {
                    setReasonModal({ row: contextMenu.row, colIdx: contextMenu.colIdx!, type: actKey });
                  } else {
                    handleAction(actKey);
                  }
                  setContextMenu(null);
                }}
              >
                <div className={`w-3 h-3 rounded-sm opacity-80 ${actConfig.color}`}></div> 
                {actConfig.label}
              </div>
            );
          })}
          {roleConf.allowedActivities.includes('REMOVE') && (
            <>
              <div className="border-t border-slate-100 my-1"></div>
              <div className="p-2.5 cursor-pointer rounded-lg text-[11px] text-slate-700 flex items-center gap-2 font-medium hover:bg-slate-100 hover:text-indigo-600 text-rose-600 font-bold" onClick={() => handleAction('REMOVE')}>♻️ Remove Activity</div>
            </>
          )}
        </div>
      )}

      {contextMenu && contextMenu.type === 'agent' && (
        <div 
          className="fixed bg-white border border-slate-200 shadow-xl rounded-xl p-1.5 min-w-[160px] z-[9999]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="p-2.5 cursor-pointer rounded-lg text-[11px] text-slate-700 flex items-center gap-2 font-medium hover:bg-slate-100 hover:text-indigo-600 text-indigo-600 font-bold" onClick={() => { setAgentModal({ type: 'ADD' }); setContextMenu(null); }}>➕ Add Agent</div>
          <div className="p-2.5 cursor-pointer rounded-lg text-[11px] text-slate-700 flex items-center gap-2 font-medium hover:bg-slate-100 hover:text-indigo-600 text-green-600 font-bold" onClick={() => { setAgentForm({ ...agentForm, nik: contextMenu.row.nik, nama: contextMenu.row.nama, tl: contextMenu.row.tl }); setAgentModal({ type: 'UPDATE', row: contextMenu.row }); setContextMenu(null); }}>✏️ Update Agent</div>
          <div className="p-2.5 cursor-pointer rounded-lg text-[11px] text-slate-700 flex items-center gap-2 font-medium hover:bg-slate-100 hover:text-indigo-600 text-sky-600 font-bold" onClick={() => { setAgentForm({ ...agentForm, nik: contextMenu.row.nik, nama: contextMenu.row.nama, channel: channel }); setAgentModal({ type: 'MOVE', row: contextMenu.row }); setContextMenu(null); }}>🔄 Move Channel</div>
          <div className="border-t border-slate-100 my-1"></div>
          <div className="p-2.5 cursor-pointer rounded-lg text-[11px] text-slate-700 flex items-center gap-2 font-medium hover:bg-slate-100 hover:text-indigo-600 text-rose-600 font-bold" onClick={() => { setAgentForm({ ...agentForm, nik: contextMenu.row.nik, nama: contextMenu.row.nama }); setAgentModal({ type: 'REMOVE', row: contextMenu.row }); setContextMenu(null); }}>❌ Remove Agent</div>
        </div>
      )}

      {/* Reason Modal */}
      {reasonModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
          <div className="bg-white p-5 rounded-2xl w-full max-w-[360px] flex flex-col gap-2.5 shadow-2xl">
            <h3 className="mt-0 text-slate-800 font-bold">Add Activity</h3>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-semibold text-slate-700">
              👤 Agent : <b>{reasonModal.row.nik} - {reasonModal.row.nama}</b><br/>
              📅 Date : <b>{date}</b><br/>
              🏷 Activity : <b>{reasonModal.type}</b>
            </div>
            <textarea 
              placeholder="Enter reason..." 
              rows={3} 
              className="w-full p-2 rounded-xl border border-slate-300 outline-none focus:border-indigo-500"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <label className="text-[13px] font-semibold text-slate-700">Duration:</label>
            <select 
              className="w-full p-2 rounded-xl border border-slate-300 outline-none focus:border-indigo-500"
              value={reasonDuration}
              onChange={(e) => setReasonDuration(e.target.value)}
            >
              <option value="1">15 mins</option>
              <option value="2">30 mins</option>
              <option value="4">1 hour</option>
              <option value="full">Full Day</option>
              <option value="custom">Custom</option>
            </select>
            {reasonDuration === 'custom' && (
              <input 
                type="number" 
                placeholder="Duration in mins (mult. of 15)" 
                min="15" step="15" 
                className="w-full p-2 rounded-xl border border-slate-300 outline-none focus:border-indigo-500"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
              />
            )}
            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2.5">
              <button className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 w-full sm:w-auto" onClick={() => setReasonModal(null)}>Cancel</button>
              <button className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 w-full sm:w-auto" onClick={saveReasonActivity}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Action Modal */}
      {agentModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[380px] shadow-2xl">
            <h3 className="mt-0 text-slate-800 font-bold text-lg mb-4">
              {agentModal.type === 'ADD' ? '➕ Add New Agent' : 
               agentModal.type === 'UPDATE' ? '✏️ Update Agent' : 
               agentModal.type === 'MOVE' ? '🔄 Move Agent' : '❌ Remove Agent'}
            </h3>
            
            <div className="flex flex-col gap-3">
              {agentModal.type === 'ADD' && (
                <>
                  <input type="text" placeholder="NIK" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.nik} onChange={e => setAgentForm({...agentForm, nik: e.target.value})} />
                  <input type="text" placeholder="Full Name" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.nama} onChange={e => setAgentForm({...agentForm, nama: e.target.value})} />
                  <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.channel} onChange={e => setAgentForm({...agentForm, channel: e.target.value})}>
                    {settings.channels.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.tl} onChange={e => setAgentForm({...agentForm, tl: e.target.value})}>
                    <option value="">-- Select Team Leader --</option>
                    {leaders.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </>
              )}
              
              {agentModal.type === 'UPDATE' && (
                <>
                  <div className="bg-green-50 p-2.5 rounded-xl text-xs mb-2">
                    <strong>{agentModal.row.nik} - {agentModal.row.nama}</strong><br/>Channel: {channel}
                  </div>
                  <label className="text-xs font-bold text-slate-700">Team Leader Name:</label>
                  <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.tl} onChange={e => setAgentForm({...agentForm, tl: e.target.value})}>
                    <option value="">-- Select Team Leader --</option>
                    {leaders.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </>
              )}

              {agentModal.type === 'MOVE' && (
                <>
                  <div className="bg-slate-50 p-2.5 rounded-xl text-xs mb-2">
                    <strong>{agentModal.row.nik} - {agentModal.row.nama}</strong><br/>Current Channel: {channel}
                  </div>
                  <label className="text-xs font-bold text-slate-700">Move to Channel:</label>
                  <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.channel} onChange={e => setAgentForm({...agentForm, channel: e.target.value})}>
                    {settings.channels.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label className="text-xs font-bold text-slate-700 mt-2">Move Date (Cut-off):</label>
                  <input type="date" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.date} onChange={e => setAgentForm({...agentForm, date: e.target.value})} />
                  <p className="text-[11px] text-slate-500 m-0">Agent will appear in the new channel starting this date.</p>
                </>
              )}

              {agentModal.type === 'REMOVE' && (
                <>
                  <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl text-xs mb-2">
                    <strong>{agentModal.row.nik} - {agentModal.row.nama}</strong>
                  </div>
                  <label className="text-xs font-bold text-slate-700">Effective Termination Date (OFF):</label>
                  <input type="date" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={agentForm.date} onChange={e => setAgentForm({...agentForm, date: e.target.value})} />
                  <p className="text-[11px] text-slate-500 m-0">Starting this date, the agent's schedule will be cleared (OFF) and login status set to INACTIVE.</p>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 w-full sm:w-auto" onClick={() => setAgentModal(null)}>Cancel</button>
              <button className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 w-full sm:w-auto" onClick={saveAgentAction}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Break Management Modal */}
      {showBreakManager && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-[450px] shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Utensils size={20} className="text-indigo-600" />
                Manage Breaks
              </h3>
              <button 
                onClick={() => setShowBreakManager(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              {saveStatus && (
                <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 mb-2">
                  {saveStatus}
                </div>
              )}

              <button 
                onClick={() => {
                  handleAutoBreak(false);
                }}
                className="w-full p-4 rounded-xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Auto Break</div>
                    <div className="text-xs text-slate-500">Automatically fill empty break schedules.</div>
                  </div>
                </div>
              </button>

              <button 
                onClick={() => {
                  setConfirmModal({
                    title: "Re-Auto Break",
                    message: "Delete all breaks and recreate? This action cannot be undone.",
                    onConfirm: () => {
                      setConfirmModal(null);
                      handleAutoBreak(true);
                    }
                  });
                }}
                className="w-full p-4 rounded-xl border-2 border-slate-100 hover:border-sky-100 hover:bg-sky-50/30 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Re-Auto Break</div>
                    <div className="text-xs text-slate-500">Delete all of today's breaks and recalculate from scratch.</div>
                  </div>
                </div>
              </button>

              <button 
                onClick={() => {
                  setConfirmModal({
                    title: "Delete All Breaks",
                    message: "Delete ALL today's break schedules for all agents? This action cannot be undone.",
                    onConfirm: () => {
                      setConfirmModal(null);
                      handleDeleteAllBreaks();
                    }
                  });
                }}
                className="w-full p-4 rounded-xl border-2 border-slate-100 hover:border-rose-100 hover:bg-rose-50/30 text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-rose-600">Delete All Breaks</div>
                    <div className="text-xs text-slate-500">Clear all break schedules for all agents.</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowBreakManager(false)}
                className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-[400px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">{confirmModal.title}</h3>
              <p className="text-sm text-slate-500 mt-2">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
              >
                Yes, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center gap-4 px-2 sm:px-6 py-2 bg-white border-t border-slate-200 z-[200]">
        <div className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block"></span> Online</div>
        
        {Object.entries(settings.activities || {}).map(([key, act]: [string, any]) => (
          <div key={key} className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold">
            <span className={`w-2.5 h-2.5 rounded-sm inline-block ${act.color}`}></span> {act.label}
          </div>
        ))}
        
        <div className="w-px h-3 bg-slate-200 mx-0.5 hidden sm:block"></div>
        <div className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold"><span className="w-2.5 h-2.5 rounded-sm bg-rose-50 inline-block"></span> Under</div>
        <div className="flex items-center gap-1 text-[9px] text-slate-600 font-semibold"><span className="w-2.5 h-2.5 rounded-sm bg-green-50 inline-block"></span> Over</div>
      </div>
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
