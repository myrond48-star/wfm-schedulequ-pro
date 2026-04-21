import React, { createContext, useContext, useState, useEffect } from 'react';

export interface SystemSettings {
  apiUrl: string;
  apiKey: string;
  adhId: string;
  channels: string[];
  shifts: Record<string, any>;
  holidays: Record<string, string>;
  autoBreak: Record<string, any>;
  fridayBreak: any;
  puasa: any[];
  puasaShifts: Record<string, any>;
  roles: Record<string, any>;
  publishStatus: Record<string, any>;
  bizRules: {
    operatingHours: Record<string, { start: string; end: string; closed: boolean }>;
    weekendDays: number[];
    holidayClosed: boolean;
  };
}

export interface User {
  nik: string;
  nama: string;
  username: string;
  role: string;
  channel: string;
  status: string;
}

interface AppState {
  user: User | null;
  settings: SystemSettings;
  login: (userData: User) => void;
  logout: () => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
}

const defaultSettings: SystemSettings = {
  apiUrl: localStorage.getItem('SUPABASE_URL') || '',
  apiKey: localStorage.getItem('SUPABASE_KEY') || '',
  adhId: localStorage.getItem('ADH_SS_ID') || '',
  channels: JSON.parse(localStorage.getItem('WFM_CHANNELS') || '["Call", "Digital Chat", "Email", "Leader"]'),
  shifts: JSON.parse(localStorage.getItem('WFM_SHIFT_MAP') || '{"S1":{"s":"06:00","e":"15:00","w":1},"H":{"s":"07:45","e":"16:45","w":1.5},"S2":{"s":"08:00","e":"17:00","w":2},"S3":{"s":"13:00","e":"22:00","w":3},"S4":{"s":"22:00","e":"07:00","w":4}}'),
  holidays: JSON.parse(localStorage.getItem('WFM_HOLIDAYS') || '{}'),
  autoBreak: JSON.parse(localStorage.getItem('WFM_AUTO_BREAK') || '{}'),
  fridayBreak: JSON.parse(localStorage.getItem('WFM_FRIDAY_BREAK') || '{"normal":90,"puasa":60}'),
  puasa: JSON.parse(localStorage.getItem('WFM_PUASA') || '[]'),
  puasaShifts: JSON.parse(localStorage.getItem('WFM_PUASA_SHIFTS') || '{}'),
  roles: JSON.parse(localStorage.getItem('WFM_ROLES') || '{"Agent":{"canSwap":true,"isAdmin":false,"canEditSchedule":false,"canSeeAll":false,"allowedActivities":[],"allowedUI":["viewInt","viewCal","viewAdh"]},"Leader":{"canSwap":true,"isAdmin":false,"canEditSchedule":true,"canSeeAll":true,"allowedActivities":["MT","CT","PR","SK","AL"],"allowedUI":["viewInt","viewCal","viewAdh","btnApp"]},"Admin":{"canSwap":true,"isAdmin":true,"canEditSchedule":true,"canSeeAll":true,"allowedActivities":["MT","CT","PR","SK","AL","SB","LB","REMOVE"],"allowedUI":["viewInt","viewCal","viewAdh","viewFor","btnApp","btnBrk","btnSync","btnSys","btnImp","btnPub"]}}'),
  publishStatus: JSON.parse(localStorage.getItem('WFM_PUBLISH_STATUS') || '{}'),
  bizRules: JSON.parse(localStorage.getItem('WFM_BIZ_RULES') || '{"operatingHours":{},"weekendDays":[0,6],"holidayClosed":true}'),
};

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);

  useEffect(() => {
    const savedUser = localStorage.getItem('wfm_user');
    if (savedUser) {
      setUser({
        username: savedUser,
        nama: localStorage.getItem('wfm_nama') || savedUser,
        nik: localStorage.getItem('wfm_nik') || '',
        role: localStorage.getItem('wfm_role') || '',
        channel: localStorage.getItem('wfm_channel') || '',
        status: localStorage.getItem('wfm_status') || '',
      });
    }
  }, []);

  const login = (userData: User) => {
    localStorage.setItem('wfm_user', userData.username);
    localStorage.setItem('wfm_nama', userData.nama);
    localStorage.setItem('wfm_nik', userData.nik);
    localStorage.setItem('wfm_role', userData.role);
    localStorage.setItem('wfm_channel', userData.channel);
    localStorage.setItem('wfm_status', userData.status);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('wfm_user');
    localStorage.removeItem('wfm_nama');
    localStorage.removeItem('wfm_nik');
    localStorage.removeItem('wfm_role');
    localStorage.removeItem('wfm_channel');
    localStorage.removeItem('wfm_status');
    setUser(null);
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      // Save to localStorage
      if (newSettings.apiUrl !== undefined) localStorage.setItem('SUPABASE_URL', newSettings.apiUrl);
      if (newSettings.apiKey !== undefined) localStorage.setItem('SUPABASE_KEY', newSettings.apiKey);
      if (newSettings.adhId !== undefined) localStorage.setItem('ADH_SS_ID', newSettings.adhId);
      if (newSettings.channels !== undefined) localStorage.setItem('WFM_CHANNELS', JSON.stringify(newSettings.channels));
      if (newSettings.shifts !== undefined) localStorage.setItem('WFM_SHIFT_MAP', JSON.stringify(newSettings.shifts));
      if (newSettings.holidays !== undefined) localStorage.setItem('WFM_HOLIDAYS', JSON.stringify(newSettings.holidays));
      if (newSettings.autoBreak !== undefined) localStorage.setItem('WFM_AUTO_BREAK', JSON.stringify(newSettings.autoBreak));
      if (newSettings.fridayBreak !== undefined) localStorage.setItem('WFM_FRIDAY_BREAK', JSON.stringify(newSettings.fridayBreak));
      if (newSettings.puasa !== undefined) localStorage.setItem('WFM_PUASA', JSON.stringify(newSettings.puasa));
      if (newSettings.puasaShifts !== undefined) localStorage.setItem('WFM_PUASA_SHIFTS', JSON.stringify(newSettings.puasaShifts));
      if (newSettings.roles !== undefined) localStorage.setItem('WFM_ROLES', JSON.stringify(newSettings.roles));
      if (newSettings.publishStatus !== undefined) localStorage.setItem('WFM_PUBLISH_STATUS', JSON.stringify(newSettings.publishStatus));
      if (newSettings.bizRules !== undefined) localStorage.setItem('WFM_BIZ_RULES', JSON.stringify(newSettings.bizRules));
      return updated;
    });
  };

  return (
    <AppContext.Provider value={{ user, settings, login, logout, updateSettings }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
};
