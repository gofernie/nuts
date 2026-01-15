export const MOUNTAIN_STRIP_PRESETS = {
  default: {
    opacity: 0.095,
    height: 48,
    color: "17,24,39",   // charcoal (neutral, elegant)
    blend: "multiply",
    bgOpacity: 0.035,
  },

  winter: {
    opacity: 0.12,
    height: 52,
    color: "95,133,199", // Fernie blue
    blend: "multiply",
    bgOpacity: 0.045,
  },

  fernGreen: {
  opacity: 0.11,
  height: 50,
  color: "56,112,74",   // deep pine green
  blend: "multiply",
  bgOpacity: 0.045,
},

alpineBlue: {
  opacity: 0.12,
  height: 52,
  color: "90,138,198",  // Fernie blue
  blend: "multiply",
  bgOpacity: 0.05,
},

copperRidge: {
  opacity: 0.13,
  height: 54,
  color: "168,96,58",   // soft copper / terracotta
  blend: "multiply",
  bgOpacity: 0.055,
},

luxuryGold: {
  opacity: 0.16,
  height: 58,
  color: "170,140,70",  // muted gold
  blend: "multiply",
  bgOpacity: 0.06,
},

ember: {
  opacity: 0.14,
  height: 54,
  color: "156,58,46",   // burnt red
  blend: "multiply",
  bgOpacity: 0.055,
},





  luxury: {
    opacity: 0.14,
    height: 56,
    color: "46,41,36",   // warm charcoal
    blend: "multiply",
    bgOpacity: 0.05,
  },
} as const;

export type MountainStripPreset = keyof typeof MOUNTAIN_STRIP_PRESETS;
