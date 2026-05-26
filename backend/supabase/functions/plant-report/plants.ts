// PLANT REGISTRY — locked to the Ecowitt app screenshots (May 25 2026).
// Channels were matched by value-pinning against live readings at the
// moment the screenshots were taken. `display` is the tile position in
// the Ecowitt iPad dashboard (left-to-right, top-to-bottom), so the
// web + iOS clients show plants in the same order Dad sees in Ecowitt.
//
// `verified: true`  → channel uniquely pinned by an unambiguous live value
// `verified: false` → multiple channels shared the same value, channel
//                      assigned by sequential best-guess (still likely correct,
//                      but worth confirming the next time you're at the iPad).

export type PlantProfile = {
  zone:    "Back Yard" | "Side Yards";
  channel: number;
  display: number;       // tile position in the Ecowitt app
  name:    string;
  type:    string;
  low:     number;
  high:    number;
  dries_between:    boolean;
  drought_tolerant: boolean;
  heat_sensitive:   boolean;
  verified?: boolean;
};

// Profiles
const citrus  = { type: "citrus",        low: 40, high: 60, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const avocado = { type: "avocado",       low: 40, high: 60, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const med     = { type: "mediterranean", low: 20, high: 40, dries_between: true,  drought_tolerant: true,  heat_sensitive: false };
const broad   = { type: "broadleaf",     low: 35, high: 55, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const boxwd   = { type: "boxwood",       low: 30, high: 50, dries_between: false, drought_tolerant: true,  heat_sensitive: false };

export const PLANTS: PlantProfile[] = [
  // ─── BACK YARD gateway (16 sensors) ───────────────────────────────
  { zone:"Back Yard",  channel:4,  display:1,  name:"Cook Center Hill",         ...med,     verified:false },
  { zone:"Back Yard",  channel:1,  display:2,  name:"Camelia",                  ...broad,   verified:false },
  { zone:"Back Yard",  channel:2,  display:3,  name:"Cook Center Rosemary",     ...med,     verified:true  },
  { zone:"Back Yard",  channel:9,  display:4,  name:"Pool Hill Westringia",     ...med,     verified:false },
  { zone:"Back Yard",  channel:3,  display:5,  name:"Front Yard Lavender",      ...med,     verified:false },
  { zone:"Back Yard",  channel:12, display:6,  name:"Small Grapefruit Tree",    ...citrus,  verified:false },
  { zone:"Back Yard",  channel:11, display:7,  name:"Cara Cara",                ...citrus,  verified:false },
  { zone:"Back Yard",  channel:10, display:8,  name:"Naval Orange",             ...citrus,  verified:false },
  { zone:"Back Yard",  channel:5,  display:9,  name:"Cook Center Star Jasmine", ...broad,   verified:false },
  { zone:"Back Yard",  channel:16, display:10, name:"Large Tangerine",          ...citrus,  verified:true  },
  { zone:"Back Yard",  channel:13, display:11, name:"Mandarin",                 ...citrus,  verified:false },
  { zone:"Back Yard",  channel:6,  display:12, name:"Driveway Boxwood",         ...boxwd,   verified:false },
  { zone:"Back Yard",  channel:7,  display:13, name:"Bay Laurel Behind Spit",   ...med,     verified:true  },
  { zone:"Back Yard",  channel:14, display:14, name:"Small Avocado",            ...avocado, verified:false },
  { zone:"Back Yard",  channel:8,  display:15, name:"Westringia Office",        ...med,     verified:true  },
  { zone:"Back Yard",  channel:15, display:16, name:"Avocado Shallow",          ...avocado, verified:false },

  // ─── SIDE YARDS gateway (8 sensors) ───────────────────────────────
  { zone:"Side Yards", channel:1, display:1, name:"Camelia",                    ...broad,  verified:true  },
  { zone:"Side Yards", channel:2, display:2, name:"Cook Center Rosemary",       ...med,    verified:true  },
  { zone:"Side Yards", channel:5, display:3, name:"Cook Center Star Jasmine",   ...broad,  verified:true  },
  { zone:"Side Yards", channel:4, display:4, name:"Cook Center Hill",           ...med,    verified:true  },
  { zone:"Side Yards", channel:7, display:5, name:"Bay Laurel Behind Spit",     ...med,    verified:true  },
  { zone:"Side Yards", channel:3, display:6, name:"Front Yard Lavender",        ...med,    verified:false },
  { zone:"Side Yards", channel:6, display:7, name:"Driveway Boxwood",           ...boxwd,  verified:true  },
  { zone:"Side Yards", channel:8, display:8, name:"Westringia Office",          ...med,    verified:false },
];
