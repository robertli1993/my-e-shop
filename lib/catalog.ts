export const CATEGORIES = [
  "Phones",
  "Computers",
  "Audio",
  "Gaming",
  "Wearables",
  "Accessories",
] as const;

export type Category = (typeof CATEGORIES)[number];
