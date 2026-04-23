import React, { useState, useRef } from 'react';
import { useAppStore } from '../lib/store';
import { IntervalView } from './IntervalView';
import { CalendarView } from './CalendarView';
import { AdherenceView } from './AdherenceView';
import { ForecastView } from './ForecastView';
import { UsersDB } from './UsersDB';
import { Settings } from './Settings';
import { AboutView } from './AboutView';
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
  Info,
  Printer,
  Search,
  LogOut,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Dashboard: React.FC = () => {
  const { user, logout, settings } = useAppStore();
  const [currentView, setCurrentView] = useState<'interval' | 'calendar' | 'adherence' | 'forecast' | 'users' | 'settings' | 'about'>('interval');
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

  const userRole = user?.role || 'Agent';
  const roleConf = settings.roles[userRole] || 
                   Object.entries(settings.roles).find(([k]) => k.toLowerCase() === userRole.toLowerCase())?.[1] ||
                   { isAdmin: false, allowedUI: [] };
  const masterKey = roleConf.isAdmin || 
                    userRole.toLowerCase() === 'admin' || 
                    user?.nama === 'Ronald' || 
                    user?.nama === 'ronald' ||
                    user?.username === 'admin';
  const ui = roleConf.allowedUI || [];
  
  React.useEffect(() => {
    const fetchLeaders = async () => {
      try {
        let query = `?channel=eq.${encodeURIComponent(channel)}&select=tl`;
        if (currentView === 'calendar') {
          query += `&date=gte.${startDate}&date=lte.${endDate}`;
        } else {
          query += `&date=eq.${date}`;
        }
        
        const res = await import('../lib/supabase').then(m => m.callSupabaseAPI('wfm_schedules', 'GET', undefined, query));
        if (res) {
          const newList = Array.from(new Set(res.map((t: any) => t.tl).filter(Boolean))).sort() as string[];
          setLeaders(newList);
          if (filterTL && !newList.includes(filterTL)) {
            setFilterTL('');
          }
        }
      } catch (err: any) {
        if (!err.message?.includes('Database API not configured')) {
           console.error("Failed to fetch leaders:", err);
        }
      }
    };
    fetchLeaders();
  }, [channel, date, startDate, endDate, currentView, refreshKey]);

  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Hover refs to prevent flickering
  const viewTimeout = useRef<any>(null);
  const actionTimeout = useRef<any>(null);
  const notifTimeout = useRef<any>(null);

  const handleHover = (type: 'view' | 'action' | 'notif', enter: boolean) => {
    if (enter) {
      if (type === 'view') {
        if (viewTimeout.current) clearTimeout(viewTimeout.current);
        setShowViewDropdown(true);
        setShowActionsDropdown(false);
        setShowNotifDropdown(false);
      } else if (type === 'action') {
        if (actionTimeout.current) clearTimeout(actionTimeout.current);
        setShowActionsDropdown(true);
        setShowViewDropdown(false);
        setShowNotifDropdown(false);
      } else if (type === 'notif') {
        if (notifTimeout.current) clearTimeout(notifTimeout.current);
        setShowNotifDropdown(true);
        setShowViewDropdown(false);
        setShowActionsDropdown(false);
      }
    } else {
      if (type === 'view') {
        viewTimeout.current = setTimeout(() => setShowViewDropdown(false), 200);
      } else if (type === 'action') {
        actionTimeout.current = setTimeout(() => setShowActionsDropdown(false), 200);
      } else if (type === 'notif') {
        notifTimeout.current = setTimeout(() => setShowNotifDropdown(false), 200);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#6755f2] p-1.5 sm:p-4 box-border overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="flex flex-row flex-wrap lg:flex-nowrap items-center gap-x-2 gap-y-1.5 mb-2 bg-white p-1.5 sm:px-3 rounded-2xl shadow-md relative z-[10000]">
        
        {/* Left Side: Navigation */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap flex-shrink-0">
          {/* View Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => handleHover('view', true)}
            onMouseLeave={() => handleHover('view', false)}
          >
            <button 
              onClick={() => {
                setShowViewDropdown(!showViewDropdown);
                setShowActionsDropdown(false);
                setShowNotifDropdown(false);
              }}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5 min-w-[70px] sm:min-w-[90px] justify-between"
            >
              <div className="flex items-center gap-1.5">
                <Eye size={12} className="sm:w-[14px] sm:h-[14px]" />
                <span>View</span>
              </div>
              <ChevronDown size={10} className={`transition-transform duration-200 ${showViewDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showViewDropdown && (
                <>
                  <div className="fixed inset-0 z-[999] lg:hidden" onClick={() => setShowViewDropdown(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute flex flex-col gap-0.5 bg-white min-w-[150px] sm:min-w-[170px] shadow-2xl rounded-xl z-[1001] p-1.5 top-full mt-1.5 left-0 border border-slate-100"
                  >
                    {(masterKey || ui.includes('viewInt')) && (
                      <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => { setCurrentView('interval'); setShowViewDropdown(false); }} 
                        className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'interval' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                      >
                        <Clock size={13} />
                        Interval
                      </motion.button>
                    )}
                    {(masterKey || ui.includes('viewCal')) && (
                      <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => { setCurrentView('calendar'); setShowViewDropdown(false); }} 
                        className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'calendar' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                      >
                        <Calendar size={13} />
                        Calendar
                      </motion.button>
                    )}
                    {(masterKey || ui.includes('viewAdh')) && (
                      <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => { setCurrentView('adherence'); setShowViewDropdown(false); }} 
                        className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'adherence' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                      >
                        <BarChart3 size={13} />
                        Adherence
                      </motion.button>
                    )}
                    {(masterKey || ui.includes('viewFor')) && (
                      <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => { setCurrentView('forecast'); setShowViewDropdown(false); }} 
                        className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'forecast' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}>
                        <LineChart size={13} />
                        Forecast
                      </motion.button>
                    )}
                    {masterKey && (
                      <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => { setCurrentView('users'); setShowViewDropdown(false); }} 
                        className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'users' ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-600'}`}>
                        <Users size={13} />
                        Users DB
                      </motion.button>
                    )}
                    {(masterKey || ui.includes('btnSys')) && (
                      <motion.button 
                        whileHover={{ x: 4 }}
                        onClick={() => { setCurrentView('settings'); setShowViewDropdown(false); }} 
                        className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'settings' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}>
                        <SettingsIcon size={13} />
                        Settings
                      </motion.button>
                    )}
                    <motion.button 
                      whileHover={{ x: 4 }}
                      onClick={() => { setCurrentView('about'); setShowViewDropdown(false); }} 
                      className={`p-2 sm:p-2.5 border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 ${currentView === 'about' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}>
                      <Info size={13} />
                      About
                    </motion.button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Center: Context Filters (Scrollable on small screens) */}
        <div className="flex-1 flex overflow-x-auto sm:overflow-visible pb-0.5 sm:pb-0 gap-1.5 items-center scrollbar-none sm:scrollbar-thin">
          {currentView !== 'users' && currentView !== 'settings' && currentView !== 'about' && (
            <select 
              value={channel} 
              onChange={(e) => setChannel(e.target.value)}
              className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex-shrink-0 outline-none max-w-[100px] sm:max-w-[110px]"
            >
              {settings.channels.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          )}

          {currentView === 'calendar' && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white outline-none w-[105px] sm:w-[110px]"
              />
              <span className="text-[9px] font-bold text-slate-400 uppercase">to</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white outline-none w-[105px] sm:w-[110px]"
              />
            </div>
          )}

          {currentView !== 'calendar' && currentView !== 'users' && currentView !== 'forecast' && currentView !== 'settings' && currentView !== 'about' && (
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex-shrink-0 outline-none w-[110px] sm:w-[115px]"
            />
          )}

          {currentView !== 'forecast' && currentView !== 'settings' && currentView !== 'about' && (
            <>
              {currentView !== 'users' && (
                <>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex-shrink-0 outline-none w-[95px] sm:w-[110px]"
                  >
                    <option value="interval">Sort: Intv</option>
                    <option value="nama">Sort: Name</option>
                  </select>

                  <select 
                    value={filterTL} 
                    onChange={(e) => setFilterTL(e.target.value)}
                    className="px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex-shrink-0 outline-none max-w-[100px] sm:max-w-[120px]"
                  >
                    <option value="">All TL</option>
                    {leaders.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </>
              )}

              {currentView !== 'about' && (
                <div className="relative flex-shrink-0">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 sm:w-[14px] sm:h-[14px] sm:left-2.5" />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 sm:pl-8 pr-2 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors outline-none focus:border-indigo-500 w-[110px] sm:w-[130px]"
                  />
                </div>
              )}

              {/* Actions Dropdown (Moved after Search) */}
              {(masterKey || ui.includes('btnAct')) && currentView !== 'users' && currentView !== 'forecast' && currentView !== 'settings' && currentView !== 'about' && (
                <div 
                  className="relative"
                  onMouseEnter={() => handleHover('action', true)}
                  onMouseLeave={() => handleHover('action', false)}
                >
                  <button 
                    onClick={() => {
                      setShowActionsDropdown(!showActionsDropdown);
                      setShowViewDropdown(false);
                      setShowNotifDropdown(false);
                    }}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl cursor-pointer text-[10px] sm:text-xs font-semibold border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center gap-1.5 min-w-[70px] sm:min-w-[90px] justify-between"
                  >
                    <div className="flex items-center gap-1.5">
                      <Zap size={12} className="text-amber-500 sm:w-[14px] sm:h-[14px]" />
                      <span>Actions</span>
                    </div>
                    <ChevronDown size={10} className={`transition-transform duration-200 ${showActionsDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                <AnimatePresence>
                  {showActionsDropdown && (
                    <>
                      <div className="fixed inset-0 z-[999] lg:hidden" onClick={() => setShowActionsDropdown(false)}></div>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.96, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -8 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute flex flex-col bg-white w-[180px] sm:w-[200px] shadow-2xl rounded-xl z-[1001] top-full mt-1.5 left-0 border border-slate-100 p-1.5"
                      >
                        
                        {/* Common: Refresh */}
                        <motion.button 
                          whileHover={{ x: 4 }}
                          onClick={() => { setRefreshKey(prev => prev + 1); setShowActionsDropdown(false); }}
                          className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-slate-600"
                        >
                          <RefreshCw size={13} className="text-slate-500" />
                          Refresh Data
                        </motion.button>

                        {/* Shared: Swap Shift (Interval & Calendar) */}
                        {(currentView === 'interval' || currentView === 'calendar') && (masterKey || ui.includes('btnSwp')) && (
                          <motion.button 
                            whileHover={{ x: 4 }}
                            onClick={() => { setShowSwap(true); setShowActionsDropdown(false); }} 
                            className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-indigo-600"
                          >
                            <ArrowLeftRight size={13} className="text-indigo-500" />
                            Swap Shift
                          </motion.button>
                        )}

                        {/* Shared: Approvals (Interval & Calendar) */}
                        {(currentView === 'interval' || currentView === 'calendar') && (masterKey || ui.includes('btnApp')) && (
                          <motion.button 
                            whileHover={{ x: 4 }}
                            onClick={() => { setShowApproval(true); setShowActionsDropdown(false); }} 
                            className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-amber-600"
                          >
                            <FileText size={13} className="text-amber-500" />
                            Approvals
                          </motion.button>
                        )}

                        {/* Calendar Specific */}
                        {currentView === 'calendar' && (
                          <>
                            {(masterKey || ui.includes('btnPub')) && (
                              <motion.button 
                                whileHover={{ x: 4 }}
                                onClick={() => { setShowPublish(true); setShowActionsDropdown(false); }} 
                                className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-sky-600"
                              >
                                <Send size={13} className="text-sky-500" />
                                Publish Schedule
                              </motion.button>
                            )}
                            <motion.button 
                              whileHover={{ x: 4 }}
                              onClick={() => {
                                // Trigger calendar export
                                window.dispatchEvent(new CustomEvent('wfm-calendar-export'));
                                setShowActionsDropdown(false);
                              }}
                              className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-emerald-600"
                            >
                              <FileSpreadsheet size={13} className="text-emerald-500" />
                              Export Excel
                            </motion.button>
                          </>
                        )}

                        {/* Interval Specific */}
                        {currentView === 'interval' && (
                          <>
                            {(masterKey || ui.includes('btnBrk')) && (
                              <motion.button 
                                whileHover={{ x: 4 }}
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('wfm-trigger-breakmanager'));
                                  setShowActionsDropdown(false);
                                }} 
                                className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-indigo-600"
                              >
                                <Utensils size={13} className="text-indigo-600" />
                                Manage Breaks
                              </motion.button>
                            )}
                          </>
                        )}

                        {/* Adherence Specific */}
                        {currentView === 'adherence' && (
                          <motion.button 
                            whileHover={{ x: 4 }}
                            onClick={() => { setShowReportAdh(true); setShowActionsDropdown(false); }}
                            className="p-2 sm:p-2.5 w-full border-none bg-transparent cursor-pointer text-[10px] sm:text-xs font-normal text-left rounded-lg flex items-center gap-2 transition-colors duration-200 hover:bg-slate-50 text-emerald-600"
                          >
                            <BarChart3 size={13} className="text-emerald-500" />
                            Export Adherence
                          </motion.button>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right Side: Notif & User */}
        <div className="flex items-center gap-2 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-100 lg:ml-auto justify-between lg:justify-end flex-shrink-0">
          {/* Notifications */}
          <div 
            className="relative"
            onMouseEnter={() => handleHover('notif', true)}
            onMouseLeave={() => handleHover('notif', false)}
          >
            <button 
              onClick={() => {
                setShowNotifDropdown(!showNotifDropdown);
                setShowViewDropdown(false);
                setShowActionsDropdown(false);
              }}
              className="p-2 border-none bg-slate-100 rounded-xl cursor-pointer text-slate-600 relative hover:bg-slate-200 transition-all"
            >
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full border-2 border-white">
                0
              </span>
            </button>
            
            {showNotifDropdown && (
              <>
                <div className="fixed inset-0 z-[999] lg:hidden" onClick={() => setShowNotifDropdown(false)}></div>
                <div className="absolute flex flex-col bg-white w-[280px] shadow-2xl rounded-2xl z-[1001] top-full mt-2 right-0 border border-slate-100 overflow-hidden">
                  <div className="p-3.5 font-bold border-b border-slate-100 bg-slate-50/50 text-[11px] text-slate-800 uppercase tracking-wider">
                    📬 Swap Notifications
                  </div>
                  <div className="p-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Send size={24} className="opacity-20" />
                    <p className="text-[10px] font-medium italic">No swap requests currently</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[120px]">{user?.nama}</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter leading-none">{user?.role}</span>
            </div>
            <button 
              onClick={logout} 
              title="Logout"
              className="p-2 rounded-xl cursor-pointer border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative animate-in fade-in duration-300">
        {(!settings.apiUrl || !settings.apiKey) && currentView !== 'settings' ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center">
            <div className="text-6xl mb-4 grayscale opacity-20">🔌</div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Database API Not Configured</h2>
            <p className="text-slate-500 max-w-sm mb-6 text-sm">
              Connect your application to Supabase to start managing schedules and monitoring adherence.
            </p>
            <button 
              onClick={() => setCurrentView('settings')}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
            >
              <SettingsIcon size={18} />
              Open API Settings
            </button>
          </div>
        ) : (
          <div className="h-full w-full relative">
            {currentView === 'interval' && <IntervalView key={refreshKey} channel={channel} date={date} sortBy={sortBy} filterTL={filterTL} search={search} />}
            {currentView === 'calendar' && <CalendarView key={refreshKey} channel={channel} startDate={startDate} endDate={endDate} sortBy={sortBy} filterTL={filterTL} search={search} />}
            {currentView === 'adherence' && <AdherenceView key={refreshKey} channel={channel} date={date} sortBy={sortBy} filterTL={filterTL} search={search} />}
            {currentView === 'forecast' && <ForecastView channel={channel} />}
            {currentView === 'users' && <UsersDB key={refreshKey} search={search} />}
            {currentView === 'settings' && <Settings />}
            {currentView === 'about' && <AboutView />}
          </div>
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
