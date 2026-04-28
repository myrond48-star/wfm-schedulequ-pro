const abdTable = [
  0.670, 0.665, 0.658, 0.650, 0.642, 0.638, 0.630, 0.622, 0.619, 0.611, 0.605, 0.599, 0.590, 0.581, 0.576, 
  0.570, 0.565, 0.559, 0.540, 0.541, 0.536, 0.530, 0.522, 0.515, 0.509, 0.500, 0.491, 0.488, 0.480, 0.471, 
  0.468, 0.459, 0.452, 0.448, 0.440, 0.431, 0.426, 0.420, 0.411, 0.405, 0.400, 0.391, 0.386, 0.380, 0.371, 
  0.369, 0.360, 0.351, 0.345, 0.340, 0.332, 0.326, 0.319, 0.311, 0.305, 0.299, 0.291, 0.286, 0.279, 0.271, 
  0.266, 0.259, 0.251, 0.245, 0.239, 0.231, 0.225, 0.219, 0.210, 0.205, 0.199, 0.191, 0.182, 0.179, 0.170, 
  0.165, 0.159, 0.150, 0.145, 0.139, 0.131, 0.125, 0.119, 0.111, 0.105, 0.100, 0.091, 0.085, 0.079, 0.071, 
  0.065, 0.059, 0.053, 0.046, 0.038, 0.030, 0.025, 0.020, 0.013, 0.008, 0.000
];

const MaxAccuracy = 0.00001;

function MinMax(input: number, min: number, max: number) {
  if (isNaN(input) || !isFinite(input)) return min;
  return Math.min(Math.max(input, min), max);
}

function ErlangB(Servers: number, Intensity: number) {
  if (Servers < 0 || Intensity < 0 || isNaN(Servers) || isNaN(Intensity)) return 0;
  let s = Math.floor(Servers);
  let B = 1;
  for (let i = 1; i <= s; i++) {
    B = (Intensity * B) / (i + (Intensity * B));
  }
  return MinMax(B, 0, 1);
}

export function calculateAgents(
  SLA: number,
  ServiceTime: number,
  CallsPerHour: number, // volume for the given duration
  AHT: number,
  Shrinkage: number = 0,
  MaxOccupancy: number = 0.85,
  Duration: number = 3600,
  isOpenDay: boolean = true,
  channel: string = "Call"
): number {
  try {
    if (!isOpenDay) return 0;
    if (CallsPerHour <= 0 || AHT <= 0 || Duration <= 0) return 0;

    let shrinkPct = MinMax(Shrinkage > 1 ? Shrinkage / 100 : Shrinkage, 0, 0.99);
    let maxOccPct = MinMax(MaxOccupancy > 1 ? MaxOccupancy / 100 : MaxOccupancy, 0.1, 1);
    
    let TrafficRate = CallsPerHour / (Duration / AHT);
    if (isNaN(TrafficRate) || !isFinite(TrafficRate)) return 1;

    let NoAgents = 1;

    if (channel === "Call") {
      let slaPct = MinMax(Math.round((SLA > 1 ? SLA / 100 : SLA) * 100), 0, 100);
      let abdRate = abdTable[slaPct] || 0;
      let EffectiveCallsPerHour = CallsPerHour * (1 - abdRate);
      if (EffectiveCallsPerHour <= 0) return 1;
      
      TrafficRate = EffectiveCallsPerHour / (Duration / AHT);
      NoAgents = Math.max(1, Math.floor(TrafficRate) + 1);
      let currentB = ErlangB(NoAgents, TrafficRate);

      for(let count = 0; count < 5000; count++) {
        let utilization = TrafficRate / NoAgents;
        if (utilization >= 1) utilization = 0.9999;

        let C = currentB / ((utilization * currentB) + (1 - utilization));
        let SLQueued = 1 - C * Math.exp((TrafficRate - NoAgents) * ServiceTime / AHT);
        SLQueued = Math.max(SLQueued, 0);

        if (SLQueued >= (SLA > 1 ? SLA/100 : SLA) || SLQueued > (1 - MaxAccuracy)) break;

        NoAgents++;
        currentB = (TrafficRate * currentB) / (NoAgents + (TrafficRate * currentB));
      }

      while ((TrafficRate / NoAgents) > maxOccPct) {
        NoAgents++;
      }
    } else {
      // Non-Voice Workload Calculation (Digital / Email / Socmed)
      // Because non-voice doesn't have immediate abandon or traditional call queueing, 
      // we base agents purely on raw workload divided by allowed max occupancy per interval.
      NoAgents = TrafficRate / maxOccPct;
    }

    // Shrinkage is ALWAYS applied at the interval level. 
    // This scales up the required Base Agents to account for breaks, absenteeism, etc.
    let result = Math.max(Math.ceil(NoAgents / (1 - shrinkPct)), 1);
    return result;
  } catch (err) {
    return 1;
  }
}
