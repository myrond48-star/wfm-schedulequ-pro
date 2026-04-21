import React, { useState } from 'react';
import { useAppStore } from '../lib/store';
import { IntervalView } from './IntervalView';
import { CalendarView } from './CalendarView';
import { AdherenceView } from './AdherenceView';
import { ForecastView } from './ForecastView';
import { UsersDB } from './UsersDB';
import { Settings } from './Settings';
import { SwapModal } from './modals/SwapModal';
import { ApprovalModal } from './modals/ApprovalModal';
import { PublishModal } from './modals/PublishModal';
import { ImportScheduleModal } from './modals/ImportScheduleModal';
import { DeleteRangeModal } from './modals/DeleteRangeModal';
import { ReportAdhModal } from './modals/ReportAdhModal';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { 
  LayoutDashboard, 
  Eye, 
  Clock, 
  Calendar, 
  BarChart3, 
  TrendingUp,
  LineChart,
  Users, 
  ChevronDown,
  FileUp,
  Trash2,
  RefreshCw,
  Zap,
  ArrowLeftRight,
  Send,
  FileSpreadsheet,
  FileText,
  Utensils,
  Settings as SettingsIcon,
  Printer,
  Search
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, logout, settings } = useAppStore();
  const [currentView, setCurrentView] = useState<'interval' | 'calendar' | 'adherence' | 'forecast' | 'users' | 'settings'>('interval');
  const [channel, setChannel] = useState(user?.channel || 'Call');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortBy, setSortBy] = useState('interval');
  const [filterTL, setFilterTL] = useState('');
  const [search, setSearch] = useState('');
  
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  
  const [showSwap, setShowSwap] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteRange, setShowDeleteRange] = useState(false);
  const [showReportAdh, setShowReportAdh] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [leaders, setLeaders] = useState<string[]>([]);

  const roleConf = settings.roles[user?.role || 'Agent'] || { isAdmin: false, allowedUI: [] };
  const masterKey = roleConf.isAdmin || user?.role === 'Admin' || user?.nama === 'Ronald';
  const ui = roleConf.allowedUI || [];
  
  React.useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const res = await import('../lib/supabase').then(m => m.callSupabaseAPI('wfm_agents', 'GET', undefined, `?role=eq.Leader&select=nama`));
        if (res) {
          setLeaders(Array.from(new Set(res.map((t: any) => t.nama))).sort());
        }
      } catch (err) {
        console.error("Failed to fetch leaders:", err);
      }
    };
    fetchLeaders();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#6755f2] p-4 box-border overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1.5 mb-2 items-center bg-white p-2 px-3 rounded-2xl shadow-md overflow-visible relative z-[9999]">
        
        {/* View Dropdown */}
        <div className="relative group flex-shrink-0">
          <button className="px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-1.5 min-w-[100px] justify-between">
            <div className="flex items-center gap-1.5">
              <Eye size={14} />
              <span>View</span>
            </div>
            <ChevronDown size={12} />
          </button>
          <div className="absolute hidden group-hover:flex flex-col gap-1 bg-white min-w-[170px] shadow-xl rounded-xl z-[1000] p-2 top-full mt-1 left-0 border border-slate-200 before:content-[''] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2">
            {(masterKey || ui.includes('viewInt')) && (
              <button onClick={() => setCurrentView('interval')} className={`p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 ${currentView === 'interval' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                <Clock size={14} />
                Interval
              </button>
            )}
            {(masterKey || ui.includes('viewCal')) && (
              <button onClick={() => setCurrentView('calendar')} className={`p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 ${currentView === 'calendar' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                <Calendar size={14} />
                Calendar
              </button>
            )}
            {(masterKey || ui.includes('viewAdh')) && (
              <button onClick={() => setCurrentView('adherence')} className={`p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 ${currentView === 'adherence' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                <BarChart3 size={14} />
                Adherence
              </button>
            )}
            {(masterKey || ui.includes('viewFor')) && (
              <button onClick={() => setCurrentView('forecast')} className={`p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 ${currentView === 'forecast' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                <LineChart size={14} />
                Forecast
              </button>
            )}
            {masterKey && (
              <button onClick={() => setCurrentView('users')} className={`p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 ${currentView === 'users' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600'}`}>
                <Users size={14} />
                Users DB
              </button>
            )}
            {(masterKey || ui.includes('btnSys')) && (
              <button onClick={() => setCurrentView('settings')} className={`p-2.5 border-none bg-transparent cursor-pointer text-xs font-bold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 ${currentView === 'settings' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}>
                <SettingsIcon size={14} />
                System Settings
              </button>
            )}
          </div>
        </div>

        {/* Channel Dropdown */}
        {currentView !== 'users' && (
          <select 
            value={channel} 
            onChange={(e) => setChannel(e.target.value)}
            className="px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all flex-shrink-0 outline-none"
          >
            {settings.channels.map(ch => (
              <option key={ch} value={ch}>{ch}</option>
            ))}
          </select>
        )}

        {/* Date Picker */}
        {currentView !== 'calendar' && currentView !== 'users' && currentView !== 'forecast' && currentView !== 'settings' && (
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all flex-shrink-0 outline-none w-[110px]"
          />
        )}

        {/* Global Filters - Hidden for Forecast, Users, and Settings Views */}
        {currentView !== 'forecast' && currentView !== 'users' && currentView !== 'settings' && (
          <>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all flex-shrink-0 outline-none max-w-[120px]"
            >
              <option value="interval">Sort: Interval</option>
              <option value="nama">Sort: Name (A-Z)</option>
            </select>

            <select 
              value={filterTL} 
              onChange={(e) => setFilterTL(e.target.value)}
              className="px-2 py-1.5 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all flex-shrink-0 outline-none max-w-[120px]"
            >
              <option value="">All Leaders</option>
              {leaders.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <div className="relative flex-shrink-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all outline-none focus:border-indigo-500 w-[140px]"
              />
            </div>
          </>
        )}

        {/* Date Range Picker for Calendar */}
        {currentView === 'calendar' && (
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all flex-shrink-0 outline-none"
            />
            <span className="text-xs font-bold text-slate-500">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-all flex-shrink-0 outline-none"
            />
          </div>
        )}

        {/* Actions Dropdown */}
        {currentView !== 'users' && currentView !== 'forecast' && (
          <div className="relative group flex-shrink-0">
            <button className="px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex items-center gap-1.5 min-w-[100px] justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500" />
                <span>Actions</span>
              </div>
              <ChevronDown size={12} />
            </button>
            <div className="absolute hidden group-hover:flex flex-col gap-1 bg-white min-w-[170px] shadow-xl rounded-xl z-[1000] p-2 top-full mt-1 left-0 border border-slate-200 before:content-[''] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2">
              <button 
                onClick={() => setRefreshKey(prev => prev + 1)}
                className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-slate-600"
              >
                <RefreshCw size={14} />
                Refresh Data
              </button>
              <button onClick={() => setShowSwap(true)} className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-indigo-600">
                <ArrowLeftRight size={14} />
                Swap Shift
              </button>
              {(masterKey || ui.includes('btnApp')) && (
                <button onClick={() => setShowApproval(true)} className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-amber-600">
                  <FileText size={14} />
                  Approvals
                </button>
              )}
              {(masterKey || ui.includes('btnPub')) && (
                <button onClick={() => setShowPublish(true)} className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-orange-600">
                  <Send size={14} />
                  Publish Schedule
                </button>
              )}
              <button onClick={() => setShowReportAdh(true)} className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-sky-600">
                <BarChart3 size={14} />
                Export Adherence
              </button>
              <button className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-emerald-600">
                <FileSpreadsheet size={14} />
                Export Excel
              </button>
              {(masterKey || ui.includes('btnBrk')) && currentView === 'interval' && (
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('wfm-trigger-breakmanager'))} 
                  className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-indigo-600 font-bold"
                >
                  <Utensils size={14} />
                  Manage Breaks
                </button>
              )}
              <button className="p-2.5 border-none bg-transparent cursor-pointer text-xs font-semibold text-left rounded-lg flex items-center gap-2 transition-all hover:bg-slate-50 hover:pl-4 text-rose-600">
                <Printer size={14} />
                Print/Save PDF
              </button>
            </div>
          </div>
        )}

        {/* Right side user info */}
        <div className="flex items-center gap-4 ml-auto flex-shrink-0">
          {/* Notifications */}
          <div className="relative group">
            <button className="p-1 border-none bg-transparent cursor-pointer text-lg relative">
              🔔
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                0
              </span>
            </button>
            <div className="absolute hidden group-hover:flex flex-col bg-white w-[280px] shadow-xl rounded-xl z-[1000] top-[calc(100%+5px)] right-0 border border-slate-200 overflow-hidden">
              <div className="p-3 font-bold border-b border-slate-200 bg-slate-50 text-xs text-slate-800">
                📬 Swap Notifications
              </div>
              <div className="p-3 text-xs text-slate-500 text-center">
                No swap requests yet.
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>{user?.nama}</span>
            <span className="text-slate-500 font-normal ml-1">{user?.role}</span>
          </div>
          <button onClick={logout} className="px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden relative animate-in fade-in duration-300">
        {!settings.apiUrl || !settings.apiKey ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center">
            <div className="text-6xl mb-4">🔌</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Database API Not Configured</h2>
            <p className="text-slate-500 max-w-md mb-6">
              Please go to <b>System Settings &gt; Database API</b> to enter your Supabase URL and Key so the application can function normally.
            </p>
            <button 
              onClick={() => setCurrentView('settings')}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              Open API Settings
            </button>
          </div>
        ) : (
          <>
            {currentView === 'interval' && <IntervalView key={refreshKey} channel={channel} date={date} sortBy={sortBy} filterTL={filterTL} search={search} />}
            {currentView === 'calendar' && <CalendarView key={refreshKey} channel={channel} startDate={startDate} endDate={endDate} sortBy={sortBy} filterTL={filterTL} search={search} />}
            {currentView === 'adherence' && <AdherenceView key={refreshKey} channel={channel} date={date} sortBy={sortBy} filterTL={filterTL} search={search} />}
            {currentView === 'forecast' && <ForecastView channel={channel} />}
            {currentView === 'users' && <UsersDB key={refreshKey} search={search} />}
            {currentView === 'settings' && <Settings />}
          </>
        )}
      </div>

      {/* Modals */}
      {showSwap && <SwapModal onClose={() => setShowSwap(false)} channel={channel} date={date} />}
      {showApproval && <ApprovalModal onClose={() => setShowApproval(false)} />}
      {showPublish && <PublishModal onClose={() => setShowPublish(false)} channel={channel} date={date} />}
      {showImport && <ImportScheduleModal onClose={() => setShowImport(false)} />}
      {showDeleteRange && <DeleteRangeModal onClose={() => setShowDeleteRange(false)} channel={channel} />}
      {showReportAdh && <ReportAdhModal onClose={() => setShowReportAdh(false)} channel={channel} date={date} />}
    </div>
  );
};
