import React, { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../lib/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Clock,
  FileUp,
  Download,
  ChevronRight,
  BarChart3,
  Table as TableIcon,
  Filter,
  Trash2,
  Sparkles,
  BrainCircuit,
  AlertCircle,
  FileSpreadsheet,
  LineChart as LineChartIcon,
  Users,
} from "lucide-react";
import {
  format,
  startOfYear,
  addMonths,
  eachMonthOfInterval,
  startOfDay,
  endOfDay,
  eachHourOfInterval,
  addMinutes,
  subWeeks,
  subMonths,
  getDay,
  addDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import * as XLSX from "xlsx";
import { callSupabaseAPI } from "../lib/supabase";
import { calculateAgents } from "../lib/erlang";
import { GoogleGenAI, Type } from "@google/genai";

interface ForecastViewProps {
  channel: string;
}

export const ForecastView: React.FC<ForecastViewProps> = ({ channel }) => {
  const { settings } = useAppStore();
  const [activeTab, setActiveTab] = useState<
    "monthly" | "interval" | "forecast_gen" | "historical"
  >("monthly");
  const [intervalSize, setIntervalSize] = useState<15 | 30 | 60>(15);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [intervalRangeEnd, setIntervalRangeEnd] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [intervalViewMode, setIntervalViewMode] = useState<"interval" | "daily">("interval");
  const [intervalRangeData, setIntervalRangeData] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Historical Data Tab State
  const [histStartDate, setHistStartDate] = useState(
    format(subMonths(new Date(), 1), "yyyy-MM-dd"),
  );
  const [histEndDate, setHistEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [histIntervalSize, setHistIntervalSize] = useState<15 | 30 | 60>(60);
  const [historicalIntervals, setHistoricalIntervals] = useState<any[]>([]);
  const [forecastIntervals, setForecastIntervals] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [showDeleteForecastModal, setShowDeleteForecastModal] = useState(false);
  const [deleteForecastRange, setDeleteForecastRange] = useState({ start: "", end: "", type: "monthly" as "monthly" | "interval" });
  const [isDeletingForecast, setIsDeletingForecast] = useState(false);

  // Forecast Gen State
  const [forecastYear, setForecastYear] = useState(
    new Date().getFullYear() + 1,
  );
  const [baseYear, setBaseYear] = useState(new Date().getFullYear());
  const [annualAdjustment, setAnnualAdjustment] = useState<number | string>(0);
  const [monthlyAdjustments, setMonthlyAdjustments] = useState<
    Record<string, number | string>
  >({});
  const [generatedForecast, setGeneratedForecast] = useState<any[]>([]);
  const [isSavingForecast, setIsSavingForecast] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiContext, setAiContext] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [intervalPattern, setIntervalPattern] = useState<any[]>([]);
  const [holidayPattern, setHolidayPattern] = useState<any[]>([]);
  const [intervalMethod, setIntervalMethod] = useState<
    "sdsw" | "last_month" | "ai"
  >("sdsw");
  const [isGeneratingPattern, setIsGeneratingPattern] = useState(false);
  const [isGeneratingHolidayPattern, setIsGeneratingHolidayPattern] =
    useState(false);
  const [patternChartView, setPatternChartView] = useState<
    "normal" | "holiday"
  >("normal");
  const [isSavingIntervalAdjustment, setIsSavingIntervalAdjustment] = useState(false);

  const [intervalForecastStart, setIntervalForecastStart] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [intervalForecastEnd, setIntervalForecastEnd] = useState(
    format(addDays(new Date(), 6), "yyyy-MM-dd"),
  );
  const [isGeneratingIntervals, setIsGeneratingIntervals] = useState(false);
  const [isSavingIntervals, setIsSavingIntervals] = useState(false);
  const [intervalAdjustment, setIntervalAdjustment] = useState<number | string>(
    0,
  );
  const [viewIntervalSize, setViewIntervalSize] = useState<15 | 30 | 60>(30);
  const [dailyAdjustments, setDailyAdjustments] = useState<
    Record<string, number>
  >({});
  const [baseIntervalResults, setBaseIntervalResults] = useState<any[]>([]); // To store un-normalized 15m results
  const [intervalResults, setIntervalResults] = useState<any[]>([]); // Final results after normalization and global adjustment
  
  // Agent Need Target Parameters
  const [targetAHT, setTargetAHT] = useState<number | string>(300);
  const [targetResponseTime, setTargetResponseTime] = useState<number | string>(20);
  const [targetSLA, setTargetSLA] = useState<number | string>(80);
  const [targetShrinkage, setTargetShrinkage] = useState<number | string>(30);
  const [targetMaxOccupancy, setTargetMaxOccupancy] = useState<number | string>(85);
  const [targetStaffTime, setTargetStaffTime] = useState<number | string>(9);
  const [targetUtilization, setTargetUtilization] = useState<number | string>(80);

  const [dowWeights, setDowWeights] = useState<Record<number, number>>({
    0: 1,
    1: 1,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 1,
  });

  const [manualMonthlyData, setManualMonthlyData] = useState<
    Record<string, number>
  >(() => {
    const saved = localStorage.getItem("wfm_manual_traffic");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(
      "wfm_manual_traffic",
      JSON.stringify(manualMonthlyData),
    );
  }, [manualMonthlyData]);

  // Load/Save Interval Pattern
  useEffect(() => {
    const fetchPattern = async () => {
      try {
        const res = await callSupabaseAPI(
          "wfm_traffic_forecast",
          "GET",
          undefined,
          `?channel=eq.${channel}&type=in.(interval_pattern,holiday_pattern)&select=*`,
        );

        if (res && res.length > 0) {
          const normRes = res.filter((r: any) => r.type === "interval_pattern");
          const holRes = res.filter((r: any) => r.type === "holiday_pattern");

          const mapPattern = (items: any[]) => {
            const sorted = items.sort((a: any, b: any) =>
              a.timestamp.localeCompare(b.timestamp),
            );
            return sorted.map((item: any) => {
              const date = new Date(item.timestamp);
              const hh = String(date.getUTCHours()).padStart(2, "0");
              const mm = String(date.getUTCMinutes()).padStart(2, "0");
              return {
                time: `${hh}:${mm}`,
                weight: (item.volume || 0) / 100,
              };
            });
          };

          if (normRes.length === (24 * 60) / intervalSize) {
            setIntervalPattern(mapPattern(normRes));
          }
          if (holRes.length === (24 * 60) / intervalSize) {
            setHolidayPattern(mapPattern(holRes));
          }
        } else {
          // Fallback to local storage if DB is empty
          const savedNorm = localStorage.getItem(
            `wfm_interval_pattern_${channel}`,
          );
          const savedHol = localStorage.getItem(
            `wfm_holiday_pattern_${channel}`,
          );
          if (savedNorm) {
            const parsed = JSON.parse(savedNorm);
            if (parsed.length === (24 * 60) / intervalSize)
              setIntervalPattern(parsed);
          }
          if (savedHol) {
            const parsed = JSON.parse(savedHol);
            if (parsed.length === (24 * 60) / intervalSize)
              setHolidayPattern(parsed);
          }
        }
      } catch (err) {
        console.error("Error fetching pattern:", err);
      }
    };
    fetchPattern();
  }, [channel, intervalSize]);

  useEffect(() => {
    if (intervalPattern.length > 0) {
      localStorage.setItem(
        `wfm_interval_pattern_${channel}`,
        JSON.stringify(intervalPattern),
      );
    }
    if (holidayPattern.length > 0) {
      localStorage.setItem(
        `wfm_holiday_pattern_${channel}`,
        JSON.stringify(holidayPattern),
      );
    }
  }, [intervalPattern, holidayPattern, channel]);

  const formatInUTC = (date: Date, formatStr: string) => {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();

    if (formatStr === "yyyy-MM-dd") {
      return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    if (formatStr === "dd MMM") {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${String(d).padStart(2, "0")} ${months[m]}`;
    }
    if (formatStr === "dd MMM yyyy") {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${String(d).padStart(2, "0")} ${months[m]} ${y}`;
    }
    return format(date, formatStr);
  };

  const getDayInfo = (date: Date) => {
    const dateStr = formatInUTC(date, "yyyy-MM-dd");
    const dow = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
    
    // Respect dynamic weekend definition from settings
    const isWeekend = (settings.bizRules?.weekendDays || [0, 6]).includes(dow);
    const isHoliday = !!settings.holidays[dateStr];

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { isWeekend, isHoliday, dayName: days[dow], dateStr, dow };
  };

  const isPeriodClosed = (date: Date, channelName: string) => {
    const info = getDayInfo(date);
    const biz = settings.bizRules || { operatingHours: {}, weekendDays: [0, 6], holidayClosed: true };
    
    // Holiday Rule
    if (info.isHoliday && biz.holidayClosed) return true;
    
    // Weekend Rule
    if (info.isWeekend) return true;
    
    // Channel Level Rule
    if (biz.operatingHours?.[channelName]?.closed) return true;
    
    return false;
  };

  const isTimeOperational = (date: Date, channelName: string) => {
    // 1. Check if the whole day is closed
    if (isPeriodClosed(date, channelName)) return false;
    
    // 2. Check operational hours
    const chanRules = settings.bizRules?.operatingHours?.[channelName];
    if (!chanRules) return true; // Default 24h
    
    const timeStr = formatInUTC(date, "HH:mm");
    return timeStr >= chanRules.start && timeStr <= chanRules.end;
  };

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [intervalData, setIntervalData] = useState<any[]>([]);

  const handleManualValueChange = (
    year: number,
    month: string,
    value: string,
  ) => {
    const numValue = parseInt(value.replace(/,/g, "")) || 0;
    setManualMonthlyData((prev) => ({
      ...prev,
      [`${year}-${month}-${channel}`]: numValue,
    }));
  };

  const monthlyProcessedData = useMemo(() => {
    return monthlyData.map((yearGroup) => ({
      year: yearGroup.year,
      params: yearGroup.params,
      data: yearGroup.data.map((d: any) => {
        const isSupabaseData = d.actual > 0;
        const manualVal =
          manualMonthlyData[`${yearGroup.year}-${d.month}-${channel}`] || 0;
        const actual = isSupabaseData ? d.actual : manualVal;
        return {
          ...d,
          forecastHC: d.forecastHC || 0,
          actual,
          isManual: !isSupabaseData,
          variance: (actual || 0) - (d.forecast || 0),
          variancePct:
            (d.forecast || 0) > 0
              ? Math.round((((actual || 0) - (d.forecast || 0)) / (d.forecast || 1)) * 100).toString()
              : "0",
        };
      }),
    }));
  }, [monthlyData, manualMonthlyData, channel]);

  const displayedParams = useMemo(() => {
    const currentYearData = monthlyProcessedData.find(d => d.year === year);
    if (currentYearData?.params) {
      return {
        aht: currentYearData.params.aht || targetAHT,
        resp: currentYearData.params.resp || targetResponseTime,
        sla: currentYearData.params.sla || targetSLA,
        shrink: currentYearData.params.shrink || targetShrinkage,
        occ: currentYearData.params.occ || targetMaxOccupancy,
        util: currentYearData.params.util || targetUtilization,
        staff: currentYearData.params.staff || targetStaffTime
      };
    }
    return {
      aht: targetAHT,
      resp: targetResponseTime,
      sla: targetSLA,
      shrink: targetShrinkage,
      occ: targetMaxOccupancy,
      util: targetUtilization,
      staff: targetStaffTime
    };
  }, [monthlyProcessedData, year, targetAHT, targetResponseTime, targetSLA, targetShrinkage, targetMaxOccupancy, targetUtilization, targetStaffTime]);

  const fetchHistoricalTraffic = async () => {
    if (!settings.apiUrl || !settings.apiKey) return;
    setHistLoading(true);
    try {
      const start = `${histStartDate}T00:00:00Z`;
      const end = `${histEndDate}T23:59:59Z`;

      const [actualRes, forecastRes] = await Promise.all([
        callSupabaseAPI(
          "wfm_traffic_actual",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=timestamp,volume,aht&order=timestamp.desc`,
        ),
        callSupabaseAPI(
          "wfm_traffic_forecast",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&type=eq.interval&select=timestamp,volume&order=timestamp.desc`,
        ),
      ]);
      
      setHistoricalIntervals(actualRes || []);
      setForecastIntervals(forecastRes || []);
    } catch (err) {
      console.error("Error fetching historical data:", err);
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "historical") {
      fetchHistoricalTraffic();
    }
  }, [activeTab, channel, histStartDate, histEndDate]);

  const processedHistorical = useMemo(() => {
    if (historicalIntervals.length === 0 && forecastIntervals.length === 0) return [];

    const allDates = new Set<string>();
    historicalIntervals.forEach(item => allDates.add(formatInUTC(new Date(item.timestamp), "yyyy-MM-dd")));
    forecastIntervals.forEach(item => allDates.add(formatInUTC(new Date(item.timestamp), "yyyy-MM-dd")));

    const groupedActual: Record<string, any[]> = {};
    historicalIntervals.forEach((item) => {
      const dateStr = formatInUTC(new Date(item.timestamp), "yyyy-MM-dd");
      if (!groupedActual[dateStr]) groupedActual[dateStr] = [];
      groupedActual[dateStr].push(item);
    });

    const groupedForecast: Record<string, any[]> = {};
    forecastIntervals.forEach((item) => {
      const dateStr = formatInUTC(new Date(item.timestamp), "yyyy-MM-dd");
      if (!groupedForecast[dateStr]) groupedForecast[dateStr] = [];
      groupedForecast[dateStr].push(item);
    });

    return Array.from(allDates)
      .sort((a, b) => a.localeCompare(b))
      .map((date) => {
        const bins: Record<string, { volume: number; totalAht: number; ahtCount: number; forecast: number }> = {};
        const numSlots = (24 * 60) / histIntervalSize;
        for (let i = 0; i < numSlots; i++) {
          const h = Math.floor((i * histIntervalSize) / 60);
          const m = (i * histIntervalSize) % 60;
          const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          bins[timeStr] = { volume: 0, totalAht: 0, ahtCount: 0, forecast: 0 };
        }

        (groupedActual[date] || []).forEach((item) => {
          const dt = new Date(item.timestamp);
          const totalMinutes = dt.getUTCHours() * 60 + dt.getUTCMinutes();
          const binIndex = Math.floor(totalMinutes / histIntervalSize);
          const h = Math.floor((binIndex * histIntervalSize) / 60);
          const m = (binIndex * histIntervalSize) % 60;
          const binTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          if (bins[binTime]) {
            bins[binTime].volume += item.volume || 0;
            if (item.aht) {
              bins[binTime].totalAht += item.aht;
              bins[binTime].ahtCount += 1;
            }
          }
        });

        (groupedForecast[date] || []).forEach((item) => {
          const dt = new Date(item.timestamp);
          const totalMinutes = dt.getUTCHours() * 60 + dt.getUTCMinutes();
          const binIndex = Math.floor(totalMinutes / histIntervalSize);
          const h = Math.floor((binIndex * histIntervalSize) / 60);
          const m = (binIndex * histIntervalSize) % 60;
          const binTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          if (bins[binTime]) {
            bins[binTime].forecast += item.volume || 0;
          }
        });

        const totalVolume = Object.values(bins).reduce((sum, b) => sum + b.volume, 0);
        const totalForecast = Object.values(bins).reduce((sum, b) => sum + b.forecast, 0);
        const holidayName = settings.holidays[date];

        return {
          date,
          totalVolume,
          totalForecast,
          bins,
          isHoliday: !!holidayName,
          holidayName,
        };
      });
  }, [historicalIntervals, forecastIntervals, histIntervalSize, settings.holidays]);

  const intervalTotals = useMemo(() => {
    const f = intervalData.reduce((acc, curr) => acc + (curr.forecast || 0), 0);
    const a = intervalData.reduce((acc, curr) => acc + (curr.actual || 0), 0);
    const ahtSum = intervalData.reduce((acc, curr) => acc + (curr.aht || 0), 0);
    const avgAht = intervalData.length > 0 ? Math.round(ahtSum / intervalData.length) : 0;
    const totalHours = intervalData.reduce((acc, curr) => acc + (curr.agentNeed || 0) * (intervalSize / 60), 0);
    
    // Weighted Actual Performance Metrics
    const totalTrafficCount = intervalData.reduce((acc, curr) => acc + (curr.actualTrafficCount || 0), 0);
    const totalSLACount = intervalData.reduce((acc, curr) => acc + (curr.actualSLACount || 0), 0);
    const totalWaitTimeSum = intervalData.reduce((acc, curr) => acc + (curr.actualResponseTime || 0) * (curr.actualTrafficCount || 0), 0);
    
    // Utilization Actual: (Actual Work Seconds) / (Total Staffed Seconds)
    const totalWorkSeconds = intervalData.reduce((acc, curr) => acc + (curr.actual || 0) * (curr.aht || 0), 0);
    const totalStaffedSeconds = intervalData.reduce((acc, curr) => acc + (curr.agentActual || 0) * (intervalSize * 60), 0);
    
    return {
      forecast: f,
      actual: a,
      aht: avgAht,
      diff: a - f,
      totalAgentHours: totalHours,
      actualSLA: totalTrafficCount > 0 ? Math.round((totalSLACount / totalTrafficCount) * 100) : 0,
      actualResponseTime: totalTrafficCount > 0 ? Math.round(totalWaitTimeSum / totalTrafficCount) : 0,
      actualUtilization: totalStaffedSeconds > 0 ? Math.round((totalWorkSeconds / totalStaffedSeconds) * 100) : 0
    };
  }, [intervalData, intervalSize]);

  const processedIntervalViewData = useMemo(() => {
    if (intervalViewMode === "interval") {
      return intervalRangeData;
    } else {
      // Aggregate by date
      const dailyMap: Record<string, any> = {};
      intervalRangeData.forEach((item) => {
        if (!dailyMap[item.date]) {
          dailyMap[item.date] = {
            date: item.date,
            time: format(new Date(`${item.date}T00:00:00Z`), "dd MMM"),
            forecast: 0,
            actual: 0,
            totalAht: 0,
            ahtCount: 0,
            totalWaitTime: 0,
            totalSLACount: 0,
            totalTrafficCount: 0,
            totalAgentHours: 0,
            agentActual: 0, 
          };
        }
        const d = dailyMap[item.date];
        d.forecast += item.forecast || 0;
        d.actual += item.actual || 0;
        if (item.aht > 0) {
          d.totalAht += item.aht;
          d.ahtCount++;
        }
        d.totalWaitTime += (item.actualResponseTime || 0) * (item.actualTrafficCount || 0);
        d.totalSLACount += (item.actualSLACount || 0);
        d.totalTrafficCount += (item.actualTrafficCount || 0);
        d.totalAgentHours += (item.agentNeed || 0) * (intervalSize / 60);
        d.agentActual = Math.max(d.agentActual, item.agentActual || 0);
      });

      const staffTime = Number(displayedParams.staff) || 9;
      const util = (Number(displayedParams.util) || 80) / 100;
      const effCapacity = staffTime * util;

      return Object.values(dailyMap).map((d: any) => ({
        ...d,
        aht: d.ahtCount > 0 ? Math.round(d.totalAht / d.ahtCount) : 0,
        actualResponseTime: d.totalTrafficCount > 0 ? Math.round(d.totalWaitTime / d.totalTrafficCount) : 0,
        actualSLA: d.totalTrafficCount > 0 ? Math.round((d.totalSLACount / d.totalTrafficCount) * 100) : 0,
        agentNeed: Math.ceil(d.totalAgentHours / (effCapacity || 1))
      })).sort((a,b) => a.date.localeCompare(b.date));
    }
  }, [intervalRangeData, intervalViewMode, intervalSize, displayedParams]);

  const fetchMonthlyData = async () => {
    if (!settings.apiUrl || !settings.apiKey) return;
    setLoading(true);
    try {
      const yearsToFetch = showHistory ? [year, year - 1, year - 2] : [year];
      const startYear = Math.min(...yearsToFetch);
      const endYear = Math.max(...yearsToFetch);

      const start = `${startYear}-01-01T00:00:00Z`;
      const end = `${endYear}-12-31T23:59:59Z`;

      const [res, forecastRes, schedulesRes] = await Promise.all([
        callSupabaseAPI(
          "wfm_traffic_actual",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=timestamp,volume`,
        ),
        callSupabaseAPI(
          "wfm_traffic_forecast",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&type=in.(monthly,monthly_hc,param_aht,param_resp,param_sla,param_shrink,param_occ,param_util,param_staff)&select=timestamp,volume,type`,
        ),
        callSupabaseAPI(
          "wfm_schedules",
          "GET",
          undefined,
          `?channel=eq.${channel}&date=gte.${start.split('T')[0]}&date=lte.${end.split('T')[0]}&select=date,nik,shift`,
        ).catch(() => []), // Fallback to empty if fails
      ]);

      const allYearsData: any[] = [];
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];

      for (const y of yearsToFetch) {
        const grouped = monthNames.map((mStr, monthIdx) => {
          const monthTraffic = res
            ? res.filter((d: any) => {
                const dt = new Date(d.timestamp);
                return dt.getUTCFullYear() === y && dt.getUTCMonth() === monthIdx;
              })
            : [];
          const actual = monthTraffic.reduce((sum: number, d: any) => sum + (d.volume || 0), 0);

          let forecast = 0;
          let forecastHC = 0;
          if (forecastRes) {
            forecastRes.forEach((d: any) => {
              const dt = new Date(d.timestamp);
              if (dt.getUTCFullYear() === y && dt.getUTCMonth() === monthIdx) {
                if (d.type === 'monthly') forecast += (d.volume || 0);
                if (d.type === 'monthly_hc') forecastHC += (d.volume || 0);
              }
            });
          }

          // Calculate "HC Actual" from schedules
          let actualHC = 0;
          if (schedulesRes && schedulesRes.length > 0) {
            const mSchedules = schedulesRes.filter((s:any) => {
              const [sy, sm] = s.date.split('-');
              return parseInt(sy) === y && parseInt(sm) - 1 === monthIdx && s.shift !== 'OFF';
            });
            // Distinct agents
            actualHC = new Set(mSchedules.map((s:any) => s.nik)).size;
          }

          return { month: mStr, actual, forecast, actualHC, forecastHC };
        });

        // Extract parameters for the year
        const yearParams: Record<string, number> = {};
        if (forecastRes) {
          forecastRes.forEach((d: any) => {
            const dt = new Date(d.timestamp);
            if (dt.getUTCFullYear() === y && d.type.startsWith('param_')) {
              const key = d.type.replace('param_', '');
              yearParams[key] = d.volume;
            }
          });
        }

        allYearsData.push({ year: y, data: grouped, params: Object.keys(yearParams).length > 0 ? yearParams : null });
      }
      setMonthlyData(allYearsData);
    } catch (err) {
      console.error("Error fetching monthly data:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDowWeights = async (year: number) => {
    const weights: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
    try {
      const start = `${year}-01-01T00:00:00Z`;
      const end = `${year}-12-31T23:59:59Z`;
      const actualRes = await callSupabaseAPI(
        "wfm_traffic_actual",
        "GET",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=timestamp,volume`,
      );
      if (actualRes && actualRes.length > 0) {
        const sums: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const daily: Record<string, number> = {};

        actualRes.forEach((d: any) => {
          const dateStr = d.timestamp.split("T")[0];
          daily[dateStr] = (daily[dateStr] || 0) + (d.volume || 0);
        });

        Object.keys(daily).forEach(dateStr => {
          const dow = new Date(dateStr).getUTCDay();
          sums[dow] += daily[dateStr];
          counts[dow]++;
        });

        let maxAvg = 0;
        const avgs: Record<number, number> = {};
        for (let i = 0; i <= 6; i++) {
          avgs[i] = counts[i] > 0 ? sums[i] / counts[i] : 1;
          if (avgs[i] > maxAvg) maxAvg = avgs[i];
        }

        if (maxAvg > 0) {
          for (let i = 0; i <= 6; i++) {
            weights[i] = avgs[i] / maxAvg;
          }
        }
      }
    } catch (e) {
      console.error("Error calculating DOW weights", e);
    }
    return weights;
  };

  const fetchIntervalData = async () => {
    if (!settings.apiUrl || !settings.apiKey) return;
    setLoading(true);
    try {
      const start = `${selectedDate}T00:00:00Z`;
      const end = `${intervalRangeEnd}T23:59:59Z`;

      // Fetch Actuals, Forecasts, and Schedules in parallel
      const [actualRes, forecastRes, schedulesRes] = await Promise.all([
        callSupabaseAPI(
          "wfm_traffic_actual",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=*&order=timestamp.asc`,
        ),
        callSupabaseAPI(
          "wfm_traffic_forecast",
          "GET",
          undefined,
          `?channel=eq.${channel}&type=in.(interval,interval_agents)&timestamp=gte.${start}&timestamp=lte.${end}&select=*`,
        ),
        callSupabaseAPI(
          "wfm_schedules",
          "GET",
          undefined,
          `?channel=eq.${channel}&date=gte.${selectedDate}&date=lte.${intervalRangeEnd}&select=date,nik,shift`,
        ).catch(() => []),
      ]);

      const data: any[] = [];
      const startDateObj = new Date(`${selectedDate}T00:00:00Z`);
      const endDateObj = new Date(`${intervalRangeEnd}T00:00:00Z`);
      
      // Get shift rules for calculating actual agents per interval
      const shiftsMap = settings.shifts || {};

      // For each day in range
      let currentIter = new Date(startDateObj);
      while (currentIter <= endDateObj) {
        const dateStr = formatInUTC(currentIter, "yyyy-MM-dd");
        const [y, m, d] = dateStr.split("-").map(Number);
        const dayStartUTC = Date.UTC(y, m - 1, d, 0, 0, 0);

        const daySchedules = schedulesRes ? schedulesRes.filter((s: any) => s.date === dateStr) : [];

        for (let i = 0; i < (24 * 60) / intervalSize; i++) {
          const slotStart = dayStartUTC + i * intervalSize * 60 * 1000;
          const slotEnd = slotStart + intervalSize * 60 * 1000;
          const slotDate = new Date(slotStart);
          const hh = slotDate.getUTCHours();
          const mm = slotDate.getUTCMinutes();
          const slotStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

          const slotTraffic = actualRes
            ? actualRes.filter((d: any) => {
                const ts = new Date(d.timestamp).getTime();
                return ts >= slotStart && ts < slotEnd;
              })
            : [];

          const actual = slotTraffic.reduce((sum: number, d: any) => sum + (d.volume || 0), 0);
          const avgAht = slotTraffic.length > 0
            ? Math.round(slotTraffic.reduce((sum: number, d: any) => sum + (d.aht || 0), 0) / slotTraffic.length)
            : 0;
          
          // Actual response metrics
          const actualWaitTime = slotTraffic.length > 0
            ? Math.round(slotTraffic.reduce((sum: number, d: any) => sum + (d.wait_time || 0), 0) / slotTraffic.length)
            : 0;
          const actualSLACount = slotTraffic.filter((d: any) => d.sla_met === true || d.sla_met === 1).length;
          const actualSLA = slotTraffic.length > 0 ? Math.round((actualSLACount / slotTraffic.length) * 100) : 0;

          let forecast = 0;
          let agentsNeed = 0;
          if (forecastRes) {
            const matched = forecastRes.filter((fi: any) => {
              const fTs = new Date(fi.timestamp).getTime();
              return fTs >= slotStart && fTs < slotEnd;
            });
            forecast = matched.filter(m => m.type === "interval").reduce((s, d) => s + (d.volume || 0), 0);
            const agentMatches = matched.filter(m => m.type === "interval_agents");
            agentsNeed = agentMatches.length > 0 
              ? Math.ceil(agentMatches.reduce((s, d) => s + (d.volume || 0), 0) / agentMatches.length)
              : 0;

            // Fallback if no interval_agents found in DB (e.g. older forecast records)
            if (agentsNeed === 0 && forecast > 0) {
              agentsNeed = calculateAgents(
                Number(displayedParams.sla),
                Number(displayedParams.resp),
                forecast,
                Number(displayedParams.aht),
                Number(displayedParams.shrink),
                Number(displayedParams.occ),
                intervalSize * 60,
                !isPeriodClosed(slotDate, channel),
                channel
              );
            }
          }

          // Calculate Agent Actual for this interval
          let actualAgentsCount = 0;
          daySchedules.forEach((sched: any) => {
            const shift = shiftsMap[sched.shift];
            if (shift && shift.s && shift.e) {
              const [sh, sm] = shift.s.split(':').map(Number);
              const [eh, em] = shift.e.split(':').map(Number);
              
              const shiftStartMin = sh * 60 + sm;
              const shiftEndMin = eh * 60 + em;
              const currentSlotMin = hh * 60 + mm;
              
              const isOvernight = shiftEndMin < shiftStartMin;
              let isActive = false;
              
              if (!isOvernight) {
                isActive = currentSlotMin >= shiftStartMin && currentSlotMin < shiftEndMin;
              } else {
                isActive = currentSlotMin >= shiftStartMin || currentSlotMin < shiftEndMin;
              }
              
              if (isActive) actualAgentsCount++;
            }
          });

          data.push({
            date: dateStr,
            time: slotStr,
            forecast,
            actual,
            aht: avgAht,
            actualResponseTime: actualWaitTime,
            actualSLA: actualSLA,
            actualSLACount: actualSLACount,
            actualTrafficCount: slotTraffic.length,
            agentNeed: agentsNeed,
            agentActual: actualAgentsCount,
            timestamp: slotStart
          });
        }
        currentIter.setUTCDate(currentIter.getUTCDate() + 1);
      }
      setIntervalRangeData(data);
      // For backward compatibility with some existing UI parts if any
      if (data.length > 0) {
        const todayData = data.filter(d => d.date === selectedDate);
        setIntervalData(todayData.length > 0 ? todayData : data.slice(0, (24*60)/intervalSize));
      }
    } catch (err) {
      console.error("Error fetching interval data:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSingleDayPattern = async (
    baseDate: Date,
    method: "sdsw" | "last_month" | "ai",
    type: "interval_pattern" | "holiday_pattern",
  ) => {
    let patternData: any[] = [];

    if (method === "ai") {
      const activeAI =
        type === "holiday_pattern" ? holidayPattern : intervalPattern;
      if (activeAI.length > 0)
        return activeAI.map((p) => ({ ...p, weight: p.weight / 100 }));
      return Array.from({ length: (24 * 60) / intervalSize }).map((_, i) => {
        const h = Math.floor((i * intervalSize) / 60);
        const m = (i * intervalSize) % 60;
        return {
          time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          weight: 1 / ((24 * 60) / intervalSize),
        };
      });
    }

    const weeksToLookBack = method === "sdsw" ? 8 : 4;
    const historicalIntervals: Record<string, number[]> = {};

    // Map baseDate to the equivalent time in baseYear to get actual recorded traffic
    const equivalentBaseDate = new Date(
      Date.UTC(baseYear, baseDate.getUTCMonth(), baseDate.getUTCDate()),
    );

    for (let i = 1; i <= weeksToLookBack * 2; i++) {
      // look twice as far to ensure we find matching days
      if (
        Object.keys(historicalIntervals).some(
          (k) => historicalIntervals[k].length >= weeksToLookBack,
        )
      )
        break;

      const targetDate = subWeeks(equivalentBaseDate, i);
      const dateStr = formatInUTC(targetDate, "yyyy-MM-dd");
      const start = `${dateStr}T00:00:00Z`;
      const end = `${dateStr}T23:59:59Z`;

      try {
        const res = await callSupabaseAPI(
          "wfm_traffic_actual",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=timestamp,volume`,
        );

        if (res && res.length > 0) {
          const [y, m, d] = dateStr.split("-").map(Number);
          const loopDayStartUTC = Date.UTC(y, m - 1, d, 0, 0, 0);

          for (let j = 0; j < (24 * 60) / intervalSize; j++) {
            const slotStart = loopDayStartUTC + j * intervalSize * 60 * 1000;
            const slotStartDate = new Date(slotStart);
            const hh = String(slotStartDate.getUTCHours()).padStart(2, "0");
            const mm = String(slotStartDate.getUTCMinutes()).padStart(2, "0");
            const slotStr = `${hh}:${mm}`;

            const vol = res
              .filter((item: any) => {
                const ts = new Date(item.timestamp).getTime();
                return (
                  ts >= slotStart && ts < slotStart + intervalSize * 60 * 1000
                );
              })
              .reduce((sum: number, item: any) => sum + (item.volume || 0), 0);

            if (!historicalIntervals[slotStr])
              historicalIntervals[slotStr] = [];
            historicalIntervals[slotStr].push(vol);
          }
        }
      } catch (e) {
        console.error("Error fetching historical day pattern:", e);
      }
    }

    const totalAvgVolume = Object.values(historicalIntervals).reduce(
      (sum, vals) => {
        const avg =
          vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return sum + avg;
      },
      0,
    );

    const times = Object.keys(historicalIntervals).sort();
    if (times.length > 0) {
      times.forEach((time) => {
        const vals = historicalIntervals[time];
        const avg =
          vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        const weight =
          totalAvgVolume > 0
            ? avg / totalAvgVolume
            : 1 / ((24 * 60) / intervalSize);
        patternData.push({ time, weight });
      });
    } else {
      const staticP =
        type === "holiday_pattern" ? holidayPattern : intervalPattern;
      if (staticP.length > 0)
        return staticP.map((p) => ({ ...p, weight: p.weight / 100 }));
      return Array.from({ length: (24 * 60) / intervalSize }).map((_, i) => {
        const h = Math.floor((i * intervalSize) / 60);
        const m = (i * intervalSize) % 60;
        return {
          time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
          weight: 1 / ((24 * 60) / intervalSize),
        };
      });
    }
    return patternData;
  };

  const generateBulkIntervalForecast = async () => {
    setIsGeneratingIntervals(true);
    try {
      const startParts = intervalForecastStart.split("-").map(Number);
      const endParts = intervalForecastEnd.split("-").map(Number);

      const startDateUTC = new Date(
        Date.UTC(startParts[0], startParts[1] - 1, startParts[2]),
      );
      const endDateUTC = new Date(
        Date.UTC(endParts[0], endParts[1] - 1, endParts[2]),
      );

      const actualDowWeights = await calculateDowWeights(baseYear);
      setDowWeights(actualDowWeights);

      const days: Date[] = [];
      let currentDay = new Date(startDateUTC);
      while (currentDay <= endDateUTC) {
        days.push(new Date(currentDay));
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }
      const results: any[] = [];
      const monthlyTotals: Record<string, number> = {};
      const patternCache: Record<string, any[]> = {};
      const globalGrowth =
        1 + parseFloat(String(intervalAdjustment || 0)) / 100;

      // Group days by month to handle re-normalization logic
      const daysByMonth: Record<string, Date[]> = {};
      days.forEach((day) => {
        const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
        if (!daysByMonth[key]) daysByMonth[key] = [];
        daysByMonth[key].push(day);
      });

      for (const monthKey in daysByMonth) {
        const [y, mStr] = monthKey.split("-").map(Number);
        const mStart = `${monthKey}-01T00:00:00Z`;
        const lastDayOfMonth = new Date(Date.UTC(y, mStr, 0)).getUTCDate();
        const mEnd = `${monthKey}-${String(lastDayOfMonth).padStart(2, "0")}T23:59:59Z`;

        // Fetch/Determine Monthly Target
        let monthlyVolume = 0;
        const mForecastRes = await callSupabaseAPI(
          "wfm_traffic_forecast",
          "GET",
          undefined,
          `?channel=eq.${channel}&timestamp=gte.${mStart}&timestamp=lte.${mEnd}&type=eq.monthly&select=*`,
        );

        if (mForecastRes && mForecastRes.length > 0) {
          monthlyVolume = mForecastRes[0].volume || 0;
        } else {
          monthlyVolume = manualMonthlyData[`${monthKey}-${channel}`] || 0;
        }

        const monthDays = daysByMonth[monthKey];
        // Calculate weights for each day in this month
        // We need to account for all days in the month, even those outside the selected range,
        // to keep the monthly total consistent. However, the user is only generating for a range.
        // Request implies: "shift total traffic from other days" in that month.
        // So we assume the monthly target is Distributed across ALL days of that month.

        const allDaysInMonth: Date[] = [];
        for (let d = 1; d <= lastDayOfMonth; d++) {
          allDaysInMonth.push(new Date(Date.UTC(y, mStr - 1, d)));
        }

        const dailyWeights = allDaysInMonth.map((d) => {
          const isClosed = isPeriodClosed(d, channel);
          if (isClosed) return 0;

          const dKey = formatInUTC(d, "yyyy-MM-dd");
          const dow = d.getUTCDay();
          const dowWeight = actualDowWeights[dow] || 1;
          const adj = dailyAdjustments[dKey] || 0;
          return dowWeight * (1 + adj / 100);
        });

        const sumWeights = dailyWeights.reduce((a, b) => a + b, 0);

        for (const day of monthDays) {
          const dKey = formatInUTC(day, "yyyy-MM-dd");
          const dow = day.getUTCDay();
          const dowWeight = actualDowWeights[dow] || 1;
          const dayAdjustment = dailyAdjustments[dKey] || 0;
          const dayWeight = dowWeight * (1 + dayAdjustment / 100);

          // Check if day is closed based on Business Rules
          const isClosed = isPeriodClosed(day, channel);

          // Actual daily volume from monthly target distributed by weights
          // Force 0 if closed
          const dailyVolume = (isClosed || sumWeights === 0) ? 0 : monthlyVolume * (dayWeight / sumWeights);
          const dayInfo = getDayInfo(day);

          const cacheKey =
            dayInfo.isHoliday || dayInfo.isWeekend
              ? "holiday"
              : `dow-${day.getUTCDay()}`;
          let activePattern = patternCache[cacheKey];

          if (!activePattern) {
            // Always generate at 15m for multi-view support
            activePattern = await calculateSingleDayPattern(
              day,
              intervalMethod,
              dayInfo.isHoliday || dayInfo.isWeekend
                ? "holiday_pattern"
                : "interval_pattern",
            );
            patternCache[cacheKey] = activePattern;
          }

          activePattern.forEach((p: any) => {
            const [hh, mm] = p.time.split(":").map(Number);
            const ts = new Date(
              Date.UTC(
                day.getUTCFullYear(),
                day.getUTCMonth(),
                day.getUTCDate(),
                hh,
                mm,
                0,
              ),
            );

            // Check if this specific interval is operational
            const operational = isTimeOperational(ts, channel);

            results.push({
              channel,
              timestamp: ts.toISOString(),
              monthlyVolume: monthlyVolume,
              patternWeight: operational ? (p.weight > 1 ? p.weight / 100 : p.weight) : 0,
              volume: 0, // Will be computed reactively
              type: "interval",
            });
          });
        }
      }

      if (results.length > 0) {
        setBaseIntervalResults(results);
      }
    } catch (err) {
      console.error("Error generating bulk interval forecast:", err);
      alert("An error occurred while generating the forecast.");
    } finally {
      setIsGeneratingIntervals(false);
    }
  };

  // Reactive effect for normalizing daily shifts and applying global growth
  useEffect(() => {
    if (baseIntervalResults.length === 0) return;

    // Grouping base results by month to maintain monthly target
    const months: Record<
      string,
      { totalVolume: number; days: Record<string, any[]> }
    > = {};

    baseIntervalResults.forEach((res) => {
      const d = new Date(res.timestamp);
      const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const dKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      if (!months[mKey])
        months[mKey] = { totalVolume: res.monthlyVolume || 0, days: {} };
      if (!months[mKey].days[dKey]) months[mKey].days[dKey] = [];
      months[mKey].days[dKey].push(res);
    });

    const finalResults: any[] = [];

    for (const mKey in months) {
      const monthData = months[mKey];
      const [y, mStr] = mKey.split("-").map(Number);
      const lastDayOfMonth = new Date(Date.UTC(y, mStr, 0)).getUTCDate();

      let sumWeights = 0;
      for (let dayNum = 1; dayNum <= lastDayOfMonth; dayNum++) {
        const dStr = `${mKey}-${String(dayNum).padStart(2, "0")}`;
        const dObj = new Date(`${dStr}T00:00:00Z`);
        const dow = dObj.getUTCDay();
        
        // Zero weight if completely closed
        const isClosed = isPeriodClosed(dObj, channel);
        if (!isClosed) {
           sumWeights += dowWeights[dow] * (1 + (dailyAdjustments[dStr] || 0) / 100);
        }
      }

      for (const dKey in monthData.days) {
        const dObj = new Date(`${dKey}T00:00:00Z`);
        const dow = dObj.getUTCDay();
        const dayWeight =
          dowWeights[dow] * (1 + (dailyAdjustments[dKey] || 0) / 100);
        const dayResults = monthData.days[dKey];

        const normalizedDailyVolume =
          sumWeights > 0 ? monthData.totalVolume * (dayWeight / sumWeights) : 0;
        const originalDaySum = dayResults.reduce(
          (s, r) => s + r.patternWeight,
          0,
        );

        dayResults.forEach((r) => {
          const finalVol = Math.round(
            normalizedDailyVolume *
              (r.patternWeight / (originalDaySum || 1)),
          );
          finalResults.push({ ...r, volume: finalVol });
        });
      }
    }

    setIntervalResults(finalResults);
  }, [baseIntervalResults, dailyAdjustments, dowWeights]);

  const saveIntervalResults = async () => {
    if (intervalResults.length === 0) return;

    // Consistency check
    const monthsAffected = new Set<string>();
    Object.keys(dailyAdjustments)
      .filter((k) => dailyAdjustments[k] !== 0)
      .forEach((k) => {
        monthsAffected.add(k.substring(0, 7));
      });

    setIsSavingIntervals(true);
    try {
      const startStr = `${intervalForecastStart}T00:00:00Z`;
      const endStr = `${intervalForecastEnd}T23:59:59Z`;

      if (monthsAffected.size > 0) {
        console.warn(
          "Shifting detected. Monthly totals stay accurate only if saving for the complete month.",
        );
      }

      const yearStr = intervalForecastStart.split('-')[0];
      const startOfYear = `${yearStr}-01-01T00:00:00Z`;
      const endOfYear = `${yearStr}-12-31T23:59:59Z`;

      // Parameters to save as metadata
      const paramTimestamp = `${yearStr}-01-01T00:00:00Z`;
      const paramsPayload = [
        { channel, timestamp: paramTimestamp, type: "param_aht", volume: Number(targetAHT) || 0 },
        { channel, timestamp: paramTimestamp, type: "param_resp", volume: Number(targetResponseTime) || 0 },
        { channel, timestamp: paramTimestamp, type: "param_sla", volume: Number(targetSLA) || 0 },
        { channel, timestamp: paramTimestamp, type: "param_shrink", volume: Number(targetShrinkage) || 0 },
        { channel, timestamp: paramTimestamp, type: "param_occ", volume: Number(targetMaxOccupancy) || 0 },
        { channel, timestamp: paramTimestamp, type: "param_util", volume: Number(targetUtilization) || 0 },
        { channel, timestamp: paramTimestamp, type: "param_staff", volume: Number(targetStaffTime) || 0 },
      ];

      await callSupabaseAPI(
        "wfm_traffic_forecast",
        "DELETE",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${startOfYear}&timestamp=lte.${endOfYear}&type=in.(param_aht,param_resp,param_sla,param_shrink,param_occ,param_util,param_staff)`,
      );

      await callSupabaseAPI(
        "wfm_traffic_forecast",
        "DELETE",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${startStr}&timestamp=lte.${endStr}&type=in.(interval,interval_agents)`,
      );

      const chunkSize = 200;
      for (let i = 0; i < intervalResults.length; i += chunkSize) {
        const chunk = intervalResults.slice(i, i + chunkSize);
        
        const payloadIntervals = chunk.map(c => ({
          channel: c.channel,
          timestamp: c.timestamp,
          volume: c.volume,
          type: "interval"
        }));

        const payloadAgents = chunk.map(c => {
          const dt = new Date(`${c.timestamp}`);
          const agents = calculateAgents(
            Number(targetSLA),
            Number(targetResponseTime),
            c.volume,
            Number(targetAHT),
            Number(targetShrinkage),
            Number(targetMaxOccupancy),
            intervalSize * 60,
            !isPeriodClosed(dt, channel)
          );
          return {
            channel: c.channel,
            timestamp: c.timestamp,
            volume: agents,
            type: "interval_agents"
          };
        });

        // Add parameters in the first chunk
        const finalPayload = i === 0 ? [...payloadIntervals, ...payloadAgents, ...paramsPayload] : [...payloadIntervals, ...payloadAgents];

        await callSupabaseAPI("wfm_traffic_forecast", "POST", finalPayload);
      }
      alert(`Forecast results and parameters for ${yearStr} saved successfully.`);
      fetchMonthlyData();
    } catch (err: any) {
      console.error("Error saving interval results:", err);
      alert("Failed to save forecast results.");
    } finally {
      setIsSavingIntervals(false);
    }
  };

  const generateIntervalPattern = async (
    type: "interval_pattern" | "holiday_pattern" = "interval_pattern",
  ) => {
    if (type === "holiday_pattern") setIsGeneratingHolidayPattern(true);
    else setIsGeneratingPattern(true);

    try {
      const today = new Date();
      let patternData: any[] = [];

      if (intervalMethod === "ai") {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: `Generate a normalized daily traffic distribution pattern for a contact center channel "${channel}" with ${intervalSize}-minute intervals.
             This pattern is for a ${type === "holiday_pattern" ? "Weekend/Holiday" : "Normal Business Day"}.
             The output must be a valid JSON array of objects like this: [{"time": "00:00", "weight": 0.05}, ...].
             Weights are percentages and must sum exactly to 100.
             There should be exactly ${(24 * 60) / intervalSize} entries.
             Consider ${type === "holiday_pattern" ? "lower volumes with a flatter peak" : "typical business day with peaks in mid-morning and mid-afternoon"}.
             Include all intervals for a full 24-hour day in HH:mm format.`,
        });
        const text = response.text || "[]";
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          patternData = JSON.parse(jsonMatch[0]);
        }
      } else {
        const weeksToLookBack = intervalMethod === "sdsw" ? 8 : 4;
        const historicalIntervals: Record<string, number[]> = {};

        // Ensure we refer to baseYear for actual historical patterns, not arbitrary 'today'
        const baseDateForPattern = new Date(Date.UTC(baseYear, 11, 31));

        for (let i = 1; i <= weeksToLookBack * 2; i++) {
          // look twice as far to ensure we find matching days
          if (
            Object.keys(historicalIntervals).some(
              (k) => historicalIntervals[k].length >= weeksToLookBack,
            )
          )
            break;

          const targetDate = subWeeks(baseDateForPattern, i);
          const dateStr = formatInUTC(targetDate, "yyyy-MM-dd");

          // Filter by type if not AI
          const { isWeekend, isHoliday } = getDayInfo(targetDate);
          if (type === "holiday_pattern" && !isWeekend && !isHoliday) continue;
          if (type === "interval_pattern" && (isWeekend || isHoliday)) continue;

          const start = `${dateStr}T00:00:00Z`;
          const end = `${dateStr}T23:59:59Z`;

          const res = await callSupabaseAPI(
            "wfm_traffic_actual",
            "GET",
            undefined,
            `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=*`,
          );

          if (res && res.length > 0) {
            const [y, m, d] = dateStr.split("-").map(Number);
            const dayStartUTC = Date.UTC(y, m - 1, d, 0, 0, 0);

            for (let j = 0; j < (24 * 60) / intervalSize; j++) {
              const slotStart = dayStartUTC + j * intervalSize * 60 * 1000;
              const slotStartDate = new Date(slotStart);
              const hh = String(slotStartDate.getUTCHours()).padStart(2, "0");
              const mm = String(slotStartDate.getUTCMinutes()).padStart(2, "0");
              const slotStr = `${hh}:${mm}`;

              const vol = res
                .filter((item: any) => {
                  const ts = new Date(item.timestamp).getTime();
                  return (
                    ts >= slotStart && ts < slotStart + intervalSize * 60 * 1000
                  );
                })
                .reduce(
                  (sum: number, item: any) => sum + (item.volume || 0),
                  0,
                );

              if (!historicalIntervals[slotStr])
                historicalIntervals[slotStr] = [];
              historicalIntervals[slotStr].push(vol);
            }
          }
        }

        const totalAvgVolume = Object.values(historicalIntervals).reduce(
          (sum, vals) => {
            const avg =
              vals.length > 0
                ? vals.reduce((a, b) => a + b, 0) / vals.length
                : 0;
            return sum + avg;
          },
          0,
        );

        const sortedTimes = Object.keys(historicalIntervals).sort();
        if (sortedTimes.length > 0) {
          sortedTimes.forEach((time) => {
            const vals = historicalIntervals[time];
            const avg =
              vals.length > 0
                ? vals.reduce((a, b) => a + b, 0) / vals.length
                : 0;
            const weight =
              totalAvgVolume > 0
                ? (avg / totalAvgVolume) * 100
                : 100 / ((24 * 60) / intervalSize);
            patternData.push({ time, weight });
          });
        } else {
          // Fallback if no matching historical data found
          Array.from({ length: (24 * 60) / intervalSize }).forEach((_, i) => {
            const h = Math.floor((i * intervalSize) / 60);
            const m = (i * intervalSize) % 60;
            patternData.push({
              time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
              weight: 100 / ((24 * 60) / intervalSize),
            });
          });
        }
      }

      if (patternData.length > 0) {
        // Save pattern to Supabase
        const patternPayload = patternData.map((p, idx) => {
          const [hh, mm] = p.time.split(":").map(Number);
          // Use a dummy base date like 2000-01-01 to represent the time-only pattern
          const date = new Date(Date.UTC(2000, 0, 1, hh, mm, 0));
          return {
            channel,
            timestamp: date.toISOString(),
            volume: Math.round(p.weight * 100), // Store as basis points (integer) to avoid bigint errors
            type: type,
          };
        });

        // Clear old pattern for this channel & interval granularity & type before saving
        await callSupabaseAPI(
          "wfm_traffic_forecast",
          "DELETE",
          undefined,
          `?channel=eq.${channel}&type=eq.${type}`,
        );

        await callSupabaseAPI("wfm_traffic_forecast", "POST", patternPayload);

        if (type === "holiday_pattern") setHolidayPattern(patternData);
        else setIntervalPattern(patternData);

        const patternName = type === "holiday_pattern" ? "holiday" : "normal";
        alert(
          `${patternName} pattern (${intervalSize}m) successfully saved to the database!`,
        );
      }
    } catch (err) {
      console.error("Error generating interval pattern:", err);
      alert("Failed to create interval pattern.");
    } finally {
      setIsGeneratingPattern(false);
      setIsGeneratingHolidayPattern(false);
    }
  };

  useEffect(() => {
    if (activeTab === "monthly") {
      fetchMonthlyData();
    } else {
      fetchIntervalData();
    }
  }, [activeTab, channel, year, selectedDate, intervalRangeEnd, intervalSize, showHistory]);

  const handleIntervalChange = (size: 15 | 30 | 60) => {
    setIntervalSize(size);
  };

  const generateForecast = async () => {
    setLoading(true);
    try {
      const start = `${baseYear}-01-01T00:00:00Z`;
      const end = `${baseYear}-12-31T23:59:59Z`;
      const res = await callSupabaseAPI(
        "wfm_traffic_actual",
        "GET",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=timestamp,volume`,
      );

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const historicalData = monthNames.map((mStr, monthIdx) => {
        const monthTraffic = res
          ? res.filter(
              (d: any) => new Date(d.timestamp).getUTCMonth() === monthIdx,
            )
          : [];
        const supabaseActual = monthTraffic.reduce(
          (sum: number, d: any) => sum + (d.volume || 0),
          0,
        );

        // Include manual data if supabase data is 0
        const manualVal =
          manualMonthlyData[`${baseYear}-${mStr}-${channel}`] || 0;
        const actual = supabaseActual > 0 ? supabaseActual : manualVal;

        return { month: mStr, actual };
      });

      const totalActual = historicalData.reduce((sum, d) => sum + d.actual, 0);

      const forecast = historicalData.map((d) => {
        const dist =
          totalActual > 0 ? (d.actual / totalActual) * 100 : 100 / 12;
        const baseForecast = d.actual;
        return {
          month: d.month,
          base: baseForecast,
          distribution: dist,
          adjustment: 0,
          final: baseForecast,
        };
      });

      setGeneratedForecast(forecast);
      setMonthlyAdjustments({});
      setAnnualAdjustment(0);
    } catch (err) {
      console.error("Error generating forecast:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyAdjustments = () => {
    setGeneratedForecast((prev) =>
      prev.map((d) => {
        const monthlyAdj =
          parseFloat(String(monthlyAdjustments[d.month] || 0)) || 0;
        const annualAdj = parseFloat(String(annualAdjustment || 0)) || 0;
        const combinedAdj = (1 + annualAdj / 100) * (1 + monthlyAdj / 100);
        return {
          ...d,
          adjustment: monthlyAdj,
          final: Math.round(d.base * combinedAdj),
        };
      }),
    );
  };

  useEffect(() => {
    if (generatedForecast.length > 0) {
      applyAdjustments();
    }
  }, [annualAdjustment, monthlyAdjustments]);

  const deleteForecastByType = async (type: "interval" | "monthly") => {
    if (!confirm(`Are you sure you want to delete all ${type} forecast data for this year?`)) return;
    setIsSavingForecast(true);
    try {
      const start = `${forecastYear}-01-01T00:00:00Z`;
      const end = `${forecastYear}-12-31T23:59:59Z`;
      let deleteTypeQuery = "";
      if (type === "interval") deleteTypeQuery = "in.(interval,interval_agents)";
      else deleteTypeQuery = "in.(monthly,monthly_hc)";
      
      await callSupabaseAPI(
         "wfm_traffic_forecast",
         "DELETE",
         undefined,
         `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&type=${deleteTypeQuery}`,
      );
      alert(`${type} forecast successfully deleted.`);
      if (type === "monthly") fetchMonthlyData();
    } catch(err) {
      alert("Error deleting: " + err);
    } finally {
      setIsSavingForecast(false);
    }
  };

  const saveForecast = async () => {
    if (generatedForecast.length === 0) return;
    setIsSavingForecast(true);
    try {
      const payload: any[] = [];
      generatedForecast.forEach((d) => {
        const monthIdx = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ].indexOf(d.month);
        const date = new Date(Date.UTC(forecastYear, monthIdx, 1));
        
        payload.push({
          channel,
          timestamp: date.toISOString(),
          volume: d.final,
          type: "monthly",
        });

        // Compute Monthly HC to save explicitly
        let monthHC = 0;
        const mResults = intervalResults.filter(ir => {
          const dt = new Date(ir.timestamp);
          return dt.getUTCMonth() === monthIdx && dt.getUTCFullYear() === forecastYear;
        });

        if (mResults.length > 0) {
          const timeSums: Record<string, number> = {};
          
          // Identify working days for this month
          const workingDays = new Set<string>();
          const allDatesInMonth = new Set<string>();
          
          mResults.forEach(ir => {
            const dt = new Date(ir.timestamp);
            const dateStr = formatInUTC(dt, "yyyy-MM-dd");
            allDatesInMonth.add(dateStr);
            
            // Check holiday closure
            const isHoliday = !!settings.holidays[dateStr];
            const biz = settings.bizRules || { operatingHours: {}, weekendDays: [0, 6], holidayClosed: true };
            const isWeekend = biz.weekendDays.includes(dt.getUTCDay());
            
            if (!(isHoliday && biz.holidayClosed) && !isWeekend) {
              workingDays.add(dateStr);
            }

            const timeKey = `${dt.getUTCHours()}:${dt.getUTCMinutes()}`;
            const agents = calculateAgents(
              Number(targetSLA), Number(targetResponseTime), ir.volume,
              Number(targetAHT), Number(targetShrinkage), Number(targetMaxOccupancy),
              intervalSize * 60, true, channel
            );
            timeSums[timeKey] = (timeSums[timeKey] || 0) + agents;
          });

          // 1. Jumlah keseluruhan masing-masing interval dibagi hari kerja
          const numWorkingDays = workingDays.size || 1;
          const timeAverages: Record<string, number> = {};
          Object.entries(timeSums).forEach(([time, total]) => {
            timeAverages[time] = total / numWorkingDays;
          });
          
          // 2. Totalkan keseluruhannya / (stafftime * utilisasi)
          const totalAverageAgents = Object.values(timeAverages).reduce((a, b) => a + b, 0);
          
          const staffTime = Number(targetStaffTime) || 9;
          const util = (Number(targetUtilization) || 80) / 100;
          monthHC = Math.ceil(totalAverageAgents / (staffTime * util));
        }

        // Push HC monthly explicitly
        if (monthHC > 0) {
           payload.push({
             channel,
             timestamp: date.toISOString(),
             volume: monthHC,
             type: "monthly_hc",
           });
        }
      });

      // Delete existing forecast for that year/channel first (only monthly types + parameters)
      const start = `${forecastYear}-01-01T00:00:00Z`;
      const end = `${forecastYear}-12-31T23:59:59Z`;
      
      // Add parameters to payload
      const paramTimestamp = `${forecastYear}-01-01T00:00:00Z`;
      [
        { type: "param_aht", volume: Number(targetAHT) },
        { type: "param_resp", volume: Number(targetResponseTime) },
        { type: "param_sla", volume: Number(targetSLA) },
        { type: "param_shrink", volume: Number(targetShrinkage) },
        { type: "param_occ", volume: Number(targetMaxOccupancy) },
        { type: "param_util", volume: Number(targetUtilization) },
        { type: "param_staff", volume: Number(targetStaffTime) },
      ].forEach(p => {
        payload.push({
          channel,
          timestamp: paramTimestamp,
          volume: p.volume,
          type: p.type
        });
      });

      await callSupabaseAPI(
        "wfm_traffic_forecast",
        "DELETE",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&type=in.(monthly,monthly_hc,param_aht,param_resp,param_sla,param_shrink,param_occ,param_util,param_staff)`,
      );

      // Insert new forecast
      await callSupabaseAPI("wfm_traffic_forecast", "POST", payload);
      alert("Forecast successfully saved to the database!");
      fetchMonthlyData();
    } catch (err) {
      console.error("Error saving forecast:", err);
      alert(
        "Failed to save forecast: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsSavingForecast(false);
    }
  };

  const generateAIForecast = async () => {
    setIsAiLoading(true);
    setAiAnalysis(null);
    try {
      // Fetch last 3 years of data for context in one request
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear - 1, currentYear - 2];
      const startYear = currentYear - 2;
      const start = `${startYear}-01-01T00:00:00Z`;
      const end = `${currentYear}-12-31T23:59:59Z`;

      const res = await callSupabaseAPI(
        "wfm_traffic_actual",
        "GET",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&select=timestamp,volume`,
      );

      const historicalContext: any[] = [];
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];

      for (const y of years) {
        const grouped = monthNames.map((mStr, monthIdx) => {
          const monthTraffic = res
            ? res.filter((d: any) => {
                const dt = new Date(d.timestamp);
                return dt.getUTCFullYear() === y && dt.getUTCMonth() === monthIdx;
              })
            : [];
          const supabaseActual = monthTraffic.reduce((sum: number, d: any) => sum + (d.volume || 0), 0);
          const manualVal = manualMonthlyData[`${y}-${mStr}-${channel}`] || 0;
          return {
            month: mStr,
            actual: supabaseActual > 0 ? supabaseActual : manualVal,
          };
        });
        historicalContext.push({ year: y, data: grouped });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Analyze the following historical traffic data for channel "${channel}" and generate a forecast for the year ${forecastYear}.
        
        Historical Data:
        ${JSON.stringify(historicalContext, null, 2)}
        
        Additional User Context/Reference:
        "${aiContext || "None provided"}"
        
        Instructions:
        1. Identify growth trends (Year-over-Year).
        2. Identify seasonality patterns (which months are high/low).
        3. Use the "Additional User Context" provided above if it contains information about marketing campaigns, seasonal shifts, or business changes.
        4. Suggest a forecast for ${forecastYear} based on these trends and context.
        5. Provide the forecast in JSON format with an "analysis" string and a "forecast" array of objects with "month" and "volume" properties.
        6. The "analysis" should be in English.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: { type: Type.STRING },
              forecast: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    month: { type: Type.STRING },
                    volume: { type: Type.NUMBER },
                  },
                  required: ["month", "volume"],
                },
              },
            },
            required: ["analysis", "forecast"],
          },
        },
      });

      const result = JSON.parse(response.text || "{}");
      setAiAnalysis(result.analysis);

      // Map AI forecast to our generatedForecast structure
      const totalForecast = result.forecast.reduce(
        (sum: number, d: any) => sum + d.volume,
        0,
      );
      const mappedForecast = result.forecast.map((d: any) => {
        const dist =
          totalForecast > 0 ? (d.volume / totalForecast) * 100 : 100 / 12;
        return {
          month: d.month,
          base: d.volume, // AI suggested volume as base
          distribution: dist,
          adjustment: 0,
          final: d.volume,
        };
      });

      setGeneratedForecast(mappedForecast);
      setMonthlyAdjustments({});
      setAnnualAdjustment(0);
    } catch (err) {
      console.error("Error generating AI forecast:", err);
      alert(
        "Failed to generate AI forecast: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      console.log("Imported data:", data);
      alert("Data imported successfully (Simulated)");
    };
    reader.readAsBinaryString(file);
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importRange, setImportRange] = useState({ start: "", end: "" });
  const [bulkData, setBulkData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRange, setDeleteRange] = useState({ start: "", end: "" });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTraffic = async () => {
    if (!deleteRange.start || !deleteRange.end) {
      alert("Please select a start and end date range.");
      return;
    }

    setIsDeleting(true);
    try {
      const start = `${deleteRange.start}T00:00:00Z`;
      const end = `${deleteRange.end}T23:59:59Z`;

      // Use a consistent query string construction
      const query = `?channel=eq.${encodeURIComponent(channel)}&timestamp=gte.${start}&timestamp=lte.${end}`;

      await callSupabaseAPI(
        "wfm_traffic_actual",
        "DELETE",
        undefined,
        query,
      );

      alert(`Traffic data for channel ${channel} has been successfully deleted.`);
      setShowDeleteModal(false);

      // Refresh all data tabs
      await Promise.all([
        fetchMonthlyData(),
        fetchIntervalData(),
        fetchHistoricalTraffic()
      ]);
    } catch (err: any) {
      alert("Failed to delete data: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const parsePasteData = (text: string) => {
    const lines = text.trim().split("\n");
    const result = [];

    // Start from 0, but check if first line is header
    const startIdx =
      lines[0].toLowerCase().includes("timestamp") ||
      lines[0].toLowerCase().includes("time")
        ? 1
        : 0;

    for (let i = startIdx; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const parts = lines[i].split(/\t|,/); // Support Tab or Comma
      const ts = parts[0]?.trim();

      // Basic validation: must have at least some characters
      if (!ts || ts.length < 5) continue;

      result.push({
        timestamp: ts,
        volume: parseInt(parts[1]) || 0,
        aht: parseInt(parts[2]) || 0,
        channel: channel,
      });
    }
    return result;
  };

  const handleIntervalDataEdit = (time: string, newValue: string) => {
    const num = parseInt(newValue.replace(/,/g, "")) || 0;
    setIntervalData(prev => prev.map(d => d.time === time ? { ...d, forecast: num } : d));
  };

  const saveIntervalAdjustment = async () => {
    setIsSavingIntervalAdjustment(true);
    try {
      const tsBase = `${selectedDate}T`;
      const payload = intervalData.map(d => {
        const [hh, mm] = d.time.split(':');
        const ts = `${tsBase}${hh}:${mm}:00Z`;
        return {
          channel,
          timestamp: ts,
          volume: d.forecast,
          type: 'interval'
        };
      });

      const start = `${selectedDate}T00:00:00Z`;
      const end = `${selectedDate}T23:59:59Z`;

      await callSupabaseAPI(
        "wfm_traffic_forecast",
        "DELETE",
        undefined,
        `?channel=eq.${encodeURIComponent(channel)}&timestamp=gte.${start}&timestamp=lte.${end}&type=eq.interval`,
      );

      await callSupabaseAPI("wfm_traffic_forecast", "POST", payload);
      alert("Interval forecast adjustment saved successfully!");
    } catch (err: any) {
      alert("Failed to save interval adjustment: " + err.message);
    } finally {
      setIsSavingIntervalAdjustment(false);
    }
  };

  const handleDeleteForecast = async () => {
    if (!deleteForecastRange.start || !deleteForecastRange.end) {
      alert("Please select a date range.");
      return;
    }

    setIsDeletingForecast(true);
    try {
      const start = `${deleteForecastRange.start}T00:00:00Z`;
      const end = `${deleteForecastRange.end}T23:59:59Z`;
      const type = deleteForecastRange.type;
      
      const queryParams = new URLSearchParams({
        channel: `eq.${channel}`,
        timestamp: `gte.${start}`,
        type: `eq.${type}`
      }).toString();
      
      // PostgREST doesn't support multiple keys in URLSearchParams directly with .toString() for gte/lte overlapping keys
      // So we build it manually or use append
      const finalQuery = `?channel=eq.${encodeURIComponent(channel)}&timestamp=gte.${start}&timestamp=lte.${end}&type=eq.${type}`;

      console.log(`Deleting ${type} forecast: ${finalQuery}`);
      await callSupabaseAPI(
        "wfm_traffic_forecast",
        "DELETE",
        undefined,
        finalQuery
      );

      alert(`${type.toUpperCase()} forecast data successfully deleted from database.`);
      setShowDeleteForecastModal(false);
      
      // Refresh all related data tabs to ensure consistency
      await Promise.all([
        fetchMonthlyData(),
        fetchIntervalData(),
        fetchHistoricalTraffic()
      ]);
      
      // Special clear for interval results if currently viewing a deleted date
      if (type === 'interval' && selectedDate >= deleteForecastRange.start && selectedDate <= deleteForecastRange.end) {
        setBaseIntervalResults([]);
        setIntervalResults([]);
      }
    } catch (err: any) {
      alert("Failed to delete forecast: " + err.message);
    } finally {
      setIsDeletingForecast(false);
    }
  };

  const loadToAdjust = async (yearToAdjust: number) => {
    setLoading(true);
    try {
      const start = `${yearToAdjust}-01-01T00:00:00Z`;
      const end = `${yearToAdjust}-12-31T23:59:59Z`;
      const forecastRes = await callSupabaseAPI(
        "wfm_traffic_forecast",
        "GET",
        undefined,
        `?channel=eq.${channel}&timestamp=gte.${start}&timestamp=lte.${end}&type=eq.monthly&select=*`,
      );

      if (!forecastRes || forecastRes.length === 0) {
        alert("No existing forecast found for this year.");
        return;
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mapped = monthNames.map((mStr, mIdx) => {
        const monthForecast = forecastRes.filter((d: any) => new Date(d.timestamp).getUTCMonth() === mIdx);
        const volume = monthForecast.reduce((sum: number, d: any) => sum + (d.volume || 0), 0);
        return {
          month: mStr,
          base: volume,
          distribution: 0,
          adjustment: 0,
          final: volume
        };
      });

      const total = mapped.reduce((s, d) => s + d.base, 0);
      const withDist = mapped.map(d => ({
        ...d,
        distribution: total > 0 ? (d.base / total) * 100 : 0
      }));

      setForecastYear(yearToAdjust);
      setGeneratedForecast(withDist);
      setActiveTab('forecast_gen');
      setBaseYear(yearToAdjust - 1); // Default base to previous year
      setAnnualAdjustment(0);
      setMonthlyAdjustments({});
    } catch (err: any) {
      alert("Failed to load forecast for adjustment: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    if (!bulkData.trim()) {
      alert("Please paste some data first.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      const rawLines = bulkData.trim().split("\n");
      const parsed = parsePasteData(bulkData);
      const totalRows = parsed.length;
      const skippedRows =
        rawLines.length -
        totalRows -
        (rawLines[0].toLowerCase().includes("timestamp") ? 1 : 0);

      if (totalRows === 0) {
        alert("No valid data found to import. Please check your format.");
        setIsImporting(false);
        return;
      }

      const batchSize = 1000;
      const totalBatches = Math.ceil(totalRows / batchSize);
      let successCount = 0;

      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize);
        await callSupabaseAPI("wfm_traffic_actual", "POST", batch);
        successCount += batch.length;

        const currentBatch = Math.floor(i / batchSize) + 1;
        setImportProgress(Math.round((currentBatch / totalBatches) * 100));
      }

      alert(
        `Import Complete!\n\n✅ Success: ${successCount} rows\n⚠️ Skipped: ${skippedRows > 0 ? skippedRows : 0} rows (invalid format)\n\nData has been saved to the database.`,
      );
      setShowImportModal(false);
      setBulkData("");
    } catch (err: any) {
      console.error("Import Error:", err);
      alert(
        "Import failed: " +
          (err.message || "Unknown error occurred"),
      );
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header Tabs */}
      <div className="flex items-center gap-1 p-4 bg-white border-b border-slate-200">
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "monthly" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <Calendar size={14} />
          Monthly Forecast
        </button>
        <button
          onClick={() => setActiveTab("interval")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "interval" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <Clock size={14} />
          Interval Forecast
        </button>
        <button
          onClick={() => setActiveTab("forecast_gen")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "forecast_gen" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <BrainCircuit size={14} />
          Forecast Generation
        </button>
        <button
          onClick={() => setActiveTab("historical")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "historical" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <TableIcon size={14} />
          Historical Data
        </button>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
          <div className="bg-white p-6 rounded-3xl w-[400px] shadow-2xl animate-in zoom-in duration-200">
            <h3 className="mt-0 text-slate-800 font-bold mb-4 flex items-center gap-2">
              <Trash2 size={18} className="text-rose-600" />
              Delete Traffic Data
            </h3>

            <div className="space-y-4 mb-6">
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl mb-4">
                <p className="text-[10px] text-rose-700 font-medium leading-relaxed">
                  <b>Warning:</b> Traffic data for channel <b>{channel}</b>{" "}
                  will be permanently deleted based on the date range below.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  From Date:
                </label>
                <input
                  type="date"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                  value={deleteRange.start}
                  onChange={(e) =>
                    setDeleteRange({ ...deleteRange, start: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  To Date:
                </label>
                <input
                  type="date"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                  value={deleteRange.end}
                  onChange={(e) =>
                    setDeleteRange({ ...deleteRange, end: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTraffic}
                className={`px-5 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-100 transition-all flex items-center gap-2 ${isDeleting ? "opacity-50 cursor-not-allowed" : "hover:bg-rose-700"}`}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[20000]">
          <div className="bg-white p-6 rounded-3xl w-[600px] shadow-2xl animate-in zoom-in duration-200">
            <h3 className="mt-0 text-slate-800 font-bold mb-4 flex items-center gap-2">
              <FileUp size={18} className="text-emerald-600" />
              Bulk Import Traffic Data
            </h3>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <label className="text-[11px] font-bold text-slate-500 block mb-2 uppercase tracking-wider">
                  Paste Data (CSV or Tab Separated):
                </label>
                <textarea
                  className="w-full h-[200px] p-3 border border-slate-200 rounded-xl text-[11px] font-mono outline-none focus:border-indigo-500 resize-none bg-white"
                  placeholder="Format: timestamp,volume,aht&#10;2024-01-01 08:00,150,300&#10;2024-01-01 08:30,120,280"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                ></textarea>
                <div className="mt-2 flex justify-between items-center">
                  <p className="text-[10px] text-slate-500 italic">
                    * Supports copy-paste from Excel (Tab) or CSV (Comma).
                  </p>
                  <span className="text-[10px] font-bold text-indigo-600">
                    {bulkData.trim() ? bulkData.trim().split("\n").length : 0}{" "}
                    rows detected
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const csvContent =
                      "timestamp,volume,aht\n2024-01-01 08:00,100,300\n2024-01-01 08:30,120,280";
                    const blob = new Blob([csvContent], { type: "text/csv" });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "traffic_template.csv";
                    a.click();
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                >
                  <Download size={12} />
                  Download CSV Template
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                  <b>Safe Limit:</b> Import will be processed in batches of 500 rows
                  to maintain stability. Data will be saved to the table{" "}
                  <b>wfm_traffic_actual</b> for channel <b>{channel}</b>.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 transition-all"
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                onClick={handleManualImport}
                className={`px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 ${isImporting ? "bg-white border border-slate-200 shadow-none w-full" : "hover:bg-emerald-700"}`}
                disabled={isImporting}
              >
                {isImporting ? (
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-slate-500">
                        Importing {bulkData.trim().split("\n").length} rows...
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600">
                        {importProgress}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <FileUp size={14} />
                    Process Bulk Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 scrollbar-thin">
        {activeTab === "forecast_gen" ? (
          <div className="flex flex-col gap-6 max-w-7xl mx-auto">
            {/* Controls */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-end gap-6">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Base Year (History):
                </label>
                <select
                  value={baseYear}
                  onChange={(e) => setBaseYear(parseInt(e.target.value))}
                  className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 bg-slate-50"
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <option key={i} value={new Date().getFullYear() - i}>
                      {new Date().getFullYear() - i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Forecast Year:
                </label>
                <select
                  value={forecastYear}
                  onChange={(e) => setForecastYear(parseInt(e.target.value))}
                  className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 bg-slate-50"
                >
                  {[0, 1, 2].map((i) => (
                    <option key={i} value={new Date().getFullYear() + i}>
                      {new Date().getFullYear() + i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Annual Adjustment (%):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={annualAdjustment}
                  onChange={(e) => setAnnualAdjustment(e.target.value)}
                  className="w-24 p-2.5 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 bg-slate-50"
                />
              </div>
              <button
                onClick={generateForecast}
                disabled={loading}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate Forecast"}
              </button>
              <button
                onClick={generateAIForecast}
                disabled={isAiLoading || loading}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles
                  size={14}
                  className={isAiLoading ? "animate-pulse" : ""}
                />
                {isAiLoading ? "AI Thinking..." : "AI Smart Forecast"}
              </button>
              <button
                onClick={saveForecast}
                disabled={isSavingForecast || generatedForecast.length === 0}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {isSavingForecast ? "Saving..." : "Save Forecast to DB"}
              </button>
            </div>

            {/* AI Context Input */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BrainCircuit size={16} className="text-violet-600" />
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  AI Additional Reference Context
                </label>
              </div>
              <textarea
                className="w-full h-24 p-4 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-violet-500 bg-slate-50/50 transition-all resize-none"
                placeholder="Example: 'June will have a big payday promo', 'December has a long holiday', 'Targeting 10% YoY growth'..."
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
              ></textarea>
              <p className="text-[10px] text-slate-400 mt-2 italic flex items-center gap-1">
                <AlertCircle size={10} />
                This information will be used by the AI to provide more accurate
                forecast results based on business conditions.
              </p>
            </div>

            {/* AI Analysis Result */}
            {aiAnalysis && (
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-indigo-600 rounded-xl text-white">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-indigo-900 mb-2 uppercase tracking-wider">
                      AI Trend Analysis & Forecast Logic
                    </h4>
                    <p className="text-xs text-indigo-800 leading-relaxed font-medium whitespace-pre-wrap italic">
                      "{aiAnalysis}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Interval Pattern Generation */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Daily Interval Pattern Distribution
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                      Determine daily volume distribution for each time
                      interval
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={intervalMethod}
                    onChange={(e) => setIntervalMethod(e.target.value as any)}
                    className="p-2.5 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 bg-slate-50 min-w-[180px]"
                  >
                    <option value="sdsw">SDSW (8w Avg)</option>
                    <option value="last_month">Last Month (4w Avg)</option>
                    <option value="ai">AI Smart Pattern</option>
                  </select>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        generateIntervalPattern("interval_pattern")
                      }
                      disabled={
                        isGeneratingPattern ||
                        isGeneratingHolidayPattern ||
                        loading
                      }
                      className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGeneratingPattern ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <TrendingUp size={12} />
                      )}
                      Normal
                    </button>

                    <button
                      onClick={() => generateIntervalPattern("holiday_pattern")}
                      disabled={
                        isGeneratingPattern ||
                        isGeneratingHolidayPattern ||
                        loading
                      }
                      className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGeneratingHolidayPattern ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Calendar size={12} />
                      )}
                      Holiday
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => setPatternChartView("normal")}
                  className={`text-[10px] font-bold pb-1 transition-all ${patternChartView === "normal" ? "text-amber-600 border-b-2 border-amber-600" : "text-slate-400"}`}
                >
                  Normal View
                </button>
                <button
                  onClick={() => setPatternChartView("holiday")}
                  className={`text-[10px] font-bold pb-1 transition-all ${patternChartView === "holiday" ? "text-red-600 border-b-2 border-red-600" : "text-slate-400"}`}
                >
                  Holiday View
                </button>
              </div>

              {(patternChartView === "normal"
                ? intervalPattern
                : holidayPattern
              ).length > 0 ? (
                <div className="space-y-4">
                  <div className="h-48 w-full min-h-[192px] mt-2 bg-slate-50/30 rounded-2xl p-4 border border-slate-100 min-w-0 overflow-hidden">
                    <ResponsiveContainer id="pattern-chart" width="100%" height={160} debounce={50} minWidth={100} minHeight={100}>
                      <LineChart
                        data={
                          patternChartView === "normal"
                            ? intervalPattern
                            : holidayPattern
                        }
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#e2e8f0"
                        />
                        <XAxis
                          dataKey="time"
                          tick={{
                            fontSize: 8,
                            fill: "#64748b",
                            fontWeight: 600,
                          }}
                          interval={
                            intervalSize === 15
                              ? 8
                              : intervalSize === 30
                                ? 4
                                : 2
                          }
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fontSize: 8,
                            fill: "#64748b",
                            fontWeight: 600,
                          }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-2 border border-slate-100 shadow-xl rounded-xl">
                                  <p className="text-[9px] font-bold text-slate-800 mb-0.5">
                                    {payload[0].payload.time}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-1.5 h-1.5 rounded-full ${patternChartView === "normal" ? "bg-amber-500" : "bg-red-500"}`}
                                    ></div>
                                    <p
                                      className={`text-[10px] font-extrabold ${patternChartView === "normal" ? "text-amber-600" : "text-red-600"}`}
                                    >
                                      {payload[0].value?.toFixed(2)}%
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke={
                            patternChartView === "normal"
                              ? "#d97706"
                              : "#dc2626"
                          }
                          strokeWidth={2}
                          animationDuration={1500}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    className={`flex items-center gap-2 p-2 rounded-xl border ${patternChartView === "normal" ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"}`}
                  >
                    <AlertCircle
                      size={12}
                      className={
                        patternChartView === "normal"
                          ? "text-amber-600 shrink-0"
                          : "text-red-600 shrink-0"
                      }
                    />
                    <p
                      className={`text-[9px] font-medium ${patternChartView === "normal" ? "text-amber-800" : "text-red-800"}`}
                    >
                      This{" "}
                      <b>
                        {patternChartView === "normal"
                          ? "Normal"
                          : "Holiday/Weekend"}
                      </b>{" "}
                      distribution pattern will be used automatically during Bulk Interval Generation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30">
                  <div className="p-4 bg-white rounded-2xl shadow-sm mb-3">
                    <Clock size={32} className="text-slate-200" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                    No {patternChartView === "normal" ? "normal" : "holiday"} pattern yet.<br />
                    <span className="text-[8px] font-medium lowercase tracking-normal mt-1 block">
                      Click Generate{" "}
                      {patternChartView === "normal" ? "Normal" : "Holiday"}{" "}
                      Pattern to start.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Bulk Interval Forecast Generation */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Bulk Interval Forecast Generation
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                        Generate daily interval volume based on monthly targets
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Start:
                      </label>
                      <input
                        type="date"
                        value={intervalForecastStart}
                        onChange={(e) =>
                          setIntervalForecastStart(e.target.value)
                        }
                        className="p-2 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 bg-slate-50"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        End:
                      </label>
                      <input
                        type="date"
                        value={intervalForecastEnd}
                        onChange={(e) => setIntervalForecastEnd(e.target.value)}
                        className="p-2 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 bg-slate-50"
                      />
                    </div>
                    <button
                      onClick={generateBulkIntervalForecast}
                      disabled={
                        isGeneratingIntervals ||
                        loading ||
                        (intervalPattern.length === 0 &&
                          intervalMethod !== "ai")
                      }
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isGeneratingIntervals ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          Generate Forecast
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Base Generation Precision
                      </label>
                      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                        {[15, 30, 60].map((size) => (
                          <button
                            key={size}
                            onClick={() =>
                              handleIntervalChange(size as 15 | 30 | 60)
                            }
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                              intervalSize === size
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            {size}M
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-10 w-px bg-slate-100 mx-2" />

                    <div className="flex flex-col gap-1.5 flex-1 opacity-50 pointer-events-none">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Global Growth Adjustment (%)
                      </label>
                      <div className="relative flex items-center">
                        <TrendingUp
                          size={14}
                          className="absolute left-3 text-slate-300"
                        />
                        <input
                          type="number"
                          disabled
                          placeholder="Adjust in Daily"
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-400 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <div
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition-all bg-slate-50 border-slate-100 opacity-60`}
                    >
                      <div
                        className={`p-1.5 rounded-lg bg-slate-200 text-slate-400`}
                      >
                        <Sparkles size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-800 leading-none mb-1">
                          Manual Daily Adjustment
                        </p>
                        <p className="text-[9px] text-slate-500 font-medium">
                          Adjust growth for each date individually in the table below.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-7 gap-3 pt-6 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">AHT (Sec)</label>
                    <input type="number" value={targetAHT} onChange={(e) => setTargetAHT(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Response (Sec)</label>
                    <input type="number" value={targetResponseTime} onChange={(e) => setTargetResponseTime(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">SLA (%)</label>
                    <input type="number" value={targetSLA} onChange={(e) => setTargetSLA(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Shrinkage (%)</label>
                    <input type="number" value={targetShrinkage} onChange={(e) => setTargetShrinkage(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Max Occ (%)</label>
                    <input type="number" value={targetMaxOccupancy} onChange={(e) => setTargetMaxOccupancy(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Utilization (%)</label>
                    <input type="number" value={targetUtilization} onChange={(e) => setTargetUtilization(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Stafftime (Hrs)</label>
                    <input type="number" value={targetStaffTime} onChange={(e) => setTargetStaffTime(e.target.value)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all font-mono" />
                  </div>
                </div>

              </div>

              {intervalResults.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        Generated Forecast Results Preview
                      </h4>
                      <p className="text-[9px] text-slate-400 font-medium tracking-tight">
                        Review the generated intervals before saving to database.
                      </p>
                    </div>
                      
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                      {[15, 30, 60].map((size) => (
                        <button
                          key={size}
                          onClick={() =>
                            setViewIntervalSize(size as 15 | 30 | 60)
                          }
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                            viewIntervalSize === size
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {size}M View
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={saveIntervalResults}
                        disabled={isSavingIntervals}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-extrabold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSavingIntervals ? (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <FileUp size={12} />
                        )}
                        Save to DB
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const groupedResults: Record<
                      string,
                      Record<string, number>
                    > = {};
                    const datesSet = new Set<string>();
                    const dailyTotals: Record<string, number> = {};

                    // Sort intervalResults by timestamp
                    const sortedRaw = [...intervalResults].sort((a, b) =>
                      a.timestamp.localeCompare(b.timestamp),
                    );

                    sortedRaw.forEach((res) => {
                      const d = new Date(res.timestamp);
                      const hhUTC = d.getUTCHours();
                      const mmUTC = d.getUTCMinutes();

                      // Collapse based on viewIntervalSize
                      const collapsedMinutes =
                        Math.floor(mmUTC / viewIntervalSize) * viewIntervalSize;
                      const timeKey = `${String(hhUTC).padStart(2, "0")}:${String(collapsedMinutes).padStart(2, "0")}`;

                      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

                      datesSet.add(dateKey);
                      if (!groupedResults[timeKey])
                        groupedResults[timeKey] = {};
                      groupedResults[timeKey][dateKey] =
                        (groupedResults[timeKey][dateKey] || 0) + res.volume;

                      if (!dailyTotals[dateKey]) dailyTotals[dateKey] = 0;
                      dailyTotals[dateKey] += res.volume;
                    });

                    const sortedDates = Array.from(datesSet).sort();
                    const timesSet = new Set(Object.keys(groupedResults));
                    const sortedTimes = Array.from(timesSet).sort();

                    const chartData = sortedDates.map((date) => ({
                      date: formatInUTC(new Date(`${date}T00:00:00Z`), "dd MMM"),
                      volume: dailyTotals[date],
                    }));

                    return (
                      <div className="flex flex-col gap-6">
                        {/* Daily Trend Chart */}
                        <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl h-64 w-full min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">
                            Daily Forecast Volume Distribution
                          </p>
                          <div className="h-[200px] w-full min-h-[200px]">
                            <ResponsiveContainer id="daily-trend-chart" width="100%" height={180} debounce={50} minWidth={100} minHeight={100}>
                              <BarChart
                                data={chartData}
                              margin={{
                                top: 5,
                                right: 5,
                                left: -20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="#e2e8f0"
                              />
                              <XAxis
                                dataKey="date"
                                tick={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  fill: "#94a3b8",
                                }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  fill: "#94a3b8",
                                }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                cursor={{ fill: "#f1f5f9" }}
                                contentStyle={{
                                  borderRadius: "12px",
                                  border: "none",
                                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                }}
                              />
                              <Bar
                                dataKey="volume"
                                fill="#6366f1"
                                radius={[6, 6, 0, 0]}
                                barSize={24}
                                name="Total Daily Forecast"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm">
                          <div className="max-h-[600px] overflow-auto scrollbar-thin rounded-2xl border border-slate-100 relative">
                            <table className="w-full text-left border-separate border-spacing-0 bg-white">
                              <thead className="z-50">
                                {/* Date Header Row */}
                                <tr>
                                  <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-r border-slate-200 sticky top-0 left-0 bg-slate-100 z-[100]">
                                    Time (UTC)
                                  </th>
                                  {sortedDates.map((d) => {
                                    const [y, m, d_num] = d
                                      .split("-")
                                      .map(Number);
                                    const dateObj = new Date(
                                      Date.UTC(y, m - 1, d_num),
                                    );
                                    const { isWeekend, isHoliday, dayName } =
                                      getDayInfo(dateObj);
                                    const bgColor = isHoliday
                                      ? "bg-rose-50"
                                      : isWeekend
                                        ? "bg-slate-50"
                                        : "bg-white";
                                    const textColor = isHoliday
                                      ? "text-rose-600"
                                      : isWeekend
                                        ? "text-slate-500"
                                        : "text-indigo-600";
                                    const months = [
                                      "Jan",
                                      "Feb",
                                      "Mar",
                                      "Apr",
                                      "May",
                                      "Jun",
                                      "Jul",
                                      "Aug",
                                      "Sep",
                                      "Oct",
                                      "Nov",
                                      "Dec",
                                    ];

                                    return (
                                      <th
                                        key={d}
                                        className={`p-3 text-[10px] font-black ${textColor} uppercase tracking-widest text-center border-b border-r border-slate-200 min-w-[120px] sticky top-0 z-50 ${bgColor}`}
                                      >
                                        <div className="flex flex-col gap-0.5">
                                          <span className="text-[8px] opacity-60">
                                            {dayName}
                                          </span>
                                          <span className="font-black text-xs">{`${String(dateObj.getUTCDate()).padStart(2, "0")} ${months[dateObj.getUTCMonth()]}`}</span>
                                        </div>
                                      </th>
                                    );
                                  })}
                                  <th className="p-3 text-[10px] font-black text-indigo-700 uppercase tracking-widest text-center bg-indigo-50 border-b border-l border-indigo-100 min-w-[140px] sticky top-0 right-0 z-[100] shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                                    Grand Total
                                  </th>
                                </tr>

                                {/* Daily Total & Adjustment (Integrated in Header) */}
                                <tr className="bg-slate-50 shadow-md">
                                  <th className="p-3 text-[9px] font-black text-indigo-900 border-b border-r border-slate-200 sticky top-[52px] left-0 bg-slate-100 z-[100] uppercase tracking-tighter shadow-[2px_2px_5px_rgba(0,0,0,0.02)]">
                                    <div className="flex flex-col gap-1">
                                      <span>Daily Volume</span>
                                      <span className="text-[7px] text-emerald-600 font-bold px-1 py-0.5 bg-emerald-100 rounded inline-block">
                                        Adjustment (%)
                                      </span>
                                    </div>
                                  </th>
                                  {sortedDates.map((date) => (
                                    <th
                                      key={`total-${date}`}
                                      className="p-3 border-b border-r border-slate-200 bg-slate-50 sticky top-[52px] z-50"
                                    >
                                      <div className="flex flex-col gap-2 items-center">
                                        <div className="text-[11px] font-black text-indigo-800 font-mono">
                                          {dailyTotals[date]?.toLocaleString() ||
                                            "0"}
                                        </div>
                                        <input
                                          type="number"
                                          value={dailyAdjustments[date] || 0}
                                          onChange={(e) => {
                                            const val =
                                              parseFloat(e.target.value) || 0;
                                            setDailyAdjustments((prev) => ({
                                              ...prev,
                                              [date]: val,
                                            }));
                                          }}
                                          className="w-16 p-1 bg-white text-emerald-700 text-center text-[10px] font-black rounded-lg border border-emerald-100 outline-none focus:ring-2 focus:ring-emerald-200 transition-all font-mono"
                                        />
                                      </div>
                                    </th>
                                  ))}
                                  <th className="p-3 bg-indigo-50 border-b border-l border-indigo-200 sticky top-[52px] right-0 z-[100] shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                                    <div className="flex flex-col gap-1 items-center">
                                      <div className="text-[12px] font-black text-indigo-900 font-mono">
                                        {Object.values(dailyTotals)
                                          .reduce((a, b) => a + (b || 0), 0)
                                          .toLocaleString()}
                                      </div>
                                      <div className="text-[8px] font-black text-indigo-500 uppercase tracking-widest opacity-70">
                                        TOTAL RANGE
                                      </div>
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sortedTimes.map((time, idx) => (
                                  <tr
                                    key={time}
                                    className="hover:bg-indigo-50/30 transition-colors group"
                                  >
                                    <td className="p-3 text-[10px] font-bold text-slate-500 border-r border-slate-100 sticky left-0 bg-white z-30 font-mono group-hover:bg-indigo-50 transition-colors">
                                      {time}
                                    </td>
                                    {sortedDates.map((date) => {
                                      const dateObj = new Date(date);
                                      const { isWeekend, isHoliday } =
                                        getDayInfo(dateObj);
                                      const cellBg = isHoliday
                                        ? "bg-rose-50/20"
                                        : isWeekend
                                          ? "bg-slate-50/40"
                                          : "";
                                      return (
                                        <td
                                          key={`${time}-${date}`}
                                          className={`p-3 text-[11px] font-medium text-slate-600 text-center border-r border-slate-50 font-mono transition-colors ${cellBg}`}
                                        >
                                          {groupedResults[time][
                                            date
                                          ]?.toLocaleString() || "-"}
                                        </td>
                                      );
                                    })}
                                    <td className="p-3 text-[11px] font-black text-indigo-700 text-center border-l border-indigo-100 bg-indigo-50 font-mono sticky right-0 z-30 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-indigo-100 transition-colors min-w-[140px]">
                                      {sortedDates
                                        .reduce(
                                          (sum, date) =>
                                            sum +
                                            (groupedResults[time][date] || 0),
                                          0,
                                        )
                                        .toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Agent Need Forecast Preview */}
            {intervalResults.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <Users size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Agent Requirement Preview
                    </h4>
                    <p className="text-[9px] text-slate-400 font-medium tracking-tight">
                      Calculated using Erlang C algorithm based on forecasted volumes.
                    </p>
                  </div>
                </div>

                {/* Agent Need Info Header removed as requested */}


                {(() => {
                  const groupedAgents: Record<string, Record<string, number>> = {};
                  const datesSet = new Set<string>();

                  // Calculate base agent requirements
                  const baseAgents: Record<string, Record<string, number>> = {};
                  const sortedRaw = [...intervalResults].sort((a, b) =>
                    a.timestamp.localeCompare(b.timestamp),
                  );

                  sortedRaw.forEach((res) => {
                    const d = new Date(res.timestamp);
                    const isOpenDay = !isPeriodClosed(d, channel);
                    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
                    datesSet.add(dateKey);

                    const agents = calculateAgents(
                      Number(targetSLA),
                      Number(targetResponseTime),
                      res.volume,
                      Number(targetAHT),
                      Number(targetShrinkage),
                      Number(targetMaxOccupancy),
                      intervalSize * 60,
                      isOpenDay,
                      channel
                    );

                    if (!baseAgents[dateKey]) baseAgents[dateKey] = {};
                    const hh = d.getUTCHours();
                    const mm = d.getUTCMinutes();
                    const rawTimeKey = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
                    baseAgents[dateKey][rawTimeKey] = agents;
                  });

                  // Aggregate to groupedAgents by viewing interval
                  sortedRaw.forEach((res) => {
                    const d = new Date(res.timestamp);
                    const hh = d.getUTCHours();
                    const mm = d.getUTCMinutes();
                    const rawTimeKey = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
                    const collapsedMinutes = Math.floor(mm / viewIntervalSize) * viewIntervalSize;
                    const timeKey = `${String(hh).padStart(2, "0")}:${String(collapsedMinutes).padStart(2, "0")}`;
                    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
                    
                    if (!groupedAgents[timeKey]) groupedAgents[timeKey] = {};
                    
                    // We sum up the agents, but we also must divide by the factor if viewInterval > intervalSize 
                    // e.g., if we view block 60 min, the "Average Agents" in that 60 min block is the average of the 4x 15min blocks.
                    const val = baseAgents[dateKey][rawTimeKey] || 0;
                    groupedAgents[timeKey][dateKey] = (groupedAgents[timeKey][dateKey] || 0) + val;
                  });
                  
                  // Make sure view level shows averages, unless viewing at base interval
                  const intervalsPerView = viewIntervalSize / intervalSize;
                  if (intervalsPerView > 1) {
                    Object.keys(groupedAgents).forEach(tk => {
                       Object.keys(groupedAgents[tk]).forEach(dk => {
                          groupedAgents[tk][dk] = Math.ceil(groupedAgents[tk][dk] / intervalsPerView);
                       });
                    });
                  }

                  const sortedDates = Array.from(datesSet).sort();
                  const sortedTimes = Array.from(new Set(Object.keys(groupedAgents))).sort();

                  const chartData = sortedDates.map(date => {
                    // Berdasarkan request: "di totalkan seluruh intervalnya, hasilnya dibagi stafftime * utilisasi"
                    // Correct FTE calculation: (Sum of Interval HC * (Interval Size / 60)) / (Staff Time * Utilization)
                    
                    let totalDailyHours = 0;
                    if (baseAgents[date]) {
                      const intervalFactor = intervalSize / 60;
                      const sumHC = Object.values(baseAgents[date]).reduce((sum, val) => sum + val, 0);
                      totalDailyHours = sumHC * intervalFactor;
                    }
                    
                    const staffTime = Number(targetStaffTime) || 9;
                    const util = (Number(targetUtilization) || 80) / 100;
                    const effCapacity = staffTime * util;
                    const dailyAgents = Math.ceil(totalDailyHours / (effCapacity || 1));

                    return {
                      date: formatInUTC(new Date(`${date}T00:00:00Z`), "dd MMM"),
                      DailyAgents: dailyAgents || 0 // Replaces PeakAgents
                    };
                  });

                  return (
                    <>
                      <div className="mb-6 p-4 border border-slate-100 rounded-2xl bg-white shadow-sm">
                        <h4 className="text-xs font-black text-slate-800 mb-4 px-2 uppercase tracking-wide">
                          Daily Agents Forecast (HC)
                        </h4>
                        <div className="h-48 w-full min-h-[192px]">
                          <ResponsiveContainer width="100%" height={180} minWidth={100} minHeight={100}>
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorAgents" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }} axisLine={false} tickLine={false} />
                              <Tooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: "10px", fontWeight: "bold" }} />
                              <Area type="monotone" dataKey="DailyAgents" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorAgents)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-sm">
                      <div className="max-h-[600px] overflow-auto scrollbar-thin rounded-2xl border border-slate-100 relative">
                        <table className="w-full text-left border-separate border-spacing-0 bg-white">
                          <thead className="z-50">
                            <tr>
                              <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-r border-slate-200 sticky top-0 left-0 bg-slate-100 z-[100]">
                                Time (UTC)
                              </th>
                              {sortedDates.map((d) => {
                                const [y, m, d_num] = d.split("-").map(Number);
                                const dateObj = new Date(Date.UTC(y, m - 1, d_num));
                                const { isWeekend, isHoliday, dayName } = getDayInfo(dateObj);
                                const bgColor = isHoliday ? "bg-rose-50" : isWeekend ? "bg-slate-50" : "bg-white";
                                const textColor = isHoliday ? "text-rose-600" : isWeekend ? "text-slate-600" : "text-indigo-600";
                                const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

                                return (
                                  <th key={d} className={`p-3 text-[10px] font-black ${textColor} uppercase tracking-widest text-center border-b border-r border-slate-200 min-w-[120px] sticky top-0 z-50 ${bgColor}`}>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[8px] opacity-60">{dayName}</span>
                                      <span className="font-black text-xs">{`${String(dateObj.getUTCDate()).padStart(2, "0")} ${months[dateObj.getUTCMonth()]}`}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                            <tr className="bg-slate-50 shadow-md">
                              <th className="p-3 text-[9px] font-black text-indigo-900 border-b border-r border-slate-200 sticky top-[52px] left-0 bg-slate-100 z-[100] uppercase tracking-tighter">
                                Daily Agent Need (HC)
                              </th>
                              {sortedDates.map((date) => {
                                let totalDailyHours = 0;
                                if (baseAgents[date]) {
                                  const intervalFactor = intervalSize / 60;
                                  const sumHC = Object.values(baseAgents[date]).reduce((sum, val) => sum + val, 0);
                                  totalDailyHours = sumHC * intervalFactor;
                                }
                                
                                const staffTime = Number(targetStaffTime) || 9;
                                const util = (Number(targetUtilization) || 80) / 100;
                                const effCapacity = staffTime * util;
                                const dailyAgents = Math.ceil(totalDailyHours / (effCapacity || 1));
                                
                                return (
                                  <th key={`peak-${date}`} className="p-3 border-b border-r border-slate-200 bg-slate-50 sticky top-[52px] z-50 text-center">
                                    <div className="text-[11px] font-black text-indigo-800 font-mono">
                                      {dailyAgents.toLocaleString() || "0"}
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sortedTimes.map((time, idx) => (
                              <tr key={time} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="p-3 text-[10px] font-bold text-slate-500 border-r border-slate-100 sticky left-0 bg-white z-30 font-mono group-hover:bg-indigo-50 transition-colors">
                                  {time}
                                </td>
                                {sortedDates.map((date) => {
                                  const dateObj = new Date(date);
                                  const { isWeekend, isHoliday } = getDayInfo(dateObj);
                                  const cellBg = isHoliday ? "bg-rose-50/20" : isWeekend ? "bg-slate-50/40" : "";
                                  return (
                                    <td key={`${time}-${date}`} className={`p-3 text-[11px] font-medium text-slate-600 text-center border-r border-slate-50 font-mono transition-colors ${cellBg}`}>
                                      {groupedAgents[time][date]?.toLocaleString() || "-"}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                  );
                })()}
              </div>
            )}

            {/* Forecast Table */}
            {generatedForecast.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2">
                    <TableIcon size={14} />
                    Monthly Forecast Adjustment Table ({forecastYear})
                  </h3>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 sticky left-0 bg-slate-50 z-20">
                          Metric / Month
                        </th>
                        {generatedForecast.map((d) => (
                          <th
                            key={d.month}
                            className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center"
                          >
                            {d.month}
                          </th>
                        ))}
                        <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Base Volume Row */}
                      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                        <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          Base Volume ({baseYear})
                        </td>
                        {generatedForecast.map((d, idx) => (
                          <td
                            key={idx}
                            className="p-4 text-xs font-medium text-slate-600 text-center border-r border-slate-50"
                          >
                            {d.base.toLocaleString()}
                          </td>
                        ))}
                        <td className="p-4 text-xs font-extrabold text-slate-700 text-right bg-slate-50/30">
                          {generatedForecast
                            .reduce((sum, d) => sum + d.base, 0)
                            .toLocaleString()}
                        </td>
                      </tr>

                      {/* Distribution Row */}
                      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                        <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          Distribution (%)
                        </td>
                        {generatedForecast.map((d, idx) => (
                          <td
                            key={idx}
                            className="p-4 text-xs font-medium text-slate-600 text-center border-r border-slate-50"
                          >
                            {d.distribution.toFixed(2)}%
                          </td>
                        ))}
                        <td className="p-4 text-xs font-extrabold text-slate-700 text-right bg-slate-50/30">
                          100.00%
                        </td>
                      </tr>

                      {/* Monthly Adjustment Row */}
                      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                        <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          Monthly Adj (%)
                        </td>
                        {generatedForecast.map((d, idx) => (
                          <td
                            key={idx}
                            className="p-2 text-center border-r border-slate-50"
                          >
                            <input
                              type="number"
                              step="0.1"
                              className="w-full bg-transparent text-center text-xs font-bold text-indigo-600 outline-none focus:bg-indigo-50 rounded py-1"
                              value={monthlyAdjustments[d.month] ?? 0}
                              onChange={(e) =>
                                setMonthlyAdjustments((prev) => ({
                                  ...prev,
                                  [d.month]: e.target.value,
                                }))
                              }
                            />
                          </td>
                        ))}
                        <td className="p-4 text-xs font-extrabold text-slate-700 text-right bg-slate-50/30">
                          -
                        </td>
                      </tr>

                      {/* Forecast Volume Row */}
                      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                        <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          Forecast Volume ({forecastYear})
                        </td>
                        {generatedForecast.map((d, idx) => (
                          <td
                            key={idx}
                            className="p-4 text-xs font-extrabold text-indigo-600 text-center border-r border-slate-50 bg-indigo-50/10"
                          >
                            {d.final.toLocaleString()}
                          </td>
                        ))}
                        <td className="p-4 text-xs font-extrabold text-indigo-600 text-right bg-indigo-50/30">
                          {generatedForecast
                            .reduce((sum, d) => sum + d.final, 0)
                            .toLocaleString()}
                        </td>
                      </tr>

                      {/* Headcount Row using Erlang C output */}
                      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                        <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          Agent HC (FTE)
                        </td>
                        {generatedForecast.map((d, idx) => {
                          const monthNames = [
                            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                          ];
                          const mIdx = monthNames.indexOf(d.month);
                          const mResults = intervalResults.filter(ir => {
                            const dt = new Date(ir.timestamp);
                            return dt.getUTCMonth() === mIdx && dt.getUTCFullYear() === forecastYear;
                          });
                          
                          let monthHC = 0;
                          if (mResults.length > 0) {
                            const timeSums: Record<string, number> = {};
                            const workDaysSet = new Set<string>();
                            
                            mResults.forEach(ir => {
                              const dt = new Date(ir.timestamp);
                              if (!isPeriodClosed(dt, channel)) {
                                const dk = formatInUTC(dt, "yyyy-MM-dd");
                                workDaysSet.add(dk);
                                
                                const timeKey = `${dt.getUTCHours()}:${dt.getUTCMinutes()}`;
                                const agents = calculateAgents(
                                  Number(targetSLA),
                                  Number(targetResponseTime),
                                  ir.volume,
                                  Number(targetAHT),
                                  Number(targetShrinkage),
                                  Number(targetMaxOccupancy),
                                  intervalSize * 60,
                                  true,
                                  channel
                                );
                                // Totalkan agents di masing-masing interval
                                timeSums[timeKey] = (timeSums[timeKey] || 0) + agents;
                              }
                            });
                            
                            const workDaysCount = workDaysSet.size || 1;
                            let totalAverageIntervals = 0;
                            
                            // Hasil total dari masing-masing interval dibagi hari kerja
                            Object.values(timeSums).forEach(sum => {
                              totalAverageIntervals += (sum / workDaysCount);
                            });
                            
                            const staffTime = Number(targetStaffTime) || 9;
                            const util = (Number(targetUtilization) || 80) / 100;
                            
                            // Total keseluruhannya / (stafftime * utilisasi)
                            monthHC = Math.ceil(totalAverageIntervals / (staffTime * util));
                          }

                          return (
                            <td key={idx} className="p-4 text-xs font-black text-violet-700 text-center border-r border-slate-50 bg-violet-50/10">
                              {monthHC > 0 ? monthHC.toLocaleString() : "-"}
                            </td>
                          );
                        })}
                        <td className="p-4 text-xs font-extrabold text-violet-700 text-right bg-violet-50/30">
                          -
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "monthly" ? (
          <div className="flex flex-col gap-6 max-w-7xl mx-auto">
            {/* Monthly Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                    <LineChartIcon size={16} className="text-indigo-600" />
                    Traffic Trend {year} - {channel}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>{" "}
                      Forecast
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>{" "}
                      Actual
                    </span>
                  </div>
                </div>
                <div className="h-[300px] w-full relative min-w-0 min-h-0">
                  <ResponsiveContainer id="monthly-forecast-chart" width="100%" height={300} debounce={50} minWidth={100} minHeight={100}>
                    <AreaChart
                      data={
                        monthlyProcessedData.find((y) => y.year === year)
                          ?.data || []
                      }
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorActual"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#10b981"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="colorForecast"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#6366f1"
                            stopOpacity={0.1}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6366f1"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "#64748b",
                        }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "#64748b",
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="forecast"
                        stroke="#6366f1"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fillOpacity={1}
                        fill="url(#colorForecast)"
                      />
                      <Area
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorActual)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                <h3 className="text-sm font-extrabold text-slate-800 mb-6 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-600" />
                  Variance Analysis
                </h3>
                <div className="h-[300px] w-full relative min-w-0 min-h-0">
                  <ResponsiveContainer id="variance-analysis-chart" width="100%" height={300} debounce={50} minWidth={100} minHeight={100}>
                    <BarChart
                      data={
                        monthlyProcessedData.find((y) => y.year === year)
                          ?.data || []
                      }
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "#64748b",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "#64748b",
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "#f8fafc" }}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        dataKey="actual"
                        radius={[4, 4, 0, 0]}
                        fill="#10b981"
                      />
                      <Bar
                        dataKey="forecast"
                        radius={[4, 4, 0, 0]}
                        fill="#6366f1"
                        opacity={0.5}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Monthly Table (Horizontal) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]"></div>
              )}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                    <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2">
                      <TableIcon size={14} />
                      Monthly Trends
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowDeleteModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 hover:bg-slate-100 transition-all border-dashed"
                    >
                      <Trash2 size={12} />
                      Delete Actual
                    </button>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      History 2Y:
                    </span>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className={`w-7 h-3.5 rounded-full transition-all relative ${showHistory ? "bg-indigo-600" : "bg-slate-300"}`}
                    >
                      <div
                        className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${showHistory ? "left-4" : "left-0.5"}`}
                      ></div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const csvRows = [["Year", "Month", "Actual", "Forecast", "Variance %"]];
                      monthlyProcessedData.forEach(y => {
                        y.data.forEach((m: any) => {
                          csvRows.push([y.year.toString(), m.month, m.actual.toString(), m.forecast.toString(), m.variancePct]);
                        });
                      });
                      const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `forecast_monthly_${channel}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-1.5"
                  >
                    <FileSpreadsheet size={12} />
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 sticky left-0 bg-slate-50 z-20">
                        Year / Month
                      </th>
                      {[
                        "Jan",
                        "Feb",
                        "Mar",
                        "Apr",
                        "May",
                        "Jun",
                        "Jul",
                        "Aug",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dec",
                      ].map((m) => (
                        <th
                          key={m}
                          className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center"
                        >
                          {m}
                        </th>
                      ))}
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyProcessedData.map((yearGroup, yIdx) => {
                      const totalActual = yearGroup.data.reduce(
                        (sum: number, d: any) => sum + d.actual,
                        0,
                      );
                      const totalForecast = yearGroup.data.reduce(
                        (sum: number, d: any) => sum + d.forecast,
                        0,
                      );

                      return (
                        <React.Fragment key={yIdx}>
                          {/* Forecast Row (If exists) */}
                          {totalForecast > 0 && (
                            <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 bg-slate-50/30">
                              <td className="p-4 text-xs font-bold text-slate-500 sticky left-0 bg-slate-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                <div className="flex items-center gap-2">
                                  <span>{yearGroup.year} Forecast</span>
                                  <button onClick={() => loadToAdjust(yearGroup.year)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors" title="Load to Generator & Adjust">
                                    <Sparkles size={12} />
                                  </button>
                                </div>
                              </td>
                              {yearGroup.data.map((d: any, mIdx: number) => (
                                <td
                                  key={mIdx}
                                  className="p-2 text-center border-r border-slate-100 text-slate-500 font-medium text-xs"
                                >
                                  {d.forecast > 0
                                    ? d.forecast.toLocaleString()
                                    : "-"}
                                </td>
                              ))}
                              <td className="p-4 text-xs font-bold text-slate-500 text-right bg-slate-100/50">
                                {totalForecast.toLocaleString()}
                              </td>
                            </tr>
                          )}

                          {/* Actual Row */}
                          <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                            <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                              <div className="flex flex-col">
                                <span
                                  className={
                                    yIdx === 0 ? "text-indigo-600" : ""
                                  }
                                >
                                  {yearGroup.year} Actual
                                </span>
                              </div>
                            </td>
                            {yearGroup.data.map((d: any, mIdx: number) => (
                              <td
                                key={mIdx}
                                className="p-2 text-center border-r border-slate-50"
                              >
                                {!d.isManual ? (
                                  <span className="text-xs font-bold text-emerald-600">
                                    {d.actual.toLocaleString()}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    className="w-full bg-transparent text-center text-xs font-medium text-slate-600 outline-none focus:bg-indigo-50 rounded py-1"
                                    value={
                                      d.actual === 0
                                        ? ""
                                        : d.actual.toLocaleString()
                                    }
                                    placeholder="0"
                                    onChange={(e) =>
                                      handleManualValueChange(
                                        yearGroup.year,
                                        d.month,
                                        e.target.value,
                                      )
                                    }
                                  />
                                )}
                              </td>
                            ))}
                            <td className="p-4 text-xs font-extrabold text-indigo-600 text-right bg-indigo-50/30">
                              {totalActual.toLocaleString()}
                            </td>
                          </tr>

                          {/* Variance Row (If forecast exists) */}
                          {totalForecast > 0 && (
                            <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                              <td className="p-4 text-[10px] font-bold text-slate-400 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] italic">
                                Variance %
                              </td>
                              {yearGroup.data.map((d: any, mIdx: number) => (
                                <td
                                  key={mIdx}
                                  className={`p-2 text-center border-r border-slate-50 text-[10px] font-bold ${parseFloat(d.variancePct) >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                                >
                                  {d.forecast > 0
                                    ? `${parseFloat(d.variancePct) > 0 ? "+" : ""}${d.variancePct}%`
                                    : "-"}
                                </td>
                              ))}
                              <td
                                className={`p-4 text-[10px] font-bold text-right bg-slate-50/50 ${((totalActual - totalForecast) / totalForecast) * 100 >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                              >
                                {totalForecast > 0
                                  ? `${(((totalActual - totalForecast) / totalForecast) * 100).toFixed(1)}%`
                                  : "-"}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {monthlyProcessedData.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={14}
                          className="p-8 text-center text-slate-400 font-bold text-xs"
                        >
                          No traffic data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Headcount Extension */}
            {monthlyProcessedData.length > 0 && !loading && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-100 bg-violet-50/30 flex items-center gap-2">
                  <Users size={14} className="text-violet-600" />
                  <h3 className="text-xs font-extrabold text-violet-800">
                    Monthly Headcount Comparison
                  </h3>
                  <div className="flex items-center gap-4 bg-white p-2 px-4 rounded-xl border border-slate-200 ml-auto">
                    <div className="text-[9px] text-slate-500 font-bold uppercase">AHT: <span className="text-indigo-600">{displayedParams.aht}s</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Resp: <span className="text-indigo-600">{displayedParams.resp}s</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">SLA: <span className="text-indigo-600">{displayedParams.sla}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Shrink: <span className="text-indigo-600">{displayedParams.shrink}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Occ: <span className="text-indigo-600">{displayedParams.occ}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Util: <span className="text-indigo-600">{displayedParams.util}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Staff: <span className="text-indigo-600">{displayedParams.staff}hrs</span></div>
                  </div>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 sticky left-0 bg-slate-50 z-20">
                          Year / Month
                        </th>
                        {[
                          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                        ].map((m) => (
                          <th
                            key={m}
                            className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center"
                          >
                            {m}
                          </th>
                        ))}
                        <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">
                          Avg FTE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyProcessedData.map((yearGroup, yIdx) => {
                        const totalForecastVolume = yearGroup.data.reduce((s:number, d:any) => s + (d.forecast || 0), 0);
                        const hasForecast = yearGroup.data.some((d: any) => d.forecastHC > 0) || totalForecastVolume > 0;
                        const hasActual = yearGroup.data.some((d: any) => d.actualHC > 0);
                        
                        // We skip showing year if both are completely 0
                        if (!hasForecast && !hasActual) return null;

                        const avgForecastHC = Math.ceil(yearGroup.data.reduce((s:number, d:any) => s + (d.forecastHC || 0), 0) / 12);
                        const avgActualHC = Math.ceil(yearGroup.data.reduce((s:number, d:any) => s + (d.actualHC || 0), 0) / 12);

                        return (
                          <React.Fragment key={`hc-${yIdx}`}>
                            {hasForecast && (
                              <tr className="hover:bg-violet-50/50 transition-colors border-b border-slate-100 bg-violet-50/10">
                                <td className="p-4 text-xs font-bold text-violet-600 sticky left-0 bg-violet-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                  {yearGroup.year} Forecast HC
                                </td>
                                {yearGroup.data.map((d: any, mIdx: number) => (
                                  <td
                                    key={mIdx}
                                    className="p-2 text-center border-r border-slate-50 text-violet-700 font-black text-xs"
                                  >
                                    {d.forecastHC > 0 ? d.forecastHC.toLocaleString() : "-"}
                                  </td>
                                ))}
                                <td className="p-4 text-xs font-black text-violet-800 text-right bg-violet-100/30">
                                  {avgForecastHC > 0 ? avgForecastHC.toLocaleString() : "-"}
                                </td>
                              </tr>
                            )}
                            {(hasActual || yearGroup.year === year) && (
                              <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                                <td className="p-4 text-xs font-bold text-slate-700 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                  {yearGroup.year} Actual HC
                                </td>
                                {yearGroup.data.map((d: any, mIdx: number) => (
                                  <td
                                    key={mIdx}
                                    className="p-2 text-center border-r border-slate-50 text-emerald-600 font-bold text-xs"
                                  >
                                    {d.actualHC > 0 ? d.actualHC.toLocaleString() : "-"}
                                  </td>
                                ))}
                                <td className="p-4 text-xs font-bold text-emerald-700 text-right bg-emerald-50/30">
                                  {avgActualHC > 0 ? avgActualHC.toLocaleString() : "-"}
                                </td>
                              </tr>
                            )}
                            
                            {/* HC Variance Row */}
                            {hasForecast && (hasActual || yearGroup.year === year) && (
                              <tr className="hover:bg-slate-50 transition-colors border-b border-slate-50">
                                <td className="p-4 text-[10px] font-bold text-slate-400 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] italic">
                                  Gap (FTE)
                                </td>
                                {yearGroup.data.map((d: any, mIdx: number) => {
                                  const gap = (d.actualHC || 0) - (d.forecastHC || 0);
                                  return (
                                    <td
                                      key={mIdx}
                                      className={`p-2 text-center border-r border-slate-50 text-[10px] font-bold ${gap >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                                    >
                                      {d.forecastHC > 0 || d.actualHC > 0
                                        ? `${gap >= 0 ? "+" : ""}${gap}`
                                        : "-"}
                                    </td>
                                  );
                                })}
                                <td className={`p-4 text-[10px] font-bold text-right bg-slate-50/50 ${avgActualHC - avgForecastHC >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                  {avgActualHC - avgForecastHC >= 0 ? "+" : ""}{avgActualHC - avgForecastHC}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
          </div>
        ) : activeTab === "interval" ? (
          <div className="flex flex-col gap-6 max-w-7xl mx-auto">
            {/* Interval Controls */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  {intervalViewMode === "interval" ? "Date:" : "Range:"}
                </span>
                <input
                  type="date"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    if (intervalViewMode === "interval") {
                      setIntervalRangeEnd(e.target.value);
                    }
                  }}
                />
                {intervalViewMode === "daily" && (
                  <>
                    <span className="text-slate-400 font-bold text-[10px]">to</span>
                    <input
                      type="date"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                      value={intervalRangeEnd}
                      onChange={(e) => setIntervalRangeEnd(e.target.value)}
                    />
                  </>
                )}
              </div>
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  View:
                </span>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {(['interval', 'daily'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setIntervalViewMode(mode);
                        if (mode === "interval") {
                          setIntervalRangeEnd(selectedDate);
                        }
                      }}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all ${intervalViewMode === mode ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              {intervalViewMode === "interval" && (
                <>
                  <div className="h-6 w-px bg-slate-200"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      Interval:
                    </span>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {[15, 30, 60].map((size) => (
                        <button
                          key={size}
                          onClick={() => handleIntervalChange(size as any)}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${intervalSize === size ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          {size}m
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="h-6 w-px bg-slate-200"></div>
              <div className="flex items-center gap-3 flex-wrap ml-auto">
                <button
                  onClick={saveIntervalAdjustment}
                  disabled={isSavingIntervalAdjustment}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-extrabold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingIntervalAdjustment ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Save
                </button>
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-2 border-dashed"
                >
                  <Trash2 size={12} />
                  Actuals
                </button>
                <button 
                  onClick={() => {
                    const csvRows = [["Date", "Time", "Forecast Vol", "Actual Vol", "AHT", "Agent Need", "Agent Actual"]];
                    processedIntervalViewData.forEach(row => {
                      csvRows.push([row.date, row.time, (row.forecast || 0).toString(), (row.actual || 0).toString(), (row.aht || 0).toString(), (row.agentNeed || 0).toString(), (row.agentActual || 0).toString()]);
                    });
                    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `forecast_${intervalViewMode}_${selectedDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-bold hover:bg-indigo-50 transition-all flex items-center gap-2"
                >
                  <FileSpreadsheet size={12} />
                  Export
                </button>
              </div>
            </div>

            {/* Interval Chart */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative min-w-0">
              {loading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-3xl">
                  <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
              )}
              <h3 className="text-sm font-extrabold text-slate-800 mb-6 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                {intervalViewMode === "interval" ? "Interval" : "Daily"} Distribution - {selectedDate === intervalRangeEnd ? formatInUTC(new Date(`${selectedDate}T00:00:00Z`), "dd MMM yyyy") : `${format(new Date(`${selectedDate}T00:00:00Z`), "dd MMM")} - ${format(new Date(`${intervalRangeEnd}T00:00:00Z`), "dd MMM yyyy")}`}
              </h3>
              <div className="h-[350px] w-full min-w-0 min-h-0">
                <ResponsiveContainer id="interval-forecast-chart" width="100%" height={350} debounce={50} minWidth={100} minHeight={100}>
                  <ComposedChart
                    data={processedIntervalViewData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fontWeight: 600, fill: "#64748b" }}
                      interval={intervalViewMode === "interval" ? (intervalSize === 15 ? 7 : intervalSize === 30 ? 3 : 1) : 0}
                    />
                    <YAxis 
                      yAxisId="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: "#64748b" }}
                      label={{ value: 'Volume', angle: -90, position: 'insideLeft', style: { fontSize: '10px', textAnchor: 'middle', fill: '#64748b', fontWeight: 600 } }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: "#64748b" }}
                      label={{ value: 'Agents', angle: 90, position: 'insideRight', style: { fontSize: '10px', textAnchor: 'middle', fill: '#64748b', fontWeight: 600 } }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const orders: Record<string, number> = {
                            'Forecast Volume': 1,
                            'Actual Volume': 2,
                            'Agent Requirement': 3,
                            'Agent Actual': 4
                          };
                          const sorted = [...payload].sort((a, b) => (orders[a.name as string] || 99) - (orders[b.name as string] || 99));
                          return (
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xl text-[11px]">
                              <p className="font-bold text-slate-800 mb-2">{label}</p>
                              <div className="space-y-1">
                                {sorted.map((item, i) => (
                                  <div key={i} className="flex items-center justify-between gap-8">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                      <span className="text-slate-500">{item.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-900">{item.value?.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={50}
                      content={({ payload }) => {
                        const orders: Record<string, number> = {
                          'Forecast Volume': 1,
                          'Actual Volume': 2,
                          'Agent Requirement': 3,
                          'Agent Actual': 4
                        };
                        const sorted = [...(payload || [])].sort((a, b) => (orders[a.value] || 99) - (orders[b.value] || 99));
                        return (
                          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mb-6">
                            {sorted.map((entry, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div 
                                  className={entry.type === 'line' ? "w-4 h-1 rounded-full" : "w-3 h-3 rounded-sm"} 
                                  style={{ backgroundColor: entry.color }}
                                ></div>
                                <span className={`text-[11px] font-extrabold uppercase tracking-wider`} style={{ color: entry.color }}>
                                  {entry.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="forecast" 
                      name="Forecast Volume" 
                      fill="#6366f1" 
                      radius={[4, 4, 0, 0]} 
                      barSize={intervalSize === 15 ? 10 : 20}
                    />
                    <Bar 
                      yAxisId="left"
                      dataKey="actual" 
                      name="Actual Volume" 
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]} 
                      barSize={intervalSize === 15 ? 10 : 20}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="agentNeed" 
                      name="Agent Requirement" 
                      stroke="#f59e0b" 
                      strokeWidth={3} 
                      dot={false}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="agentActual" 
                      name="Agent Actual" 
                      stroke="#ec4899" 
                      strokeWidth={3} 
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Interval Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]"></div>
              )}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-2">
                  <TableIcon size={14} className="text-indigo-600" />
                  {intervalViewMode === "interval" ? "Interval" : "Daily"} Forecast Data Table
                </h3>
                {intervalViewMode === "interval" && (
                  <div className="flex bg-slate-100 p-1 rounded-xl mr-auto ml-4">
                    {[15, 30, 60].map((size) => (
                      <button
                        key={size}
                        onClick={() => handleIntervalChange(size as any)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold transition-all ${intervalSize === size ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}
                      >
                        {size}m
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center flex-wrap gap-4 bg-white p-2 px-4 rounded-xl border border-slate-200 ml-auto gap-y-2">
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">AHT: <span className="text-indigo-600">{Math.round(Number(displayedParams.aht))}s</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Resp: <span className="text-indigo-600">{Math.round(Number(displayedParams.resp))}s</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">SLA: <span className="text-indigo-600">{Math.round(Number(displayedParams.sla))}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Shrink: <span className="text-indigo-600">{Math.round(Number(displayedParams.shrink))}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Occ: <span className="text-indigo-600">{Math.round(Number(displayedParams.occ))}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Util: <span className="text-indigo-600">{Math.round(Number(displayedParams.util))}%</span></div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase whitespace-nowrap">Staff: <span className="text-indigo-600">{Math.round(Number(displayedParams.staff))}hrs</span></div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        {intervalViewMode === "interval" ? "Time" : "Date"}
                      </th>
                      {intervalViewMode === "interval" && (
                         <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                          Date
                        </th>
                      )}
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                        Forecast Vol
                      </th>
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                        Actual Vol
                      </th>
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                        Diff
                      </th>
                      <th className="p-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider text-center">
                        Avg AHT
                      </th>
                      <th className="p-4 text-[10px] font-extrabold text-indigo-600 bg-indigo-50/50 uppercase tracking-wider text-center">
                        Agent Req (FTE)
                      </th>
                      <th className="p-4 text-[10px] font-extrabold text-emerald-600 bg-emerald-50/50 uppercase tracking-wider text-center">
                        Agent Actual
                      </th>
                      <th className="p-4 text-[10px] font-extrabold text-slate-600 bg-slate-50/50 uppercase tracking-wider text-center">
                        Gap
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {processedIntervalViewData.map((row, idx) => {
                      const diff = (row.actual || 0) - (row.forecast || 0);
                      const diffPct = (row.forecast || 0) > 0 ? (diff / row.forecast) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-xs font-bold text-slate-700">
                            {row.time}
                          </td>
                          {intervalViewMode === "interval" && (
                            <td className="p-4 text-[10px] font-medium text-slate-500">
                              {row.date}
                            </td>
                          )}
                          <td className="p-4 text-xs font-black text-slate-700 text-center">
                            {row.forecast?.toLocaleString() || "0"}
                          </td>
                          <td className="p-4 text-xs font-black text-slate-700 text-center">
                            {row.actual?.toLocaleString() || "0"}
                          </td>
                          <td className={`p-4 text-xs font-bold text-center ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {diff > 0 ? "+" : ""}{diff.toLocaleString()} ({diffPct > 0 ? "+" : ""}{Math.round(diffPct)}%)
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-500 text-center">
                            {row.aht}s
                          </td>
                          <td className="p-4 text-xs font-black text-indigo-700 text-center bg-indigo-50/20">
                            {row.agentNeed?.toLocaleString() || "0"}
                          </td>
                          <td className="p-4 text-xs font-black text-emerald-700 text-center bg-emerald-50/20">
                            {row.agentActual?.toLocaleString() || "0"}
                          </td>
                          <td className={`p-4 text-xs font-black text-center bg-slate-50/30 ${ (row.agentActual || 0) - (row.agentNeed || 0) >= 0 ? "text-emerald-700" : "text-rose-700" }`}>
                            {((row.agentActual || 0) - (row.agentNeed || 0)).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {processedIntervalViewData.length === 0 && !loading && (
                      <tr>
                        <td colSpan={intervalViewMode === "interval" ? 9 : 8} className="p-12 text-center text-slate-400 font-bold text-xs">
                          No data found for the selected range.
                        </td>
                      </tr>
                    )}
                    {processedIntervalViewData.length > 0 && (
                      <tr className="bg-indigo-50/70 border-t-2 border-indigo-100 font-black">
                        <td className="p-4 text-[10px] text-indigo-700 uppercase tracking-widest">
                          {intervalViewMode === "interval" ? "TOTAL (DAY)" : "GRAND TOTAL"}
                        </td>
                        {intervalViewMode === "interval" && <td></td>}
                        <td className="p-4 text-xs text-center text-indigo-700">
                          {processedIntervalViewData.reduce((s, r) => s + (r.forecast || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-xs text-center text-indigo-700">
                          {processedIntervalViewData.reduce((s, r) => s + (r.actual || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-xs text-center text-indigo-700">
                          {(processedIntervalViewData.reduce((s, r) => s + (r.actual || 0), 0) - processedIntervalViewData.reduce((s, r) => s + (r.forecast || 0), 0)).toLocaleString()}
                        </td>
                        <td className="p-4 text-xs text-center text-indigo-700">
                          {Math.round(processedIntervalViewData.reduce((s, r) => s + (r.aht || 0), 0) / processedIntervalViewData.length)}s
                        </td>
                        <td className="p-4 text-xs text-center text-indigo-900 bg-indigo-100/50">
                          {(() => {
                             const staffTime = Number(displayedParams.staff) || 9;
                             const util = (Number(displayedParams.util) || 80) / 100;
                             const effCapacity = staffTime * util;
                             const totalHours = intervalViewMode === "interval" 
                               ? intervalTotals.totalAgentHours 
                               : processedIntervalViewData.reduce((s, r) => s + r.totalAgentHours, 0);
                             const numDays = intervalViewMode === "interval" ? 1 : processedIntervalViewData.length;
                             const fteNeed = Math.ceil(totalHours / (effCapacity || 1) / numDays);
                             return fteNeed.toLocaleString();
                          })()} (FTE)
                        </td>
                        <td className="p-4 text-xs text-center text-emerald-700 bg-emerald-50/50">
                          {Math.max(...processedIntervalViewData.map(r => r.agentActual || 0)).toLocaleString()} (PEAK)
                        </td>
                        <td className="p-4 text-xs text-center text-slate-700 bg-slate-100/50">
                          {(() => {
                             const totalActualPeak = Math.max(...processedIntervalViewData.map(r => r.agentActual || 0));
                             const staffTime = Number(displayedParams.staff) || 9;
                             const util = (Number(displayedParams.util) || 80) / 100;
                             const effCapacity = staffTime * util;
                             const totalHours = intervalViewMode === "interval" 
                               ? intervalTotals.totalAgentHours 
                               : processedIntervalViewData.reduce((s, r) => s + r.totalAgentHours, 0);
                             const numDays = intervalViewMode === "interval" ? 1 : processedIntervalViewData.length;
                             const fteNeed = Math.ceil(totalHours / (effCapacity || 1) / numDays);
                             
                             return (totalActualPeak - fteNeed).toLocaleString();
                          })()}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === "historical" ? (
          <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
            {/* Historical Header & Controls */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                    <TableIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      Historical Traffic Database
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                      Review historical volume, distribution patterns, and AHT metrics
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      From:
                    </label>
                    <input
                      type="date"
                      value={histStartDate}
                      onChange={(e) => setHistStartDate(e.target.value)}
                      className="p-2 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 bg-slate-50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      To:
                    </label>
                    <input
                      type="date"
                      value={histEndDate}
                      onChange={(e) => setHistEndDate(e.target.value)}
                      className="p-2 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 bg-slate-50"
                    />
                  </div>
                  <div className="h-8 w-px bg-slate-100 mx-2" />
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {[15, 30, 60].map((size) => (
                      <button
                        key={size}
                        onClick={() => setHistIntervalSize(size as any)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                          histIntervalSize === size
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {size}M
                      </button>
                    ))}
                  </div>
                  <div className="h-8 w-px bg-slate-100 mx-2" />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDeleteForecastRange({ 
                          start: histStartDate, 
                          end: histEndDate, 
                          type: 'interval' 
                        });
                        setShowDeleteForecastModal(true);
                      }}
                      className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold border border-rose-100 hover:bg-rose-100 transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      <Trash2 size={12} />
                      Forecast
                    </button>
                    <button 
                      onClick={() => {
                        setDeleteRange({ start: histStartDate, end: histEndDate });
                        setShowDeleteModal(true);
                      }}
                      className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-2 border-dashed whitespace-nowrap"
                    >
                      <Trash2 size={12} />
                      Actuals
                    </button>
                  </div>
                  <div className="h-8 w-px bg-slate-100 mx-2" />
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <FileUp size={12} />
                    Import Data
                  </button>
                </div>
              </div>

              {histLoading ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-slate-400">
                      Loading and processing historical data...
                    </span>
                  </div>
                </div>
              ) : processedHistorical.length === 0 ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                      <TableIcon size={32} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-500 mb-1">
                        No records found
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Try another date range or import new data.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  {/* TRAFFIC VOLUME TABLE (ACTUAL) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-indigo-600" />
                        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                          1. Traffic Volume Table (Actual)
                        </h4>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                      <div className="overflow-auto max-h-[500px] scrollbar-thin">
                        <table className="w-full text-left border-collapse table-fixed min-w-[max-content]">
                          <thead className="sticky top-0 z-30">
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-1 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-40 w-16 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                Intrvl
                              </th>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                return (
                                  <th
                                    key={idx}
                                    className={`p-1 text-[8px] font-black uppercase tracking-widest text-center border-l border-slate-100 w-16 
                                      ${row.isHoliday ? "text-rose-500 bg-rose-50" : isWeekEnd ? "bg-slate-100 text-slate-500" : "text-slate-400 bg-slate-50"}`}
                                  >
                                    <div className="flex flex-col scale-[0.85] leading-tight">
                                      <span className="opacity-60 font-medium">{formatInUTC(new Date(row.date), "EEE")}</span>
                                      <span className="font-extrabold">{formatInUTC(new Date(row.date), "dd MMM")}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {/* Summary Harian Row (At Top) */}
                            <tr className="bg-indigo-50/70 font-black text-indigo-700 border-b-2 border-slate-200">
                              <td className="p-1 px-2 text-[8px] uppercase sticky left-0 bg-indigo-50 z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                TOTAL
                              </td>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                return (
                                  <td key={idx} className={`p-1 text-center text-[9px] border-l border-indigo-100/30 ${row.isHoliday ? "bg-rose-50/50" : isWeekEnd ? "bg-slate-100/50" : ""}`}>
                                    {row.totalVolume.toLocaleString()}
                                  </td>
                                );
                              })}
                            </tr>
                            {(() => {
                              const numSlots = (24 * 60) / histIntervalSize;
                              return Array.from({ length: numSlots }).map((_, i) => {
                                const h = Math.floor((i * histIntervalSize) / 60);
                                const m = (i * histIntervalSize) % 60;
                                const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                                return (
                                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-1 px-2 text-[9px] font-black text-slate-400 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)] border-r border-slate-100 group-hover:text-indigo-600">
                                      {timeStr}
                                    </td>
                                    {processedHistorical.map((dateRow, dIdx) => {
                                      const val = dateRow.bins[timeStr]?.volume || 0;
                                      const dayNum = new Date(dateRow.date).getUTCDay();
                                      const isWeekEnd = dayNum === 0 || dayNum === 6;
                                      return (
                                        <td 
                                          key={dIdx} 
                                          className={`p-1 text-center text-[9px] border-l border-slate-50 font-bold tracking-tighter
                                            ${dateRow.isHoliday ? "bg-rose-50/30" : isWeekEnd ? "bg-slate-50/80" : ""}
                                            ${val > 0 ? "text-slate-700" : "text-slate-200"}`}
                                        >
                                          {val > 0 ? val.toLocaleString() : "-"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* FORECAST VOLUME TABLE */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BrainCircuit size={14} className="text-violet-600" />
                      <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                        2. Interval Forecast Table
                      </h4>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                      <div className="overflow-auto max-h-[500px] scrollbar-thin">
                        <table className="w-full text-left border-collapse table-fixed min-w-[max-content]">
                          <thead className="sticky top-0 z-30">
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-1 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-40 w-16 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                Intrvl
                              </th>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                return (
                                  <th
                                    key={idx}
                                    className={`p-1 text-[8px] font-black uppercase tracking-widest text-center border-l border-slate-100 w-16 
                                      ${row.isHoliday ? "text-rose-500 bg-rose-50" : isWeekEnd ? "bg-slate-100 text-slate-500" : "text-slate-400 bg-slate-50"}`}
                                  >
                                    <div className="flex flex-col scale-[0.85] leading-tight">
                                      <span className="opacity-60 font-medium">{formatInUTC(new Date(row.date), "EEE")}</span>
                                      <span className="font-extrabold">{formatInUTC(new Date(row.date), "dd MMM")}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {/* Summary Harian Row (At Top) */}
                            <tr className="bg-violet-50/70 font-black text-violet-700 border-b-2 border-slate-200">
                              <td className="p-1 px-2 text-[8px] uppercase sticky left-0 bg-violet-50 z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                TOTAL
                              </td>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                return (
                                  <td key={idx} className={`p-1 text-center text-[9px] border-l border-violet-100/30 ${row.isHoliday ? "bg-rose-50/50" : isWeekEnd ? "bg-slate-100/50" : ""}`}>
                                    {row.totalForecast?.toLocaleString() || "0"}
                                  </td>
                                );
                              })}
                            </tr>
                            {(() => {
                              const numSlots = (24 * 60) / histIntervalSize;
                              return Array.from({ length: numSlots }).map((_, i) => {
                                const h = Math.floor((i * histIntervalSize) / 60);
                                const m = (i * histIntervalSize) % 60;
                                const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                                return (
                                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-1 px-2 text-[9px] font-black text-slate-400 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)] border-r border-slate-100 group-hover:text-violet-600">
                                      {timeStr}
                                    </td>
                                    {processedHistorical.map((dateRow, dIdx) => {
                                      const val = dateRow.bins[timeStr]?.forecast || 0;
                                      const dayNum = new Date(dateRow.date).getUTCDay();
                                      const isWeekEnd = dayNum === 0 || dayNum === 6;
                                      return (
                                        <td 
                                          key={dIdx} 
                                          className={`p-1 text-center text-[9px] border-l border-slate-50 font-bold tracking-tighter
                                            ${dateRow.isHoliday ? "bg-rose-50/30" : isWeekEnd ? "bg-slate-50/80" : ""}
                                            ${val > 0 ? "text-violet-600" : "text-slate-200"}`}
                                        >
                                          {val > 0 ? val.toLocaleString() : "-"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* DISTRIBUTION TABLE */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <Sparkles size={14} className="text-amber-500" />
                       <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                         3. Distribution Table (%)
                       </h4>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                      <div className="overflow-auto max-h-[500px] scrollbar-thin">
                        <table className="w-full text-left border-collapse table-fixed min-w-[max-content]">
                          <thead className="sticky top-0 z-30">
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-1 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-40 w-16 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                Intrvl
                              </th>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                return (
                                  <th
                                    key={idx}
                                    className={`p-1 text-[8px] font-black uppercase tracking-widest text-center border-l border-slate-100 w-16 
                                      ${row.isHoliday ? "text-rose-500 bg-rose-50" : isWeekEnd ? "bg-slate-100 text-slate-500" : "text-slate-400 bg-slate-50"}`}
                                  >
                                    <div className="flex flex-col scale-[0.85] leading-tight">
                                      <span className="opacity-60 font-medium">{formatInUTC(new Date(row.date), "EEE")}</span>
                                      <span className="font-extrabold">{formatInUTC(new Date(row.date), "dd MMM")}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(() => {
                              const numSlots = (24 * 60) / histIntervalSize;
                              return Array.from({ length: numSlots }).map((_, i) => {
                                const h = Math.floor((i * histIntervalSize) / 60);
                                const m = (i * histIntervalSize) % 60;
                                const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                                return (
                                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-1 px-2 text-[9px] font-black text-slate-400 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)] border-r border-slate-100 group-hover:text-amber-600">
                                      {timeStr}
                                    </td>
                                    {processedHistorical.map((dateRow, dIdx) => {
                                      const val = dateRow.bins[timeStr]?.volume || 0;
                                      const pct = dateRow.totalVolume > 0 ? (val / dateRow.totalVolume) * 100 : 0;
                                      const dayNum = new Date(dateRow.date).getUTCDay();
                                      const isWeekEnd = dayNum === 0 || dayNum === 6;
                                      return (
                                        <td 
                                          key={dIdx} 
                                          className={`p-1 text-center text-[9px] border-l border-slate-50 font-bold tracking-tighter
                                            ${dateRow.isHoliday ? "bg-rose-50/30" : isWeekEnd ? "bg-slate-50/80" : ""}
                                            ${pct > 0 ? "text-amber-600" : "text-slate-200"}`}
                                        >
                                          {pct > 0 ? `${pct.toFixed(2)}%` : "-"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* AHT TABLE */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <Clock size={14} className="text-emerald-600" />
                       <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                         4. Average Handling Time (AHT)
                       </h4>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                      <div className="overflow-auto max-h-[500px] scrollbar-thin">
                        <table className="w-full text-left border-collapse table-fixed min-w-[max-content]">
                          <thead className="sticky top-0 z-30">
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="p-1 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-40 w-16 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                Intrvl
                              </th>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                return (
                                  <th
                                    key={idx}
                                    className={`p-1 text-[8px] font-black uppercase tracking-widest text-center border-l border-slate-100 w-16 
                                      ${row.isHoliday ? "text-rose-500 bg-rose-50" : isWeekEnd ? "bg-slate-100 text-slate-500" : "text-slate-400 bg-slate-50"}`}
                                  >
                                    <div className="flex flex-col scale-[0.85] leading-tight">
                                      <span className="opacity-60 font-medium">{formatInUTC(new Date(row.date), "EEE")}</span>
                                      <span className="font-extrabold">{formatInUTC(new Date(row.date), "dd MMM")}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {/* Summary AHT Harian Row (At Top) */}
                            <tr className="bg-emerald-50/70 font-black text-emerald-700 border-b-2 border-slate-200">
                              <td className="p-1 px-2 text-[8px] uppercase sticky left-0 bg-emerald-50 z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">
                                AVG AHT
                              </td>
                              {processedHistorical.map((row, idx) => {
                                const dayNum = new Date(row.date).getUTCDay();
                                const isWeekEnd = dayNum === 0 || dayNum === 6;
                                const dayTotalAht: number = Object.values(row.bins).reduce<number>((sum, b: any) => sum + b.totalAht, 0);
                                const dayAhtCount: number = Object.values(row.bins).reduce<number>((sum, b: any) => sum + b.ahtCount, 0);
                                const dayAvgAht = dayAhtCount > 0 ? Math.round(dayTotalAht / dayAhtCount) : 0;
                                return (
                                  <td key={idx} className={`p-1 text-center text-[9px] border-l border-emerald-100/30 ${row.isHoliday ? "bg-rose-50/50" : isWeekEnd ? "bg-slate-100/50" : ""}`}>
                                    {dayAvgAht > 0 ? `${dayAvgAht}s` : "-"}
                                  </td>
                                );
                              })}
                            </tr>
                            {(() => {
                              const numSlots = (24 * 60) / histIntervalSize;
                              return Array.from({ length: numSlots }).map((_, i) => {
                                const h = Math.floor((i * histIntervalSize) / 60);
                                const m = (i * histIntervalSize) % 60;
                                const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                                return (
                                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="p-1 px-2 text-[9px] font-black text-slate-400 sticky left-0 bg-white z-10 shadow-[1px_0_3px_rgba(0,0,0,0.05)] border-r border-slate-100 group-hover:text-emerald-600">
                                      {timeStr}
                                    </td>
                                    {processedHistorical.map((dateRow, dIdx) => {
                                      const bin = dateRow.bins[timeStr];
                                      const dayNum = new Date(dateRow.date).getUTCDay();
                                      const isWeekEnd = dayNum === 0 || dayNum === 6;
                                      const avgAht = bin && (bin as any).ahtCount > 0 ? Math.round((bin as any).totalAht / (bin as any).ahtCount) : 0;
                                      return (
                                        <td 
                                          key={dIdx} 
                                          className={`p-1 text-center text-[9px] border-l border-slate-50 font-bold tracking-tighter
                                            ${dateRow.isHoliday ? "bg-rose-50/30" : isWeekEnd ? "bg-slate-50/80" : ""}
                                            ${avgAht > 0 ? "text-emerald-700" : "text-slate-200"}`}
                                        >
                                          {avgAht > 0 ? `${avgAht}s` : "-"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Summary Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                       <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Database Summary</h5>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                             <span className="text-xs font-bold text-slate-600">Total Period Volume (Actual)</span>
                             <span className="text-sm font-black text-indigo-600">
                               {processedHistorical.reduce((sum, r) => sum + r.totalVolume, 0).toLocaleString()}
                             </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                             <span className="text-xs font-bold text-slate-600">Total Period Volume (Forecast)</span>
                             <span className="text-sm font-black text-violet-600">
                               {processedHistorical.reduce((sum, r) => sum + (r.totalForecast || 0), 0).toLocaleString()}
                             </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                             <span className="text-xs font-bold text-slate-600">Average Daily Volume</span>
                             <span className="text-sm font-black text-slate-800">
                               {processedHistorical.length > 0 ? Math.round(processedHistorical.reduce((sum, r) => sum + r.totalVolume, 0) / processedHistorical.length).toLocaleString() : 0}
                             </span>
                          </div>
                          <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-slate-600">Average Period AHT</span>
                             <span className="text-sm font-black text-emerald-600">
                               {(() => {
                                 const tAht = processedHistorical.reduce((sum, r) => sum + Object.values(r.bins).reduce<number>((s, b: any) => s + b.totalAht, 0), 0);
                                 const tCnt = processedHistorical.reduce((sum, r) => sum + Object.values(r.bins).reduce<number>((s, b: any) => s + b.ahtCount, 0), 0);
                                 return tCnt > 0 ? `${Math.round(tAht / tCnt)}s` : "-";
                               })()}
                             </span>
                          </div>
                       </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl text-white text-center">
                       <Trash2 size={32} className="text-rose-500 mb-4 opacity-50" />
                       <h5 className="text-sm font-black mb-1">Advanced Data Management</h5>
                       <p className="text-[10px] text-slate-400 mb-6 font-medium">Use the "Delete Forecast" tool in the sidebar or main header to perform batch cleanup of historical actuals.</p>
                       <button
                         onClick={() => {
                           const csvRows = [["Type", "Date", "Interval", "Value"]];
                           processedHistorical.forEach(row => {
                             Object.entries(row.bins).forEach(([time, b]) => {
                               csvRows.push(["Traffic Actual", row.date, time, (b as any).volume.toString()]);
                               csvRows.push(["Traffic Forecast", row.date, time, (b as any).forecast.toString()]);
                             });
                           });
                           const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                           const encodedUri = encodeURI(csvContent);
                           const link = document.createElement("a");
                           link.setAttribute("href", encodedUri);
                           link.setAttribute("download", `analysis_export_${channel}.csv`);
                           document.body.appendChild(link);
                           link.click();
                           document.body.removeChild(link);
                         }}
                         className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black transition-all border border-white/5 shadow-xl"
                       >
                         Download Analysis CSV
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Delete Forecast Modal */}
      {showDeleteForecastModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Delete Forecast Data</h3>
                <p className="text-xs text-slate-500 font-medium tracking-tight">This action is irreversible.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-8">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data Type</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button 
                    onClick={() => setDeleteForecastRange(prev => ({ ...prev, type: 'monthly' }))}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${deleteForecastRange.type === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Monthly
                  </button>
                  <button 
                    onClick={() => setDeleteForecastRange(prev => ({ ...prev, type: 'interval' }))}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${deleteForecastRange.type === 'interval' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Interval
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Start Date</label>
                  <input 
                    type="date"
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-rose-500 transition-all font-mono"
                    value={deleteForecastRange.start}
                    onChange={(e) => setDeleteForecastRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">End Date</label>
                  <input 
                    type="date"
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none focus:border-rose-500 transition-all font-mono"
                    value={deleteForecastRange.end}
                    onChange={(e) => setDeleteForecastRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteForecastModal(false)}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-all text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteForecast}
                disabled={isDeletingForecast}
                className="flex-1 px-4 py-3 rounded-2xl font-black text-white bg-rose-600 hover:bg-rose-700 transition-all text-xs shadow-lg shadow-rose-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeletingForecast ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
