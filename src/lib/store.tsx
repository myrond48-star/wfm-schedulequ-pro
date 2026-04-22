import React, { createContext, useContext, useState, useEffect } from 'react';

import { callSupabaseAPI } from './supabase';

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

const getEnvOrLocal = (key: string, envKey: string, defaultValue: string) => {
  // Vite env takes priority for baked-in deployments
  const envVal = (import.meta as any).env[envKey];
  if (envVal) return envVal;
  return localStorage.getItem(key) || defaultValue;
};

const getEnvOrLocalJSON = (key: string, envKey: string, defaultValue: string) => {
  const val = getEnvOrLocal(key, envKey, '');
  if (!val) return JSON.parse(defaultValue);
  try {
    return JSON.parse(val);
  } catch {
    return JSON.parse(defaultValue);
  }
};

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
  updateSettings: (newSettings: Partial<SystemSettings>, skipSync?: boolean) => void;
  syncSettingsFromDB: () => Promise<void>;
}

const defaultSettings: SystemSettings = {
  apiUrl: getEnvOrLocal('SUPABASE_URL', 'VITE_SUPABASE_URL', ''),
  apiKey: getEnvOrLocal('SUPABASE_KEY', 'VITE_SUPABASE_KEY', ''),
  adhId: getEnvOrLocal('ADH_SS_ID', 'VITE_ADH_SS_ID', ''),
  channels: getEnvOrLocalJSON('WFM_CHANNELS', 'VITE_WFM_CHANNELS', '["Call", "Digital Chat", "Email", "Leader"]'),
  shifts: getEnvOrLocalJSON('WFM_SHIFT_MAP', 'VITE_WFM_SHIFT_MAP', '{"S1":{"s":"06:00","e":"15:00","w":1},"H":{"s":"07:45","e":"16:45","w":1.5},"S2":{"s":"08:00","e":"17:00","w":2},"S3":{"s":"13:00","e":"22:00","w":3},"S4":{"s":"22:00","e":"07:00","w":4}}'),
  holidays: getEnvOrLocalJSON('WFM_HOLIDAYS', 'VITE_WFM_HOLIDAYS', '{}'),
  autoBreak: getEnvOrLocalJSON('WFM_AUTO_BREAK', 'VITE_WFM_AUTO_BREAK', '{}'),
  fridayBreak: getEnvOrLocalJSON('WFM_FRIDAY_BREAK', 'VITE_WFM_FRIDAY_BREAK', '{"normal":90,"puasa":60}'),
  puasa: getEnvOrLocalJSON('WFM_PUASA', 'VITE_WFM_PUASA', '[]'),
  puasaShifts: getEnvOrLocalJSON('WFM_PUASA_SHIFTS', 'VITE_WFM_PUASA_SHIFTS', '{}'),
  roles: getEnvOrLocalJSON('WFM_ROLES', 'VITE_WFM_ROLES', '{"Agent":{"canSwap":true,"isAdmin":false,"canEditSchedule":false,"canSeeAll":false,"allowedActivities":[],"allowedUI":["viewInt","viewCal","viewAdh"]},"Leader":{"canSwap":true,"isAdmin":false,"canEditSchedule":true,"canSeeAll":true,"allowedActivities":["MT","CT","PR","SK","AL"],"allowedUI":["viewInt","viewCal","viewAdh","btnApp"]},"Admin":{"canSwap":true,"isAdmin":true,"canEditSchedule":true,"canSeeAll":true,"allowedActivities":["MT","CT","PR","SK","AL","SB","LB","REMOVE"],"allowedUI":["viewInt","viewCal","viewAdh","viewFor","btnApp","btnBrk","btnSync","btnSys","btnImp","btnPub"]}}'),
  publishStatus: getEnvOrLocalJSON('WFM_PUBLISH_STATUS', 'VITE_WFM_PUBLISH_STATUS', '{}'),
  bizRules: getEnvOrLocalJSON('WFM_BIZ_RULES', 'VITE_WFM_BIZ_RULES', '{"operatingHours":{},"weekendDays":[0,6],"holidayClosed":true}'),
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
    
    // Attempt to sync from Cloud if DB is ready
    if (settings.apiUrl && settings.apiKey) {
      syncSettingsFromDB();
    }
  }, []);

  const syncSettingsFromDB = async () => {
    try {
      const data = await callSupabaseAPI('wfm_config', 'GET', undefined, '?select=*');
      if (data && data.length > 0) {
        const cloudSettings: Partial<SystemSettings> = {};
        data.forEach((row: any) => {
          try {
            const val = JSON.parse(row.value);
            if (row.key === 'WFM_CHANNELS') cloudSettings.channels = val;
            if (row.key === 'WFM_SHIFT_MAP') cloudSettings.shifts = val;
            if (row.key === 'WFM_HOLIDAYS') cloudSettings.holidays = val;
            if (row.key === 'WFM_AUTO_BREAK') cloudSettings.autoBreak = val;
            if (row.key === 'WFM_FRIDAY_BREAK') cloudSettings.fridayBreak = val;
            if (row.key === 'WFM_PUASA') cloudSettings.puasa = val;
            if (row.key === 'WFM_PUASA_SHIFTS') cloudSettings.puasaShifts = val;
            if (row.key === 'WFM_ROLES') cloudSettings.roles = val;
            if (row.key === 'WFM_BIZ_RULES') cloudSettings.bizRules = val;
            if (row.key === 'ADH_SS_ID') cloudSettings.adhId = val;
          } catch (e) {
            console.warn("Failed to parse cloud setting:", row.key, e);
          }
        });
        
        if (Object.keys(cloudSettings).length > 0) {
          updateSettings(cloudSettings, true); // skipSync loop
        }
      }
    } catch (err) {
      console.warn("Cloud sync failed (table wfm_config might not exist yet):", err);
    }
  };

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

  const updateSettings = (newSettings: Partial<SystemSettings>, skipSync = false) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      const syncToCloud = async (key: string, value: any) => {
        if (skipSync) return;
        try {
          const payload = { key, value: JSON.stringify(value) };
          // Use upsert pattern via callSupabaseAPI
          // Note: callSupabaseAPI doesn't specifically have upsert but we can do a DELETE then POST or just POST if it's unique
          // Better yet, for settings we can use a custom RPC or just handle it if it fails
          await callSupabaseAPI('wfm_config', 'POST', payload); 
        } catch (e) {
          // If insert fails due to unique constraint, try update
          try {
             await callSupabaseAPI('wfm_config', 'PATCH', { value: JSON.stringify(value) }, `?key=eq.${key}`);
          } catch {}
        }
      };

      // Save to localStorage
      if (newSettings.apiUrl !== undefined) localStorage.setItem('SUPABASE_URL', newSettings.apiUrl);
      if (newSettings.apiKey !== undefined) localStorage.setItem('SUPABASE_KEY', newSettings.apiKey);
      
      // Auto-trigger sync if credentials just provided
      if (newSettings.apiUrl && newSettings.apiKey && !prev.apiUrl) {
        setTimeout(() => syncSettingsFromDB(), 500);
      }

      if (newSettings.adhId !== undefined) {
        localStorage.setItem('ADH_SS_ID', newSettings.adhId);
        syncToCloud('ADH_SS_ID', newSettings.adhId);
      }
      if (newSettings.channels !== undefined) {
        localStorage.setItem('WFM_CHANNELS', JSON.stringify(newSettings.channels));
        syncToCloud('WFM_CHANNELS', newSettings.channels);
      }
      if (newSettings.shifts !== undefined) {
        localStorage.setItem('WFM_SHIFT_MAP', JSON.stringify(newSettings.shifts));
        syncToCloud('WFM_SHIFT_MAP', newSettings.shifts);
      }
      if (newSettings.holidays !== undefined) {
        localStorage.setItem('WFM_HOLIDAYS', JSON.stringify(newSettings.holidays));
        syncToCloud('WFM_HOLIDAYS', newSettings.holidays);
      }
      if (newSettings.autoBreak !== undefined) {
        localStorage.setItem('WFM_AUTO_BREAK', JSON.stringify(newSettings.autoBreak));
        syncToCloud('WFM_AUTO_BREAK', newSettings.autoBreak);
      }
      if (newSettings.fridayBreak !== undefined) {
        localStorage.setItem('WFM_FRIDAY_BREAK', JSON.stringify(newSettings.fridayBreak));
        syncToCloud('WFM_FRIDAY_BREAK', newSettings.fridayBreak);
      }
      if (newSettings.puasa !== undefined) {
        localStorage.setItem('WFM_PUASA', JSON.stringify(newSettings.puasa));
        syncToCloud('WFM_PUASA', newSettings.puasa);
      }
      if (newSettings.puasaShifts !== undefined) {
        localStorage.setItem('WFM_PUASA_SHIFTS', JSON.stringify(newSettings.puasaShifts));
        syncToCloud('WFM_PUASA_SHIFTS', newSettings.puasaShifts);
      }
      if (newSettings.roles !== undefined) {
        localStorage.setItem('WFM_ROLES', JSON.stringify(newSettings.roles));
        syncToCloud('WFM_ROLES', newSettings.roles);
      }
      if (newSettings.publishStatus !== undefined) {
        localStorage.setItem('WFM_PUBLISH_STATUS', JSON.stringify(newSettings.publishStatus));
        syncToCloud('WFM_PUBLISH_STATUS', newSettings.publishStatus);
      }
      if (newSettings.bizRules !== undefined) {
        localStorage.setItem('WFM_BIZ_RULES', JSON.stringify(newSettings.bizRules));
        syncToCloud('WFM_BIZ_RULES', newSettings.bizRules);
      }
      return updated;
    });
  };

  return (
    <AppContext.Provider value={{ user, settings, login, logout, updateSettings, syncSettingsFromDB }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
};
