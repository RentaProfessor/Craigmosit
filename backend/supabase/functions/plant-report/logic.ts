// Plant rule engine, ported from plant_report_logic.js.
// Pure functions — no I/O — so this is easy to unit-test if you ever want to.

import type { PlantProfile } from "./plants.ts";

export const RAIN_SKIP_MM = 5;   // ~0.2 inch
export const HOT_DAY_C    = 30;

export type Status =
  | "very_dry"
  | "dry"
  | "dry_rain_coming"
  | "good"
  | "good_hot_warning"
  | "too_wet"
  | "no_reading";

export type Weather = {
  rainSoonMm: number | null;
  highTodayC: number | null;
};

export type PlantReading = {
  plant: PlantProfile;
  moisture: number | null;
  battery: number | null;
  status: Status;
  headline: string;        // short tag for the UI badge
  advice: string;          // 1-2 sentence note
  needsWater: boolean;
};

const num = (x: unknown): number | null => {
  if (x === null || x === undefined) return null;
  const n = parseFloat(String(x));
  return Number.isFinite(n) ? n : null;
};

export function parseWeather(openMeteo: any): Weather {
  const d = openMeteo?.daily ?? {};
  const rainToday    = num(d.precipitation_sum?.[0]);
  const rainTomorrow = num(d.precipitation_sum?.[1]);
  const highToday    = num(d.temperature_2m_max?.[0]);
  const known = rainToday !== null || rainTomorrow !== null;
  return {
    rainSoonMm: known ? (rainToday ?? 0) + (rainTomorrow ?? 0) : null,
    highTodayC: highToday,
  };
}

export function advise(p: PlantProfile, m: number, wx: Weather): Omit<PlantReading, "plant" | "moisture" | "battery"> {
  const hot = wx.highTodayC !== null && wx.highTodayC >= HOT_DAY_C && p.heat_sensitive;
  const rainComing = wx.rainSoonMm !== null && wx.rainSoonMm >= RAIN_SKIP_MM;

  if (m < p.low) {
    const gap = p.low - m;
    const veryDry = gap >= 10 || (p.drought_tolerant ? gap >= 15 : false);
    if (rainComing) {
      return {
        status: "dry_rain_coming",
        headline: veryDry ? "Dry — but rain coming" : "Slightly dry — rain coming",
        advice: `Skip watering. ~${Math.round(wx.rainSoonMm!)}mm rain expected soon should bring it up.` +
                (veryDry ? " Check again after if it stays low." : ""),
        needsWater: false,
      };
    }
    const advice = `Water ${hot ? "today (hot day — don't let it stress)." : "today."} Target ${p.low}–${p.high}%.`;
    return {
      status: veryDry ? "very_dry" : "dry",
      headline: veryDry ? "VERY DRY" : "Dry",
      advice,
      needsWater: true,
    };
  }

  if (m > p.high) {
    const advice = `Hold off — let it dry toward ${p.high}%.` +
      (p.dries_between
        ? " This one likes drying out between waterings, so no worry."
        : " Stay alert for root rot if it stays soggy.");
    return { status: "too_wet", headline: "Too wet", advice, needsWater: false };
  }

  if (hot) {
    return {
      status: "good_hot_warning",
      headline: "In range, hot day",
      advice: "In range, but a hot day's coming — check it again this evening.",
      needsWater: false,
    };
  }
  return { status: "good", headline: "Good", advice: "In the ideal range — no action needed.", needsWater: false };
}

export function advisePair(deep: PlantReading | undefined, shallow: PlantReading | undefined): string | null {
  if (!deep || !shallow || deep.moisture === null || shallow.moisture === null) return null;
  const dDeep = deep.plant.low - deep.moisture;
  const dShallow = shallow.plant.low - shallow.moisture;
  if (dDeep <= 0 && dShallow > 0) {
    return "Top is dry but the root zone still has moisture — a light surface watering is enough, don't deep-soak.";
  }
  if (dDeep > 0 && dShallow > 0) {
    return "Both the surface and the root zone are dry — give it a slow deep soak.";
  }
  if (dDeep > 0 && dShallow <= 0) {
    return "Surface looks fine but the deep root zone is drying — water more slowly so it reaches deeper.";
  }
  return null;
}
