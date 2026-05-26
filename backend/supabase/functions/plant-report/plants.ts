// PLANT REGISTRY — locked to the Ecowitt app screenshots (May 25 2026)
// and tuned with research-backed care profiles from UC IPM, UC ANR Master
// Gardener programs, and the California Avocado Commission.
//
// `display` is the tile position in the Ecowitt iPad dashboard so the
// clients show plants in the same order Dad sees in Ecowitt.
// `verified: true`  → channel uniquely pinned by an unambiguous live value
// `verified: false` → multiple channels shared the same value, channel
//                      assigned by sequential best-guess.

export type CareProfile = {
  low: number;            // ideal moisture band lower bound (%)
  high: number;           // ideal moisture band upper bound (%)
  dries_between: boolean; // tolerates drying between waterings
  drought_tolerant: boolean;
  heat_sensitive: boolean;
  species: string;        // canonical species key
  note: string;           // species-specific care reminder (shown in advice)
};

// Research-tuned profiles (see PLANT_CARE_REPORT.md for citations)
export const PROFILES: Record<string, CareProfile> = {
  citrus: {
    low: 40, high: 60, dries_between: false, drought_tolerant: false, heat_sensitive: true,
    species: "citrus",
    note: "Needs 4–6\" of water/month in summer (UC IPM). Underwatering shows up as small, sunburned fruit; overwatering invites root and crown rot.",
  },
  avocado: {
    // CA Avocado Commission: ~2"/week in summer; root rot if soggy
    low: 45, high: 65, dries_between: false, drought_tolerant: false, heat_sensitive: true,
    species: "avocado",
    note: "Mature trees use ~2\" of water/week in summer (CA Avocado Commission). Highly susceptible to root rot — never let it sit wet, but 7–10 days of drought stress will drop leaves and fruit.",
  },
  camellia: {
    // UC MG: more often killed by OVER-watering than under
    low: 35, high: 50, dries_between: false, drought_tolerant: false, heat_sensitive: true,
    species: "camellia",
    note: "More often killed by over-watering than under (UC MG). Deep-water once a week in summer; protect from hot afternoon sun. Bud drop = summer water stress.",
  },
  rosemary: {
    low: 18, high: 38, dries_between: true, drought_tolerant: true, heat_sensitive: false,
    species: "rosemary",
    note: "Established rosemary needs no summer water (UC MG Sonoma). Wet roots are far worse than dry — soggy soil rots it fast.",
  },
  westringia: {
    low: 20, high: 40, dries_between: true, drought_tolerant: true, heat_sensitive: false,
    species: "westringia",
    note: "Australian coast rosemary — drought tolerant, but appreciates occasional summer water in inland heat (UC Marin MG).",
  },
  lavender: {
    low: 22, high: 40, dries_between: true, drought_tolerant: true, heat_sensitive: false,
    species: "lavender",
    note: "Drought-tolerant but adequate moisture is needed during growth (UC MG). Excellent drainage is non-negotiable — root rot if water sits.",
  },
  bay_laurel: {
    low: 22, high: 42, dries_between: true, drought_tolerant: true, heat_sensitive: false,
    species: "bay-laurel",
    note: "Established (2+ yr) bay laurel adapts to low water; still needs irrigation during extended dry spells (UC MG Sonoma).",
  },
  star_jasmine: {
    low: 32, high: 52, dries_between: false, drought_tolerant: false, heat_sensitive: true,
    species: "star-jasmine",
    note: "Established vines need only modest irrigation; bump water during extreme heat (UC IPM). Well-drained soil only.",
  },
  boxwood: {
    low: 28, high: 50, dries_between: false, drought_tolerant: true, heat_sensitive: false,
    species: "boxwood",
    note: "Slow, deep watering > frequent shallow (UC MG Alameda). Drip irrigation only — overhead water spreads boxwood blight.",
  },
  unknown: {
    low: 25, high: 45, dries_between: false, drought_tolerant: true, heat_sensitive: false,
    species: "unknown",
    note: "Species not yet confirmed; treated as a generic moderate-water shrub.",
  },
};

export type PlantEntry = {
  zone:     "Back Yard" | "Side Yards";
  channel:  number;
  display:  number;       // tile position in the Ecowitt app
  name:     string;
  profile:  keyof typeof PROFILES;
  verified: boolean;
};

export const PLANTS: PlantEntry[] = [
  // ─── BACK YARD gateway (16 sensors) ─────────────────────────────────
  { zone:"Back Yard",  channel:4,  display:1,  name:"Cook Center Hill",         profile:"unknown",      verified:false },
  { zone:"Back Yard",  channel:1,  display:2,  name:"Camelia",                  profile:"camellia",     verified:false },
  { zone:"Back Yard",  channel:2,  display:3,  name:"Cook Center Rosemary",     profile:"rosemary",     verified:true  },
  { zone:"Back Yard",  channel:9,  display:4,  name:"Pool Hill Westringia",     profile:"westringia",   verified:false },
  { zone:"Back Yard",  channel:3,  display:5,  name:"Front Yard Lavender",      profile:"lavender",     verified:false },
  { zone:"Back Yard",  channel:12, display:6,  name:"Small Grapefruit Tree",    profile:"citrus",       verified:false },
  { zone:"Back Yard",  channel:11, display:7,  name:"Cara Cara",                profile:"citrus",       verified:false },
  { zone:"Back Yard",  channel:10, display:8,  name:"Naval Orange",             profile:"citrus",       verified:false },
  { zone:"Back Yard",  channel:5,  display:9,  name:"Cook Center Star Jasmine", profile:"star_jasmine", verified:false },
  { zone:"Back Yard",  channel:16, display:10, name:"Large Tangerine",          profile:"citrus",       verified:true  },
  { zone:"Back Yard",  channel:13, display:11, name:"Mandarin",                 profile:"citrus",       verified:false },
  { zone:"Back Yard",  channel:6,  display:12, name:"Driveway Boxwood",         profile:"boxwood",      verified:false },
  { zone:"Back Yard",  channel:7,  display:13, name:"Bay Laurel Behind Spit",   profile:"bay_laurel",   verified:true  },
  { zone:"Back Yard",  channel:14, display:14, name:"Small Avocado",            profile:"avocado",      verified:false },
  { zone:"Back Yard",  channel:8,  display:15, name:"Westringia Office",        profile:"westringia",   verified:true  },
  { zone:"Back Yard",  channel:15, display:16, name:"Avocado Shallow",          profile:"avocado",      verified:false },

  // ─── SIDE YARDS gateway (8 sensors) ─────────────────────────────────
  { zone:"Side Yards", channel:1, display:1, name:"Camelia",                    profile:"camellia",     verified:true  },
  { zone:"Side Yards", channel:2, display:2, name:"Cook Center Rosemary",       profile:"rosemary",     verified:true  },
  { zone:"Side Yards", channel:5, display:3, name:"Cook Center Star Jasmine",   profile:"star_jasmine", verified:true  },
  { zone:"Side Yards", channel:4, display:4, name:"Cook Center Hill",           profile:"unknown",      verified:true  },
  { zone:"Side Yards", channel:7, display:5, name:"Bay Laurel Behind Spit",     profile:"bay_laurel",   verified:true  },
  { zone:"Side Yards", channel:3, display:6, name:"Front Yard Lavender",        profile:"lavender",     verified:false },
  { zone:"Side Yards", channel:6, display:7, name:"Driveway Boxwood",           profile:"boxwood",      verified:true  },
  { zone:"Side Yards", channel:8, display:8, name:"Westringia Office",          profile:"westringia",   verified:false },
];
