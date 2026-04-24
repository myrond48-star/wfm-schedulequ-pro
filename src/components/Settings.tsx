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
    updateSettings({ shifts: newShifts, bizRules });
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
    <div className="h-full bg-slate-50/50 overflow-y-auto p-4 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-1">
          <div>
            <h3 className="m-0 text-slate-900 font-bold text-2xl flex items-center gap-3 tracking-tight">
              <div className="p-2.5 bg-white border border-slate-200 shadow-sm rounded-xl">
                <SettingsIcon size={22} className="text-indigo-600" />
              </div>
              System Settings
            </h3>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Fine-tune your workforce management parameters and global configurations.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === 'api' && (
              <button onClick={handleSaveApi} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Save API Config
              </button>
            )}
            {activeTab === 'shift' && (
              <button onClick={handleSaveShifts} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Save Shift Rules
              </button>
            )}
            {activeTab === 'roles' && (
              <button onClick={handleSaveRoles} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Update Permissions
              </button>
            )}
            {activeTab === 'holiday' && (
              <button onClick={handleSaveHolidays} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Update Calendar
              </button>
            )}
            {activeTab === 'autobreak' && (
              <button onClick={handleSaveAutoBreak} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Save Break Rules
              </button>
            )}
            {activeTab === 'puasa' && (
              <button onClick={handleSavePuasa} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Update Sync
              </button>
            )}
            {activeTab === 'biz' && (
              <button onClick={handleSaveBiz} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Save Business Rules
              </button>
            )}
            {activeTab === 'activities' && (
              <button onClick={handleSaveActivities} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-xs">
                <Save size={16} />
                Save Activities
              </button>
            )}
          </div>
        </div>

        {saveStatus && (
          <div className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl mb-8 text-sm font-semibold animate-in fade-in slide-in-from-top-3 duration-300 flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 border border-emerald-500">
            {saveStatus}
          </div>
        )}

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/30 p-2 gap-1 overflow-x-auto scrollbar-none items-center sticky top-0 z-10">
            {[
              { id: 'api', icon: Database, label: 'API & Core' },
              { id: 'shift', icon: Clock, label: 'Shifts' },
              { id: 'roles', icon: Users, label: 'Access Roles' },
              { id: 'holiday', icon: Calendar, label: 'Holiday Cal' },
              { id: 'autobreak', icon: Utensils, label: 'Auto Break' },
              { id: 'puasa', icon: Moon, label: 'Fasting' },
              { id: 'biz', icon: Briefcase, label: 'Ops Hours' },
              { id: 'activities', icon: Zap, label: 'Activities' },
            ].map(tab => (
              <button 
                key={tab.id}
                className={`min-w-fit px-5 py-3 font-bold text-xs rounded-xl transition-all whitespace-nowrap flex items-center gap-2.5 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60 ring-1 ring-slate-100' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`} 
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={15} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-10">
            {activeTab === 'biz' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-5xl mx-auto">
                <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] mb-10 border border-slate-200 shadow-sm">
                   <h4 className="m-0 mb-5 text-slate-900 text-lg font-bold flex items-center gap-2.5 tracking-tight">
                     <Clock size={20} className="text-indigo-600" />
                     CHANNEL OPERATIONAL HOURS
                   </h4>
                   <p className="text-sm text-slate-500 font-medium mb-8">Define the active service window for each channel. Volumes outside these hours will be ignored for staff calculations.</p>
                   
                   <div className="space-y-4">
                     {settings.channels.map(ch => {
                        const rule = bizRules.operatingHours[ch] || { start: '00:00', end: '23:59', closed: false };
                        return (
                          <div key={ch} className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors">
                            <div className="font-bold text-slate-800 text-sm">{ch}</div>
                            <div className="flex items-center gap-3">
                              <Sun size={15} className="text-amber-500 shrink-0" />
                              <input 
                                type="time" 
                                className={`flex-1 p-2.5 border rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 ${rule.closed ? 'opacity-30 pointer-events-none bg-slate-100' : 'bg-white border-slate-200'}`}
                                value={rule.start}
                                onChange={e => setBizRules({
                                  ...bizRules,
                                  operatingHours: { ...bizRules.operatingHours, [ch]: { ...rule, start: e.target.value } }
                                })}
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <Moon size={15} className="text-indigo-400 shrink-0" />
                              <input 
                                type="time" 
                                className={`flex-1 p-2.5 border rounded-xl text-xs font-bold font-mono outline-none focus:border-indigo-500 ${rule.closed ? 'opacity-30 pointer-events-none bg-slate-100' : 'bg-white border-slate-200'}`}
                                value={rule.end}
                                onChange={e => setBizRules({
                                  ...bizRules,
                                  operatingHours: { ...bizRules.operatingHours, [ch]: { ...rule, end: e.target.value } }
                                })}
                              />
                            </div>
                            <div className="flex justify-end">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <span className={`text-[11px] font-bold uppercase tracking-tight ${rule.closed ? 'text-rose-600' : 'text-slate-400'}`}>Closed</span>
                                <input 
                                  type="checkbox"
                                  checked={rule.closed}
                                  onChange={e => setBizRules({
                                    ...bizRules,
                                    operatingHours: { ...bizRules.operatingHours, [ch]: { ...rule, closed: e.target.checked } }
                                  })}
                                  className="w-5 h-5 text-rose-500 rounded-lg border-slate-300 focus:ring-rose-500"
                                />
                              </label>
                            </div>
                          </div>
                        );
                     })}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h4 className="m-0 mb-5 text-slate-900 text-base font-bold flex items-center gap-2.5 tracking-tight">
                      <Calendar size={18} className="text-slate-400" />
                      WEEKEND CONFIGURATION
                    </h4>
                    <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">Select which days of the week are considered weekends or closed days for scheduling.</p>
                    
                    <div className="flex flex-wrap gap-2.5">
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
                            className={`px-5 py-3 rounded-2xl text-[11px] font-bold transition-all border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h4 className="m-0 mb-5 text-slate-900 text-base font-bold flex items-center gap-2.5 tracking-tight">
                      <ShieldCheck size={18} className="text-emerald-500" />
                      HOLIDAY POLICY
                    </h4>
                    <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">Determine how public holidays affect your service operations.</p>
                    
                    <label className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-300 transition-all group">
                       <span className="text-sm font-semibold text-slate-700">Close all operations on Holidays</span>
                       <div className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={bizRules.holidayClosed}
                            onChange={e => setBizRules({ ...bizRules, holidayClosed: e.target.checked })}
                            className="sr-only peer" 
                          />
                          <div className="w-12 h-6.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5.5 after:w-5.5 after:transition-all peer-checked:bg-indigo-600"></div>
                       </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'activities' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-5xl mx-auto">
                <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] mb-10 border border-slate-200 shadow-sm relative overflow-hidden">
                   <h4 className="m-0 mb-5 text-slate-900 text-lg font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                     <Zap size={20} className="text-amber-500" />
                     ACTIVITY DEFINITIONS
                   </h4>
                   <p className="text-sm text-slate-500 font-medium mb-8 relative z-10">Manage schedule activities, colors, and duration defaults.</p>
                   
                   <div className="space-y-3 relative z-10">
                     {Object.entries(activities).map(([code, act]: [string, any]) => (
                       <div key={code} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-amber-200 group">
                         <div className="font-mono font-bold text-slate-400 text-[10px] bg-slate-50 px-2 py-1 rounded-md w-fit">
                           {code}
                         </div>
                         <div className="col-span-2">
                           <input 
                             placeholder="Activity Label"
                             className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all focus:bg-white"
                             value={act.label}
                             onChange={(e) => setActivities({ ...activities, [code]: { ...act, label: e.target.value } })}
                           />
                         </div>
                         <div>
                           <select 
                             className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all focus:bg-white"
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
                             className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all focus:bg-white uppercase tracking-tight"
                             value={act.category || 'work'}
                             onChange={(e) => setActivities({ ...activities, [code]: { ...act, category: e.target.value } })}
                           >
                             <option value="work">Work</option>
                             <option value="break">Break</option>
                             <option value="absence">Absence</option>
                           </select>
                         </div>
                         <div className="flex gap-2 items-center">
                           <div className={`w-10 h-10 rounded-xl border border-slate-200 shrink-0 transition-all shadow-sm ${act.color}`}></div>
                           <button 
                            onClick={() => {
                              const newActs = { ...activities };
                              delete newActs[code];
                              setActivities(newActs);
                            }}
                            className="p-2.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                         </div>
                       </div>
                     ))}
                   </div>
                   
                   <div className="mt-8 flex justify-center">
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
                       className="px-6 py-3 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 rounded-2xl font-bold flex gap-2.5 items-center text-xs transition-all shadow-sm active:scale-95"
                     >
                       <Plus size={16} className="text-indigo-500" /> Add New Activity
                     </button>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-4xl mx-auto">
                <div className="bg-indigo-50/50 p-6 md:p-8 rounded-[2rem] border border-indigo-100 shadow-sm mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h4 className="m-0 mb-2 text-indigo-900 text-lg font-bold flex items-center gap-2.5 tracking-tight">
                      <Globe size={20} className="text-indigo-600" />
                      CLOUD CONFIGURATION
                    </h4>
                    <p className="text-sm text-indigo-600/80 font-medium">Your settings are synced to the cloud and available across all authorized browsers.</p>
                  </div>
                  <div className="flex gap-2.5 w-full md:w-auto">
                    <button 
                      onClick={handleRefreshFromCloud}
                      disabled={isSyncing || isPushing}
                      className={`flex-1 md:flex-none px-5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all ${isSyncing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-slate-50 shadow-sm active:scale-95'}`}
                    >
                      <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                      {isSyncing ? 'Syncing...' : 'Pull Cloud'}
                    </button>
                    <button 
                      onClick={handlePushToCloud}
                      disabled={isSyncing || isPushing}
                      className={`flex-1 md:flex-none px-5 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2.5 transition-all ${isPushing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95'}`}
                    >
                      <Save size={15} className={isPushing ? 'animate-pulse' : ''} />
                      {isPushing ? 'Pushing...' : 'Push Cloud'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                   <div className="space-y-6">
                      <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4 px-1">Supabase URL</label>
                        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all shadow-inner" placeholder="https://xxxx.supabase.co" />
                      </div>
                      <div className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4 px-1">Supabase Anon Key</label>
                        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-300 focus:bg-white transition-all shadow-inner" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
                      </div>
                   </div>

                   <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                      <p className="text-sm text-slate-800 m-0 font-bold flex items-center gap-2.5 mb-4">
                        <Database size={18} className="text-indigo-500" />
                        Infrastructure Scan
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {['wfm_config', 'wfm_agents', 'wfm_schedules', 'wfm_holidays', 'wfm_traffic_actual', 'wfm_traffic_forecast', 'wfm_exceptions', 'adherence_log'].map(table => (
                          <div key={table} className="flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse"></div>
                            {table}
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-6 leading-relaxed font-medium italic">* System checks passed. Tables are operational. Defaults will be applied if optional tables are missing.</p>
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-5 px-1">Active Channels (Comma Separated)</label>
                  <input type="text" value={channels} onChange={(e) => setChannels(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-300 focus:bg-white transition-all shadow-inner" placeholder="Call, Digital Chat, Email, Leader" />
                  <p className="text-[10px] text-slate-400 mt-4 font-medium px-2">Registered channels define the primary navigation and filtering across all system views.</p>
                </div>
              </div>
            )}

        {activeTab === 'shift' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-5xl mx-auto">
            <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] mb-10 border border-slate-200 shadow-sm relative overflow-hidden">
               <h4 className="m-0 mb-5 text-slate-900 text-lg font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                 <Clock size={20} className="text-indigo-600" />
                 MASTER SHIFT DEFINITIONS
               </h4>
               <p className="text-sm text-slate-500 font-medium mb-8 relative z-10">Define your organization's operational shift patterns. These directly influence scheduling logic and Gantt visualizations.</p>
               
               <div className="flex gap-4 items-center mb-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest relative z-10">
                 <div className="w-[100px]">ID CODE</div>
                 <div className="flex-1">START TIME</div>
                 <div className="w-6"></div>
                 <div className="flex-1">END TIME</div>
                 <div className="w-[100px] text-center">WEB RANK</div>
                 <div className="w-10"></div>
               </div>
               
               <div className="space-y-3 relative z-10">
                 {shifts.map((s, i) => (
                   <div key={i} className="flex gap-3 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-indigo-200 group">
                     <input type="text" className="w-[100px] p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold font-mono text-xs text-indigo-600 outline-none focus:border-indigo-500 focus:bg-white" value={s.code} onChange={e => { const newS = [...shifts]; newS[i].code = e.target.value; setShifts(newS); }} />
                     <input type="text" placeholder="08:00" className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-xs text-center outline-none focus:border-indigo-500 focus:bg-white" value={s.s} onChange={e => { const newS = [...shifts]; newS[i].s = e.target.value; setShifts(newS); }} />
                     <ArrowLeftRight size={14} className="text-slate-300 shrink-0" />
                     <input type="text" placeholder="17:00" className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl font-semibold text-xs text-center outline-none focus:border-indigo-500 focus:bg-white" value={s.e} onChange={e => { const newS = [...shifts]; newS[i].e = e.target.value; setShifts(newS); }} />
                     <input type="number" className="w-[100px] p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-center outline-none focus:border-indigo-500 focus:bg-white" value={s.w} onChange={e => { const newS = [...shifts]; newS[i].w = parseFloat(e.target.value) || 0; setShifts(newS); }} />
                     <button className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100" onClick={() => setShifts(shifts.filter((_, idx) => idx !== i))}>
                       <Trash2 size={16} />
                     </button>
                   </div>
                 ))}
               </div>
               
               <div className="mt-10 flex justify-center">
                 <button className="px-8 py-4 bg-white border-2 border-dashed border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-sm" onClick={() => setShifts([...shifts, { code: '', s: '08:00', e: '17:00', w: shifts.length + 1 }])}>
                   <Plus size={20} />
                   Add New Shift Definition
                 </button>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
               <h4 className="m-0 mb-5 text-slate-900 text-base font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                 <ArrowLeftRight size={18} className="text-indigo-600" />
                 CHANNEL SHIFT ASSIGNMENT
               </h4>
               <p className="text-sm text-slate-500 font-medium mb-8 relative z-10">Specify which shifts are eligible for each operational channel. This mapping filters selection in Forecast and Schedule views.</p>
               
               <div className="divide-y divide-slate-100 relative z-10">
                  {settings.channels.map(ch => (
                    <div key={ch} className="py-5 flex flex-col md:flex-row md:items-center gap-6 group/row">
                      <div className="md:w-1/4">
                        <div className="text-xs font-black text-slate-800 uppercase tracking-widest group-hover/row:text-indigo-600 transition-colors">{ch}</div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">Assigned Shifts</div>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2">
                        {shifts.map(s => {
                          if (!s.code) return null;
                          const currentShifts = bizRules.channelShifts?.[ch] || [];
                          const isActive = currentShifts.includes(s.code);
                          return (
                            <button
                              key={s.code}
                              onClick={() => {
                                const newChannelShifts = { ...(bizRules.channelShifts || {}) };
                                const chanShifts = newChannelShifts[ch] || [];
                                newChannelShifts[ch] = chanShifts.includes(s.code)
                                  ? chanShifts.filter(sc => sc !== s.code)
                                  : [...chanShifts, s.code].sort();
                                setBizRules({ ...bizRules, channelShifts: newChannelShifts });
                              }}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'}`}
                            >
                              {s.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-10 max-w-4xl mx-auto">
               <h4 className="m-0 mb-3 text-slate-900 text-lg font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                 <ShieldCheck size={20} className="text-emerald-500" />
                 ACCESS ROLE HIERARCHY
               </h4>
               <p className="text-sm text-slate-500 font-medium relative z-10">Define administrative and operational permissions. Changes to these roles apply globally to all assigned users.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.keys(roles).map(roleName => (
                <div key={roleName} className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden group hover:ring-2 hover:ring-indigo-500/20 transition-all">
                  <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-base">{roleName}</span>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <ShieldCheck size={16} className="text-emerald-500" />
                    </div>
                  </div>
                  <div className="p-8 space-y-8 flex-1">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap size={12} className="text-amber-500" />
                        CAPABILITIES
                      </h4>
                      <div className="space-y-2">
                        {['isAdmin', 'canEditSchedule', 'canSeeAll', 'canSwap'].map(perm => (
                          <label key={perm} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all group/item">
                            <span className="text-xs font-semibold text-slate-700 tracking-tight group-hover/item:text-indigo-700">{perm.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <input 
                              type="checkbox" 
                              checked={roles[roleName][perm] || false}
                              onChange={() => toggleRolePermission(roleName, perm)}
                              className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500 shadow-sm"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Globe size={12} className="text-indigo-400" />
                        SYSTEM VIEWS
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {uiOptions.map(ui => (
                          <label key={ui.code} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-emerald-50 transition-all group/item">
                            <span className="text-xs font-semibold text-slate-600 tracking-tight group-hover/item:text-emerald-700">{ui.label}</span>
                            <input 
                              type="checkbox" 
                              checked={(roles[roleName].allowedUI || []).includes(ui.code)}
                              onChange={() => toggleRoleUI(roleName, ui.code)}
                              className="w-5 h-5 text-emerald-500 rounded-lg border-slate-300 focus:ring-emerald-500 shadow-sm"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Plus size={12} className="text-blue-400" />
                        AUTH ACTIONS
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(settings.activities || {}).map((actCode) => (
                           <label key={actCode} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all">
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
                               className="w-4 h-4 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                             />
                             <span className="text-[10px] font-bold text-slate-600">{actCode}</span>
                           </label>
                        ))}
                         <label className="flex items-center gap-2.5 px-3 py-2 bg-rose-50 rounded-xl cursor-pointer hover:ring-1 hover:ring-rose-300 transition-all">
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
                             className="w-4 h-4 text-rose-600 rounded-md border-slate-300 focus:ring-rose-500"
                           />
                           <span className="text-[10px] font-bold text-rose-700">DEL</span>
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
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-5xl mx-auto">
            <div className="bg-emerald-50/50 p-6 md:p-8 rounded-[2rem] border border-emerald-100 shadow-sm mb-10">
               <h4 className="m-0 mb-3 text-emerald-900 text-lg font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                 <Calendar size={20} className="text-emerald-500" />
                 NATIONAL HOLIDAYS
               </h4>
               <p className="text-sm text-emerald-700 font-medium relative z-10">Define national holidays for accurate workload and schedule calculations. System automatically excludes these dates from normal operations if configured.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {holidays.map((h, i) => (
                <div key={i} className="flex gap-4 items-center bg-white p-5 rounded-2xl border border-slate-100 border-l-4 border-l-emerald-500 shadow-sm transition-all hover:bg-slate-50 group">
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 text-sm">{format(new Date(h.date), 'dd MMM yyyy')}</div>
                    <div className="text-slate-500 text-xs font-medium mt-0.5">{h.desc}</div>
                  </div>
                  <button className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm" onClick={() => setHolidays(holidays.filter((_, idx) => idx !== i))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {holidays.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-16 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 font-medium">No holiday events registered</div>}
            </div>

             <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-lg shadow-slate-100/50">
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quick Addition</h4>
                <button 
                  onClick={() => setShowBulkHol(!showBulkHol)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 shadow-sm"
                >
                  {showBulkHol ? <X size={14} /> : <Database size={14} />}
                  {showBulkHol ? "Single Mode" : "Bulk Import"}
                </button>
              </div>

              {showBulkHol ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-xs text-slate-500 mb-4 px-1 font-medium italic">Format: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">YYYY-MM-DD;Description</span> (one per line)</p>
                  <textarea 
                    className="w-full h-40 p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-400 focus:bg-white transition-all font-mono text-xs mb-6 scrollbar-thin shadow-inner"
                    placeholder="2026-01-01;New Year's Day&#10;2026-12-25;Christmas Day"
                    value={bulkHolText}
                    onChange={e => setBulkHolText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleBulkImportHolidays}
                      className="bg-indigo-600 text-white font-bold px-8 py-3.5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2.5 text-xs active:scale-95"
                    >
                      <Save size={16} />
                      Process Import
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-6 items-end animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-2.5 block px-1">Holiday Date</label>
                    <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all font-bold text-sm shadow-inner" value={newHolDate} onChange={e => setNewHolDate(e.target.value)} />
                  </div>
                  <div className="flex-[2] w-full">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-2.5 block px-1">Description / Event Name</label>
                    <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all text-sm font-semibold shadow-inner" placeholder="Independence Day" value={newHolDesc} onChange={e => setNewHolDesc(e.target.value)} />
                  </div>
                  <button className="w-full sm:w-auto bg-emerald-600 text-white font-bold px-8 py-4 rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3 active:scale-95 whitespace-nowrap" onClick={() => { if(newHolDate && newHolDesc) { setHolidays([...holidays, {date: newHolDate, desc: newHolDesc}]); setNewHolDate(''); setNewHolDesc(''); } }}>
                    <Plus size={20} />
                    Register Event
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'autobreak' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-5xl mx-auto">
            <div className="bg-indigo-50/50 p-6 md:p-8 rounded-[2rem] border border-indigo-100 shadow-sm mb-10">
               <h4 className="m-0 mb-3 text-indigo-900 text-lg font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                 <Utensils size={20} className="text-indigo-600" />
                 FRIDAY PRAYER EXCEPTIONS
               </h4>
               <p className="text-sm text-indigo-700 font-medium relative z-10">Adjust break durations specifically for Friday congregational prayers. The system applies these overrides based on shift codes.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block mb-4 px-1">Normal Friday Duration</label>
                <div className="relative">
                  <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:border-indigo-400 focus:bg-white transition-all" value={fridayBreak?.normal || 90} onChange={e => setFridayBreak({...fridayBreak, normal: parseInt(e.target.value) || 0})} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Minutes</span>
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block mb-4 px-1">Fasting (Ramadan) Friday</label>
                <div className="relative">
                  <input type="number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:border-indigo-400 focus:bg-white transition-all" value={fridayBreak?.puasa || 60} onChange={e => setFridayBreak({...fridayBreak, puasa: parseInt(e.target.value) || 0})} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">Minutes</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-12">
               <h4 className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-4 px-1">Applicable Shift Patterns</h4>
               <input type="text" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner outline-none focus:border-indigo-400 focus:bg-white transition-all text-indigo-600" value={fridayBreak?.shiftCode || 'S2'} onChange={e => setFridayBreak({...fridayBreak, shiftCode: e.target.value})} placeholder="e.g.: S2, S3, OTHERS" />
               <div className="flex items-center gap-2 mt-4 px-2">
                 <AlertCircle size={14} className="text-amber-500" />
                 <p className="text-[11px] text-slate-500 font-medium">Unlisted shift patterns will default to a standard 60-minute prayer window.</p>
               </div>
            </div>

            <div className="mb-6 px-2">
              <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Clock size={16} className="text-indigo-400" />
                Shift Break Intervals (Manual Overrides)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.keys(settings.shifts).map(shiftCode => (
                <div key={shiftCode} className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 group">
                  <div className="font-bold text-slate-900 text-sm mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                      <span>Shift {shiftCode}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{settings.shifts[shiftCode].s} - {settings.shifts[shiftCode].e}</span>
                  </div>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 text-xs font-semibold shadow-sm placeholder:text-slate-300" 
                    value={autoBreakStrings[shiftCode] || ''} 
                    onChange={e => setAutoBreakStrings({...autoBreakStrings, [shiftCode]: e.target.value})} 
                    placeholder="10:00, 11:30, 14:00" 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'puasa' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 max-w-5xl mx-auto">
            <div className="bg-fuchsia-50/50 p-6 md:p-8 rounded-[2rem] mb-10 border border-fuchsia-100 shadow-sm relative overflow-hidden">
               <h4 className="m-0 mb-3 text-fuchsia-900 text-lg font-bold flex items-center gap-2.5 tracking-tight relative z-10">
                 <ShieldCheck size={20} className="text-fuchsia-600" />
                 FASTING PERIOD CONFIG
               </h4>
               <p className="text-sm text-fuchsia-700 font-medium relative z-10">Establish fasting months (e.g., Ramadan) to automatically apply shift hour adjustments and sensitivity policies.</p>
            </div>
            
            <div className="mb-12">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-4 px-2">Active Calendar Events</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {puasa.map((p, i) => (
                  <div key={i} className="flex gap-4 items-center bg-white p-5 rounded-2xl border border-slate-100 border-l-4 border-l-fuchsia-500 shadow-sm transition-all hover:border-fuchsia-200 group">
                    <div className="font-bold text-slate-700 flex-1 text-sm flex items-center gap-3">
                      <span className="text-slate-900">{format(new Date(p.start), 'dd MMM yyyy')}</span>
                      <ArrowLeftRight size={14} className="text-slate-300" />
                      <span className="text-slate-900">{format(new Date(p.end), 'dd MMM yyyy')}</span>
                    </div>
                    <button className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm" onClick={() => setPuasa(puasa.filter((_, idx) => idx !== i))}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {puasa.length === 0 && <div className="col-span-full text-center text-slate-400 text-sm py-16 border-2 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50 font-medium italic">No fasting periods defined</div>}
              </div>

              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-lg shadow-slate-100/50">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6 px-1">Define New Period</h4>
                <div className="flex flex-col sm:flex-row gap-6 items-end">
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-400 mb-2 block px-1">Start Date</label>
                    <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-fuchsia-400 focus:bg-white transition-all font-bold text-sm shadow-inner" value={newPuasaStart} onChange={e => setNewPuasaStart(e.target.value)} />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-400 mb-2 block px-1">End Date</label>
                    <input type="date" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-fuchsia-400 focus:bg-white transition-all font-bold text-sm shadow-inner" value={newPuasaEnd} onChange={e => setNewPuasaEnd(e.target.value)} />
                  </div>
                  <button className="w-full sm:w-auto bg-fuchsia-600 text-white font-bold px-10 py-4 rounded-2xl hover:bg-fuchsia-700 shadow-xl shadow-fuchsia-100 transition-all flex items-center justify-center gap-3 active:scale-95" onClick={() => { if(newPuasaStart && newPuasaEnd) { setPuasa([...puasa, {start: newPuasaStart, end: newPuasaEnd}]); setNewPuasaStart(''); setNewPuasaEnd(''); } }}>
                    <Plus size={20} />
                    Add Period
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-10 border-t border-slate-100">
              <div className="flex flex-col mb-8 px-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fasting Shift Overrides</h4>
                <p className="text-sm text-slate-500 font-medium">Configure automatic scale-back of hours during active fasting dates.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(settings.shifts).map(shiftCode => {
                  const base = settings.shifts[shiftCode];
                  const override = puasaShifts[shiftCode] || {s: '', e: '', b: ''};
                  return (
                    <div key={shiftCode} className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all hover:border-fuchsia-200 group">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-1.5 h-6 bg-fuchsia-400 rounded-full group-hover:h-8 transition-all"></div>
                          <div className="font-bold text-slate-900 text-base">Shift {shiftCode}</div>
                        </div>
                        <div className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 px-3 py-1 rounded-xl">Normal: {base.s} - {base.e}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block px-1">START</label>
                          <input type="time" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold font-mono outline-none focus:border-fuchsia-400 focus:bg-white transition-all" value={override.s} onChange={e => setPuasaShifts({...puasaShifts, [shiftCode]: {...override, s: e.target.value}})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block px-1">END</label>
                          <input type="time" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold font-mono outline-none focus:border-fuchsia-400 focus:bg-white transition-all" value={override.e} onChange={e => setPuasaShifts({...puasaShifts, [shiftCode]: {...override, e: e.target.value}})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block px-1">BREAK</label>
                          <input type="number" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-fuchsia-400 focus:bg-white transition-all" value={override.b} onChange={e => setPuasaShifts({...puasaShifts, [shiftCode]: {...override, b: parseInt(e.target.value) || 0}})} placeholder="min" />
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
