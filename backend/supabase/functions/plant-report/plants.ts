// PLANT REGISTRY
// Each entry maps (zone, channel) -> plant profile used by the rule engine.
//
// IMPORTANT: Ecowitt's API does NOT return the labels you set in the app —
// the channel-to-plant mapping below has to live here. Edit `name` for any
// channel whose mapping you confirm from screenshots / the Ecowitt app.
//
// Profile fields (see PROJECT_SPEC.md §5–6):
//   low / high         ideal moisture band, %
//   dries_between      prefers to dry out between waterings
//   drought_tolerant   a dry reading is less urgent
//   heat_sensitive     bump urgency on hot days
//   pair               link two probes on one plant (e.g. avocado deep+shallow)

export type PlantProfile = {
  zone: "Back Yard" | "Side Yards";
  channel: number;
  name: string;
  type: string;
  low: number;
  high: number;
  dries_between: boolean;
  drought_tolerant: boolean;
  heat_sensitive: boolean;
  pair?: string;        // shared key across paired probes (e.g. "avocado-main")
  pair_role?: "deep" | "shallow";
  verified?: boolean;   // set true once you confirm name from a screenshot
};

const citrus = { type: "citrus",        low: 40, high: 60, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const avocado = { type: "avocado",      low: 40, high: 60, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const med    =  { type: "mediterranean",low: 20, high: 40, dries_between: true,  drought_tolerant: true,  heat_sensitive: false };
const broad  =  { type: "broadleaf",    low: 35, high: 55, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const hydra  =  { type: "hydrangea",    low: 40, high: 60, dries_between: false, drought_tolerant: false, heat_sensitive: true  };
const boxwood = { type: "boxwood",      low: 30, high: 50, dries_between: false, drought_tolerant: true,  heat_sensitive: false };
const ground  = { type: "groundcover",  low: 20, high: 40, dries_between: true,  drought_tolerant: true,  heat_sensitive: false };

// Best-guess starting map. Channels keyed by current live moisture values
// where the spec snapshot was unambiguous; others are placeholders.
// Mark `verified: true` and adjust `name`/profile as you confirm each one.
export const PLANTS: PlantProfile[] = [
  // ---------- BACK YARD (16 channels) ----------
  { zone: "Back Yard", channel: 1,  name: "Bay Laurel (Pool Equipment)", ...med,     verified: false },
  { zone: "Back Yard", channel: 2,  name: "Convolvulus (Pool)",          ...ground,  verified: false },
  { zone: "Back Yard", channel: 3,  name: "Hydrangea",                   ...hydra,   verified: false },
  { zone: "Back Yard", channel: 4,  name: "Avocado Shallow",             ...avocado, pair: "avocado-main", pair_role: "shallow", verified: false },
  { zone: "Back Yard", channel: 5,  name: "Lemon Tree",                  ...citrus,  verified: true  }, // value-pinned (29%)
  { zone: "Back Yard", channel: 6,  name: "Naval Orange",                ...citrus,  verified: false },
  { zone: "Back Yard", channel: 7,  name: "Ruby Red Grapefruit",         ...citrus,  verified: true  }, // value-pinned (60%)
  { zone: "Back Yard", channel: 8,  name: "Avocado Deep",                ...avocado, pair: "avocado-main", pair_role: "deep", verified: false },
  { zone: "Back Yard", channel: 9,  name: "Pool Hill Westringia",        ...med,     verified: false },
  { zone: "Back Yard", channel: 10, name: "Small Lime Tree",             ...citrus,  verified: false },
  { zone: "Back Yard", channel: 11, name: "Small Avocado",               ...avocado, verified: false },
  { zone: "Back Yard", channel: 12, name: "Mandarin",                    ...citrus,  verified: false },
  { zone: "Back Yard", channel: 13, name: "Small Grapefruit Tree",       ...citrus,  verified: false },
  { zone: "Back Yard", channel: 14, name: "Cara Cara Orange",            ...citrus,  verified: false },
  { zone: "Back Yard", channel: 15, name: "Oro Blanco",                  ...citrus,  verified: false },
  { zone: "Back Yard", channel: 16, name: "Large Tangerine",             ...citrus,  verified: true  }, // value-pinned (51%)

  // ---------- SIDE YARDS (8 channels) ----------
  { zone: "Side Yards", channel: 1, name: "Camelia",                  ...broad,   verified: false },
  { zone: "Side Yards", channel: 2, name: "Cook Center Rosemary",     ...med,     verified: false }, // value-pinned (58%)
  { zone: "Side Yards", channel: 3, name: "Driveway Boxwood",         ...boxwood, verified: false },
  { zone: "Side Yards", channel: 4, name: "Cook Center Hill",         ...med,     verified: false }, // type unconfirmed
  { zone: "Side Yards", channel: 5, name: "Cook Center Star Jasmine", ...broad,   verified: false }, // value-pinned (60%)
  { zone: "Side Yards", channel: 6, name: "Front Yard Lavender",      ...med,     verified: false },
  { zone: "Side Yards", channel: 7, name: "Bay Laurel (Behind Spit)", ...med,     verified: false },
  { zone: "Side Yards", channel: 8, name: "Westringia (Office)",      ...med,     verified: false },
];
