import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { format } from 'date-fns';
import { 
  Settings as SettingsIcon, 
  Database, 
  Clock, 
  Users, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  X,
  ShieldCheck,
  Globe,
  Utensils,
  Zap,
  ArrowLeftRight,
  AlertCircle,
  Briefcase,
  Moon,
  Sun,
  RefreshCw
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, updateSettings, syncSettingsFromDB } = useAppStore();
  const [activeTab, setActiveTab] = useState('api');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  // Sync back local state if global settings change (e.g. from Cloud Sync)
  React.useEffect(() => {
    setUrl(settings.apiUrl);
    setKey(settings.apiKey);
    setChannels(settings.channels.join(', '));
    setShifts(Object.entries(settings.shifts).map(([k, v]) => ({ code: k, ...(v as any) })));
    setHolidays(Object.entries(settings.holidays).map(([k, v]) => ({ date: k, desc: v })));
    setFridayBreak(settings.fridayBreak);
    setPuasa(settings.puasa);
    setPuasaShifts(settings.puasaShifts);
    setRoles(settings.roles);
    setBizRules(settings.bizRules);
    
    // Auto break strings need special handling
    const res: Record<string, string> = {};
    Object.keys(settings.shifts).forEach(code => {
      res[code] = (settings.autoBreak[code] || []).join(', ');
    });
    setAutoBreakStrings(res);
  }, [settings]);

  const handleRefreshFromCloud = async () => {
    setIsSyncing(true);
    await syncSettingsFromDB();
    setIsSyncing(false);
    showStatus("Settings refreshed from Cloud! ☁️");
  };

  const handlePushToCloud = async () => {
    setIsPushing(true);
    try {
      // Logic to push all current settings to cloud
      // We call updateSettings with same values but ensuring skipSync is false (default)
      updateSettings({
        adhId: settings.adhId,
        channels: settings.channels,
        shifts: settings.shifts,
        holidays: settings.holidays,
        autoBreak: settings.autoBreak,
        fridayBreak: settings.fridayBreak,
        puasa: settings.puasa,
        puasaShifts: settings.puasaShifts,
        roles: settings.roles,
        bizRules: settings.bizRules
      });
      showStatus("All settings pushed to Cloud! 🚀");
    } catch (err) {
      console.error("Manual push failed:", err);
    }
    setIsPushing(false);
  };
  
  // API State
  const [url, setUrl] = useState(settings.apiUrl);
  const [key, setKey] = useState(settings.apiKey);
  const [channels, setChannels] = useState(settings.channels.join(', '));

  // Shift State
  const [shifts, setShifts] = useState(Object.entries(settings.shifts).map(([k, v]) => ({ code: k, ...(v as any) })));

  // Holiday State
  const [holidays, setHolidays] = useState(Object.entries(settings.holidays).map(([k, v]) => ({ date: k, desc: v })));
  const [newHolDate, setNewHolDate] = useState('');
  const [newHolDesc, setNewHolDesc] = useState('');
  const [showBulkHol, setShowBulkHol] = useState(false);
  const [bulkHolText, setBulkHolText] = useState('');

  // Auto Break State
  const [autoBreakStrings, setAutoBreakStrings] = useState<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    Object.keys(settings.shifts).forEach(code => {
      res[code] = (settings.autoBreak[code] || []).join(', ');
    });
    return res;
  });
  const [fridayBreak, setFridayBreak] = useState(settings.fridayBreak);

  // Puasa State
  const [puasa, setPuasa] = useState(settings.puasa);
  const [puasaShifts, setPuasaShifts] = useState(settings.puasaShifts);
  const [newPuasaStart, setNewPuasaStart] = useState('');
  const [newPuasaEnd, setNewPuasaEnd] = useState('');

  // Roles State
  const [roles, setRoles] = useState(settings.roles);

  // Activities State
  const [activities, setActivities] = useState(settings.activities || {});

  // Business Rules State
  const [bizRules, setBizRules] = useState(settings.bizRules);

  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const normalizeTime = (t: string) => {
    if (!t) return '';
    let clean = t.replace('.', ':').replace(' ', '').trim();
    if (!clean.includes(':')) {
      const num = parseInt(clean);
      if (!isNaN(num)) return num.toString().padStart(2, '0') + ':00';
      return '';
    }
    const parts = clean.split(':');
    const h = Math.min(23, Math.max(0, parseInt(parts[0]) || 0));
    const m = Math.min(59, Math.max(0, parseInt(parts[1]) || 0));
    return h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
  };

  const handleSaveApi = () => {
    updateSettings({ 
      apiUrl: url, 
      apiKey: key,
      channels: channels.split(',').map(c => c.trim()).filter(Boolean)
    });
    showStatus("API Settings saved successfully! ✅");
  };

  const handleSaveShifts = () => {
    const newShifts: any = {};
    shifts.forEach(s => {
      if (s.code) {
        const start = normalizeTime(s.s);
        const end = normalizeTime(s.e);
        if (start && end) {
          newShifts[s.code] = { s: start, e: end, w: s.w };
        }
      }
    });
    updateSettings({ shifts: newShifts });
    showStatus("Shift Settings saved successfully! ✅");
  };

  const handleSaveRoles = () => {
    updateSettings({ roles });
    showStatus("Roles Settings saved successfully! ✅");
  };

  const handleSaveActivities = () => {
    updateSettings({ activities });
    showStatus("Activity Settings saved successfully! ✅");
  };

  const handleSaveHolidays = () => {
    const newHolidays: any = {};
    holidays.forEach(h => {
      if (h.date && h.desc) {
        newHolidays[h.date] = h.desc;
      }
    });
    updateSettings({ holidays: newHolidays });
    showStatus("Holiday Settings saved successfully! ✅");
  };

  const handleBulkImportHolidays = () => {
    const lines = bulkHolText.split('\n').filter(l => l.trim());
    const newItems = lines.map(line => {
      // Support common separators
      const parts = line.split(/[;\t]/);
      const fallbackParts = line.includes(',') ? line.split(',') : parts;
      const finalParts = parts.length >= 2 ? parts : fallbackParts;

      if (finalParts.length >= 2) {
        const dateStr = finalParts[0].trim().replace(/\//g, '-');
        return { date: dateStr, desc: finalParts[1].trim() };
      }
      return null;
    }).filter(item => item !== null && !isNaN(new Date(item.date).getTime())) as {date: string, desc: string}[];
    
    if (newItems.length > 0) {
      setHolidays([...holidays, ...newItems]);
      setBulkHolText('');
      setShowBulkHol(false);
      showStatus(`Imported ${newItems.length} holidays! ✅`);
    } else {
      alert("Invalid format. Use: YYYY-MM-DD;Description (one per line)");
    }
  };

  const handleSaveAutoBreak = () => {
    try {
      const newAutoBreak: Record<string, string[]> = {};
      Object.keys(autoBreakStrings).forEach(code => {
        const val = autoBreakStrings[code] || '';
        newAutoBreak[code] = val
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => normalizeTime(s))
          .filter(Boolean);
      });
      updateSettings({ autoBreak: newAutoBreak, fridayBreak });
      showStatus("Auto Break Settings saved successfully! ✅");
    } catch (err: any) {
      alert("Error saving break rules: " + err.message);
    }
  };

  const handleSavePuasa = () => {
    updateSettings({ puasa, puasaShifts });
    showStatus("Puasa Settings saved successfully! ✅");
  };

  const handleSaveBiz = () => {
    updateSettings({ bizRules });
    showStatus("Business Rules saved successfully! ✅");
  };

  const toggleRolePermission = (roleName: string, perm: string) => {
    setRoles((prev: any) => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [perm]: !prev[roleName][perm]
      }
    }));
  };

  const toggleRoleUI = (roleName: string, uiCode: string) => {
    setRoles((prev: any) => {
      const allowedUI = prev[roleName].allowedUI || [];
      const newAllowedUI = allowedUI.includes(uiCode) 
        ? allowedUI.filter((c: string) => c !== uiCode)
        : [...allowedUI, uiCode];
      return {
        ...prev,
        [roleName]: {
          ...prev[roleName],
          allowedUI: newAllowedUI
        }
      };
    });
  };

  const uiOptions = [
    { code: 'viewInt', label: 'Interval View' },
    { code: 'viewCal', label: 'Calendar View' },
    { code: 'viewAdh', label: 'Adherence View' },
    { code: 'viewFor', label: 'Forecast View' },
    { code: 'btnApp', label: 'Approval Button' },
    { code: 'btnBrk', label: 'Auto Break Button' },
    { code: 'btnSys', label: 'System Settings' },
    { code: 'btnImp', label: 'Import Schedule' },
    { code: 'btnPub', label: 'Publish Schedule' },
  ];

  return (
    <div className="h-full bg-slate-50 overflow-y-auto p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 px-2">
          <div>
            <h3 className="m-0 text-slate-800 font-extrabold text-xl flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <SettingsIcon size={20} className="text-indigo-600" />
              </div>
              System Settings
            </h3>
            <p className="text-slate-500 text-xs mt-1">Configure global application behavior and business rules.</p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'api' && (
              <button onClick={handleSaveApi} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Save Configuration
              </button>
            )}
            {activeTab === 'shift' && (
              <button onClick={handleSaveShifts} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Save Shift Rules
              </button>
            )}
            {activeTab === 'roles' && (
              <button onClick={handleSaveRoles} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Update Role Access
              </button>
            )}
            {activeTab === 'holiday' && (
              <button onClick={handleSaveHolidays} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Update Calendar
              </button>
            )}
            {activeTab === 'autobreak' && (
              <button onClick={handleSaveAutoBreak} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Deploy Break Schedules
              </button>
            )}
            {activeTab === 'puasa' && (
              <button onClick={handleSavePuasa} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Update Fasting Sync
              </button>
            )}
            {activeTab === 'biz' && (
              <button onClick={handleSaveBiz} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Save Business Rules
              </button>
            )}
            {activeTab === 'activities' && (
              <button onClick={handleSaveActivities} className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs">
                <Save size={16} />
                Save Activities
              </button>
            )}
          </div>
        </div>

        {saveStatus && (
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl mb-6 text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-xl shadow-emerald-100">
            {saveStatus}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm relative">
          <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1.5 overflow-x-auto scrollbar-none rounded-t-3xl items-center sticky top-0 z-10">
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'api' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('api')}>
              <Database size={16} />
              API Database
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'shift' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('shift')}>
              <Clock size={16} />
              Master Shift
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'roles' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('roles')}>
              <Users size={16} />
              Roles
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'holiday' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('holiday')}>
              <Calendar size={16} />
              Holiday Calendar
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'autobreak' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('autobreak')}>
              <Utensils size={16} />
              Auto Break
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'puasa' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('puasa')}>
              <ShieldCheck size={16} />
              Fasting Month
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'biz' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('biz')}>
              <Briefcase size={16} />
              Business Rules
            </button>
            <button className={`flex-1 py-3 px-4 font-bold text-xs rounded-2xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'activities' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`} onClick={() => setActiveTab('activities')}>
              <Zap size={16} />
              Activities
            </button>
          </div>

          <div className="p-4 sm:p-8">
            {activeTab === 'biz' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-indigo-50 p-6 rounded-3xl mb-8 border border-indigo-100">
                   <h4 className="m-0 mb-4 text-indigo-800 text-sm font-black flex items-center gap-2">
                     <Clock size={18} />
                     CHANNEL OPERATIONAL HOURS
                   </h4>
                   <p className="text-[11px] text-indigo-600 font-medium mb-6">Define the active service window for each channel. Volumes outside these hours will be ignored for staff calculations.</p>
                   
                   <div className="space-y-4">
                     {settings.channels.map(ch => {
                        const rule = bizRules.operatingHours[ch] || { start: '00:00', end: '23:59', closed: false };
                        return (
                          <div key={ch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                            <div className="font-extrabold text-slate-700 text-xs">{ch}</div>
                            <div className="flex items-center gap-2">
                              <Sun size={14} className="text-amber-500" />
                              <input 
                                type="time" 
                                className={`flex-1 p-2 border rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 ${rule.closed ? 'opacity-30 pointer-events-none bg-slate-50' : 'bg-white border-slate-200'}`}
                                value={rule.start}
                                onChange={e => setBizRules({
                                  ...bizRules,
                                  operatingHours: { ...bizRules.operatingHours, [ch]: { ...rule, start: e.target.value } }
                                })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Moon size={14} className="text-indigo-400" />
                              <input 
                                type="time" 
                                className={`flex-1 p-2 border rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 ${rule.closed ? 'opacity-30 pointer-events-none bg-slate-50' : 'bg-white border-slate-200'}`}
                                value={rule.end}
                                onChange={e => setBizRules({
                                  ...bizRules,
                                  operatingHours: { ...bizRules.operatingHours, [ch]: { ...rule, end: e.target.value } }
                                })}
                              />
                            </div>
                            <div className="flex justify-end">
                              <label className="flex items-center gap-2 cursor-pointer group">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${rule.closed ? 'text-rose-600' : 'text-slate-400 opacity-60'}`}>Permanently Closed</span>
                                <input 
                                  type="checkbox"
                                  checked={rule.closed}
                                  onChange={e => setBizRules({
                                    ...bizRules,
                                    operatingHours: { ...bizRules.operatingHours, [ch]: { ...rule, closed: e.target.checked } }
                                  })}
                                  className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500"
                                />
                              </label>
                            </div>
                          </div>
                        );
                     })}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="m-0 mb-4 text-slate-800 text-sm font-black flex items-center gap-2">
                      <Calendar size={18} className="text-slate-400" />
                      WEEKEND CONFIGURATION
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium mb-6 tracking-tight">Select which days of the week are considered weekends or closed days for scheduling.</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                        const isActive = bizRules.weekendDays.includes(idx);
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              const newDays = isActive 
                                ? bizRules.weekendDays.filter(d => d !== idx)
                                : [...bizRules.weekendDays, idx].sort();
                              setBizRules({ ...bizRules, weekendDays: newDays });
                            }}
                            className={`px-4 py-3 rounded-2xl text-[10px] font-black transition-all border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <h4 className="m-0 mb-4 text-slate-800 text-sm font-black flex items-center gap-2">
                      <ShieldCheck size={18} className="text-emerald-500" />
                      HOLIDAY POLICY
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium mb-6 tracking-tight">Determine how public holidays affect your service operations.</p>
                    
                    <label className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-300 transition-all group">
                       <span className="text-xs font-bold text-slate-700">Close all operations on Holidays</span>
                       <div className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={bizRules.holidayClosed}
                            onChange={e => setBizRules({ ...bizRules, holidayClosed: e.target.checked })}
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                       </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'activities' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-indigo-50 p-6 rounded-3xl mb-8 border border-indigo-100">
                   <h4 className="m-0 mb-4 text-indigo-800 text-sm font-black flex items-center gap-2">
                     <Zap size={18} />
                     ACTIVITY DEFINITIONS
                   </h4>
                   <p className="text-[11px] text-indigo-600 font-medium mb-6">Manage schedule activities, colors, and duration defaults.</p>
                   
                   <div className="space-y-4">
                     {Object.entries(activities).map(([code, act]: [string, any]) => (
                       <div key={code} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm relative group">
                         <button 
                           onClick={() => {
                             const newActs = { ...activities };
                             delete newActs[code];
                             setActivities(newActs);
                           }}
                           className="absolute -top-3 -right-3 w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                         >
                           <X size={12} />
                         </button>
                         <div className="font-extrabold text-slate-700 items-center gap-2 max-w-full">
                           <input
                            type="text"
                            disabled
                            value={code}
                            className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-slate-50 opacity-70 font-mono"
                           />
                         </div>
                         <div className="col-span-2">
                           <input 
                             placeholder="Activity Label"
                             className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                             value={act.label}
                             onChange={(e) => setActivities({ ...activities, [code]: { ...act, label: e.target.value } })}
                           />
                         </div>
                         <div>
                           <select 
                             className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                             value={act.duration || 'custom'}
                             onChange={(e) => setActivities({ ...activities, [code]: { ...act, duration: e.target.value } })}
                           >
                             <option value="1">15 mins</option>
                             <option value="2">30 mins</option>
                             <option value="4">1 hour</option>
                             <option value="full">Full Day</option>
                             <option value="custom">Custom Dialog</option>
                           </select>
                         </div>
                         <div>
                            <select 
                             className="w-full p-2 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 uppercase"
                             value={act.category || 'work'}
                             onChange={(e) => setActivities({ ...activities, [code]: { ...act, category: e.target.value } })}
                           >
                             <option value="work">Work / Shift</option>
                             <option value="break">Break</option>
                             <option value="absence">Absence</option>
                           </select>
                         </div>
                         <div className="flex gap-2 items-center">
                           <input 
                             placeholder="Tailwind Color (e.g. bg-blue-200)"
                             className="w-full p-2 border border-slate-200 rounded-xl text-[10px] font-mono outline-none focus:border-indigo-500"
                             value={act.color}
                             onChange={(e) => setActivities({ ...activities, [code]: { ...act, color: e.target.value } })}
                           />
                           <div className={`w-8 h-8 rounded border border-slate-300 min-w-[2rem] ${act.color}`}></div>
                         </div>
                       </div>
                     ))}
                   </div>
                   
                   <div className="mt-6 flex justify-end">
                     <button 
                       onClick={() => {
                         const newCode = prompt("Enter a unique Activity Code (e.g. TR for Trainings):");
                         if (newCode && !activities[newCode]) {
                           setActivities({ 
                             ...activities, 
                             [newCode.toUpperCase()]: { label: "New Activity", color: "bg-slate-200", duration: "custom", category: "work" } 
                           });
                         } else if (newCode) {
                           alert("Code already exists.");
                         }
                       }}
                       className="px-4 py-2 bg-indigo-200 text-indigo-700 hover:bg-indigo-300 rounded-xl font-bold flex gap-2 items-center text-xs"
                     >
                       <Plus size={14} /> Add New Activity
                     </button>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-indigo-50 p-6 rounded-3xl mb-8 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <h4 className="m-0 mb-1 text-indigo-800 text-sm font-black flex items-center gap-2">
                      <Globe size={18} />
                      CLOUD CONFIGURATION
                    </h4>
                    <p className="text-[10px] text-indigo-600 font-medium max-w-md">By configuring Supabase, your business rules, shifts, holidays, and role settings are automatically synced to the cloud and available across all browsers.</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleRefreshFromCloud}
                      disabled={isSyncing || isPushing}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-all ${isSyncing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'}`}
                      title="Pull latest settings from Cloud"
                    >
                      <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                      {isSyncing ? 'Syncing...' : 'Pull from Cloud'}
                    </button>
                    <button 
                      onClick={handlePushToCloud}
                      disabled={isSyncing || isPushing}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-all ${isPushing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}
                      title="Push current local settings to Cloud"
                    >
                      <Save size={14} className={isPushing ? 'animate-pulse' : ''} />
                      {isPushing ? 'Pushing...' : 'Push to Cloud'}
                    </button>
                  </div>
                </div>

                <div className="bg-orange-50 p-4 rounded-2xl mb-6 border border-orange-100">
                  <p className="text-xs text-orange-700 m-0 font-bold flex items-center gap-2">
                    <AlertCircle size={16} />
                    Database Configuration Required
                  </p>
                  <p className="text-[10px] text-orange-600 mt-1">Configure your Supabase connection to enable persistence across the application.</p>
                </div>
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2 px-1">Supabase URL</label>
                    <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all shadow-sm" placeholder="https://xxxx.supabase.co" />
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2 px-1">Supabase Anon Key</label>
                    <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all shadow-sm" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-2 px-1">Active Channels (Separate with Comma)</label>
                    <input type="text" value={channels} onChange={(e) => setChannels(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all shadow-sm" placeholder="Call, Digital Chat, Email, Leader" />
                  </div>
                </div>
              </div>
            )}

        {activeTab === 'shift' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-200">
              <p className="text-[11px] text-slate-500 m-0 font-medium">Set operational shift hours. Changes will immediately update the Gantt Chart visual.</p>
            </div>
            
            <div className="flex gap-4 items-center mb-2 px-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              <div className="w-[80px]">Code</div>
              <div className="flex-1">Start Time</div>
              <div className="w-4 text-center">-</div>
              <div className="flex-1">End Time</div>
              <div className="w-[80px]">Sort Order</div>
              <div className="w-10"></div>
            </div>
            
            <div className="space-y-3">
              {shifts.map((s, i) => (
                <div key={i} className="flex gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 transition-all group">
                  <input type="text" className="w-[80px] p-2.5 border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 bg-white" value={s.code} onChange={e => { const newS = [...shifts]; newS[i].code = e.target.value; setShifts(newS); }} />
                  <input type="text" placeholder="08:00" className="flex-1 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-center bg-white" value={s.s} onChange={e => { const newS = [...shifts]; newS[i].s = e.target.value; setShifts(newS); }} />
                  <span className="text-xs font-bold text-slate-400">to</span>
                  <input type="text" placeholder="17:00" className="flex-1 p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-center bg-white" value={s.e} onChange={e => { const newS = [...shifts]; newS[i].e = e.target.value; setShifts(newS); }} />
                  <input type="number" className="w-[80px] p-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold text-center bg-white" value={s.w} onChange={e => { const newS = [...shifts]; newS[i].w = parseFloat(e.target.value) || 0; setShifts(newS); }} />
                  <button className="p-2.5 text-rose-500 hover:bg-rose-100 rounded-xl transition-all opacity-0 group-hover:opacity-100" onClick={() => setShifts(shifts.filter((_, idx) => idx !== i))} title="Delete Shift">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-6 py-4 border-2 border-dashed border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2" onClick={() => setShifts([...shifts, { code: '', s: '08:00', e: '17:00', w: shifts.length + 1 }])}>
              <Plus size={18} />
              Add New Shift Definition
            </button>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-200">
              <p className="text-[11px] text-slate-500 m-0 font-medium">Configure detailed permissions and accessible UI interfaces for each organizational role.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(roles).map(roleName => (
                <div key={roleName} className="bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all">
                  <div className="bg-slate-50/50 p-4 border-b border-slate-100 font-extrabold text-slate-700 flex items-center justify-between">
                    <span>{roleName} Role</span>
                    <ShieldCheck size={16} className="text-indigo-500" />
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Core Permissions</h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {['isAdmin', 'canEditSchedule', 'canSeeAll', 'canSwap'].map(perm => (
                          <label key={perm} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-indigo-50 transition-all">
                            <input 
                              type="checkbox" 
                              checked={roles[roleName][perm] || false}
                              onChange={() => toggleRolePermission(roleName, perm)}
                              className="w-4 h-4 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-slate-700">{perm.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">UI Feature Accessibility</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {uiOptions.map(ui => (
                          <label key={ui.code} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                            <input 
                              type="checkbox" 
                              checked={(roles[roleName].allowedUI || []).includes(ui.code)}
                              onChange={() => toggleRoleUI(roleName, ui.code)}
                              className="w-4 h-4 text-emerald-600 rounded-lg border-slate-300 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-semibold text-slate-600">{ui.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Allowed Activities</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.keys(settings.activities || {}).map((actCode) => (
                           <label key={actCode} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                             <input
                               type="checkbox"
                               checked={(roles[roleName].allowedActivities || []).includes(actCode)}
                               onChange={(e) => {
                                  setRoles((prev: any) => {
                                    const acts = prev[roleName].allowedActivities || [];
                                    const newActs = e.target.checked 
                                      ? [...acts, actCode]
                                      : acts.filter((c: string) => c !== actCode);
                                    return {
                                      ...prev,
                                      [roleName]: { ...prev[roleName], allowedActivities: newActs }
                                    };
                                  });
                               }}
                               className="w-4 h-4 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500"
                             />
                             <span className="text-xs font-semibold text-slate-600">{actCode}</span>
                           </label>
                        ))}
                         <label className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                           <input
                             type="checkbox"
                             checked={(roles[roleName].allowedActivities || []).includes('REMOVE')}
                             onChange={(e) => {
                                setRoles((prev: any) => {
                                  const acts = prev[roleName].allowedActivities || [];
                                  const newActs = e.target.checked 
                                    ? [...acts, 'REMOVE']
                                    : acts.filter((c: string) => c !== 'REMOVE');
                                  return {
                                    ...prev,
                                    [roleName]: { ...prev[roleName], allowedActivities: newActs }
                                  };
                                });
                             }}
                             className="w-4 h-4 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500"
                           />
                           <span className="text-xs font-semibold text-slate-600">REMOVE</span>
                         </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'holiday' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-emerald-50 p-4 rounded-2xl mb-6 border border-emerald-100">
              <p className="text-[11px] text-emerald-800 m-0 font-medium">Define national holidays for accurate workload and schedule calculations.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {holidays.map((h, i) => (
                <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm transition-all hover:bg-slate-50 group">
                  <div className="flex-1">
                    <div className="font-extrabold text-slate-800 text-sm">{format(new Date(h.date), 'dd MMM yyyy')}</div>
                    <div className="text-slate-500 text-[11px] font-medium">{h.desc}</div>
                  </div>
                  <button className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100" onClick={() => setHolidays(holidays.filter((_, idx) => idx !== i))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {holidays.length === 0 && <div className="col-span-2 text-center text-slate-400 text-sm py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">No holidays added yet</div>}
            </div>
             <div className="bg-slate-100 p-6 rounded-3xl border border-slate-200">
              <div className="flex justify-between items-center mb-4 px-1">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Add Holiday Event</h4>
                <button 
                  onClick={() => setShowBulkHol(!showBulkHol)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-lg transition-all"
                >
                  <Plus size={12} />
                  {showBulkHol ? "Single Entry" : "Bulk Import"}
                </button>
              </div>

              {showBulkHol ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[10px] text-slate-500 mb-2 px-1">Paste multiple holidays (Format: <span className="font-mono bg-slate-200 px-1 rounded">YYYY-MM-DD;Description</span>), one per line.</p>
                  <textarea 
                    className="w-full h-32 p-4 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 bg-white font-mono text-xs mb-4 scrollbar-thin"
                    placeholder="2026-01-01;New Year's Day&#10;2026-12-25;Christmas Day"
                    value={bulkHolText}
                    onChange={e => setBulkHolText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleBulkImportHolidays}
                      className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 text-xs"
                    >
                      <Save size={14} />
                      Process Bulk Import
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-end animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex-1">
                    <label className="text-[11px] font-extrabold text-slate-500 mb-1 block px-1">Event Date</label>
                    <input type="date" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-white font-bold" value={newHolDate} onChange={e => setNewHolDate(e.target.value)} />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-[11px] font-extrabold text-slate-500 mb-1 block px-1">Description</label>
                    <input type="text" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 bg-white" placeholder="e.g.: Independence Day" value={newHolDesc} onChange={e => setNewHolDesc(e.target.value)} />
                  </div>
                  <button className="bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center gap-2 whitespace-nowrap" onClick={() => { if(newHolDate && newHolDesc) { setHolidays([...holidays, {date: newHolDate, desc: newHolDesc}]); setNewHolDate(''); setNewHolDesc(''); } }}>
                    <Plus size={18} />
                    Add Event
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'autobreak' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-indigo-50 p-6 rounded-3xl mb-8 border border-indigo-100">
              <h4 className="m-0 mb-4 text-indigo-800 text-sm font-extrabold flex items-center gap-2">
                <Utensils size={18} />
                FRIDAY BREAK EXCEPTIONS (MOSQUE VISITS)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-[11px] text-indigo-600 font-extrabold uppercase tracking-wider block mb-2">Standard Duration (Mins)</label>
                  <input type="number" className="w-full p-3 border border-indigo-200 rounded-2xl text-sm font-bold bg-white" value={fridayBreak?.normal || 90} onChange={e => setFridayBreak({...fridayBreak, normal: parseInt(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="text-[11px] text-indigo-600 font-extrabold uppercase tracking-wider block mb-2">Fasting Period Duration (Mins)</label>
                  <input type="number" className="w-full p-3 border border-indigo-200 rounded-2xl text-sm font-bold bg-white" value={fridayBreak?.puasa || 60} onChange={e => setFridayBreak({...fridayBreak, puasa: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="pt-4 border-t border-indigo-200/50">
                <label className="text-[11px] text-indigo-600 font-extrabold uppercase tracking-wider block mb-2">Targeted Shifts (Filter)</label>
                <input type="text" className="w-full p-3 border border-indigo-200 rounded-2xl text-sm font-semibold bg-white" value={fridayBreak?.shiftCode || 'S2'} onChange={e => setFridayBreak({...fridayBreak, shiftCode: e.target.value})} placeholder="e.g.: S2, S3" />
                <p className="text-[10px] text-indigo-500 mt-2 font-medium opacity-80">Separate codes with commas. Unlisted shifts default to 60 minutes.</p>
              </div>
            </div>

            <h4 className="text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-widest mb-4 px-2">Shift Break Profiles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(settings.shifts).map(shiftCode => (
                <div key={shiftCode} className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm hover:border-indigo-200 transition-all">
                  <div className="font-extrabold text-slate-800 text-sm mb-3 flex items-center justify-between">
                    <span>Shift {shiftCode}</span>
                    <span className="font-bold text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">{settings.shifts[shiftCode].s} - {settings.shifts[shiftCode].e}</span>
                  </div>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 text-xs font-semibold bg-slate-50 focus:bg-white" 
                    value={autoBreakStrings[shiftCode] || ''} 
                    onChange={e => setAutoBreakStrings({...autoBreakStrings, [shiftCode]: e.target.value})} 
                    placeholder="Times: 10:00, 11:30, 14:00..." 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'puasa' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-fuchsia-50 p-6 rounded-3xl mb-8 border border-fuchsia-100">
              <p className="text-[11px] text-fuchsia-800 m-0 font-bold leading-relaxed flex items-center gap-3">
                <Zap size={20} />
                Set active fasting month dates and corresponding shift hour adjustments for religious sensitivity.
              </p>
            </div>
            
            <div className="mb-8">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-4 px-2">Active Fasting Periods</label>
              <div className="space-y-3 mb-6">
                {puasa.map((p, i) => (
                  <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200 border-l-4 border-l-fuchsia-600 shadow-sm transition-all hover:bg-fuchsia-50/30 group">
                    <div className="font-extrabold text-slate-700 flex-1 text-sm flex items-center gap-3">
                      <span>{format(new Date(p.start), 'dd MMM yyyy')}</span>
                      <ArrowLeftRight size={14} className="text-slate-300" />
                      <span>{format(new Date(p.end), 'dd MMM yyyy')}</span>
                    </div>
                    <button className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100" onClick={() => setPuasa(puasa.filter((_, idx) => idx !== i))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {puasa.length === 0 && <div className="text-center text-slate-400 text-sm py-12 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50 italic">No fasting calendar events active</div>}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-100 items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-extrabold text-slate-500 mb-1 block px-1">Start Date</label>
                  <input type="date" className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-fuchsia-500 bg-white font-bold" value={newPuasaStart} onChange={e => setNewPuasaStart(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-extrabold text-slate-500 mb-1 block px-1">End Date</label>
                  <input type="date" className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:border-fuchsia-500 bg-white font-bold" value={newPuasaEnd} onChange={e => setNewPuasaEnd(e.target.value)} />
                </div>
                <button className="bg-fuchsia-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-fuchsia-700 shadow-xl shadow-fuchsia-100 transition-all flex items-center gap-2" onClick={() => { if(newPuasaStart && newPuasaEnd) { setPuasa([...puasa, {start: newPuasaStart, end: newPuasaEnd}]); setNewPuasaStart(''); setNewPuasaEnd(''); } }}>
                  <Plus size={18} />
                  Add Period
                </button>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex flex-col">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Fasting Shift Map</label>
                  <p className="text-[9px] text-slate-500 font-medium">Automatic overrides during established dates.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(settings.shifts).map(shiftCode => {
                  const base = settings.shifts[shiftCode];
                  const override = puasaShifts[shiftCode] || {s: '', e: '', b: ''};
                  return (
                    <div key={shiftCode} className="p-6 bg-slate-50 border border-slate-200 rounded-3xl transition-all hover:bg-white hover:border-fuchsia-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-extrabold text-slate-800 text-sm">Shift {shiftCode}</div>
                        <div className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded ml-2">Normal: {base.s} - {base.e}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-400 uppercase mb-1 block">Start</label>
                          <input type="time" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={override.s} onChange={e => setPuasaShifts({...puasaShifts, [shiftCode]: {...override, s: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-400 uppercase mb-1 block">End</label>
                          <input type="time" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={override.e} onChange={e => setPuasaShifts({...puasaShifts, [shiftCode]: {...override, e: e.target.value}})} />
                        </div>
                        <div>
                          <label className="text-[9px] font-extrabold text-slate-400 uppercase mb-1 block">Break (M)</label>
                          <input type="number" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={override.b} onChange={e => setPuasaShifts({...puasaShifts, [shiftCode]: {...override, b: parseInt(e.target.value) || 0}})} placeholder="min" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>
);
};
