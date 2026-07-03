// Courbes merchant Aurora VERSIONNÉES — millésime 2026-Q2.
// Deux jeux par technologie ("fixed" / "tracker"), + la courbe de prix capacité (partagée).
//
// ⚠️ Le modèle Prisma `AuroraCurve` a `year @unique` GLOBALEMENT et la page projet charge
// TOUTES les courbes sans filtre techno → la table ne peut porter qu'UNE techno à la fois.
// Ces jeux sont donc stockés ici (versionnés en git) et injectés par l'importeur selon la
// techno du projet (r86 du BizDev). Le moteur reste inchangé — il consomme `auroraCurves`.
//
// FIXED = la série calée à l'euro sur Baugé/Sigoulès/Digoin (BP signés). TRACKER = série pipe.

export type MerchantCurvePoint = {
  year: number;
  high: number;
  central: number;
  low: number;
};

export const MERCHANT_CURVE_VINTAGE = "2026-Q2";

// Techno "Fixed" — identique aux bancs de calibration (BP Baugé/Sigoulès/Digoin).
export const FIXED_CURVE_2026Q2: MerchantCurvePoint[] = [
  { year: 2025, high: 81, central: 42, low: 32 },
  { year: 2026, high: 80.77, central: 40.94, low: 31.16 },
  { year: 2027, high: 68.2, central: 34.03, low: 25.97 },
  { year: 2028, high: 67.93, central: 33.41, low: 25.89 },
  { year: 2029, high: 62.95, central: 34.92, low: 26.83 },
  { year: 2030, high: 62.29, central: 39.58, low: 30.28 },
  { year: 2031, high: 63.03, central: 42.98, low: 31.28 },
  { year: 2032, high: 62.27, central: 42.76, low: 31.06 },
  { year: 2033, high: 60.77, central: 42.8, low: 31.21 },
  { year: 2034, high: 64.48, central: 47.65, low: 35.02 },
  { year: 2035, high: 62.64, central: 47.78, low: 36.23 },
  { year: 2036, high: 62.21, central: 49.72, low: 38.51 },
  { year: 2037, high: 62.64, central: 51.43, low: 39.84 },
  { year: 2038, high: 61.25, central: 50.89, low: 39.69 },
  { year: 2039, high: 61.53, central: 51.31, low: 40.27 },
  { year: 2040, high: 60, central: 50.87, low: 40.49 },
  { year: 2041, high: 60, central: 51.33, low: 41.28 },
  { year: 2042, high: 60, central: 51.32, low: 41.61 },
  { year: 2043, high: 60, central: 50.25, low: 41.92 },
  { year: 2044, high: 60, central: 48.54, low: 41.69 },
  { year: 2045, high: 60, central: 47.17, low: 40.77 },
  { year: 2046, high: 60, central: 47.38, low: 41.26 },
  { year: 2047, high: 60, central: 47.58, low: 40.38 },
  { year: 2048, high: 60, central: 47.43, low: 38.9 },
  { year: 2049, high: 60, central: 47.13, low: 37.78 },
  { year: 2050, high: 60, central: 45.16, low: 35.46 },
  { year: 2051, high: 60, central: 44.46, low: 36.34 },
  { year: 2052, high: 60, central: 43.11, low: 36.16 },
  { year: 2053, high: 60, central: 42.6, low: 35.92 },
  { year: 2054, high: 60, central: 43.35, low: 37.17 },
  { year: 2055, high: 60, central: 43.53, low: 37.22 },
  { year: 2056, high: 60, central: 42.82, low: 34.4 },
  { year: 2057, high: 60, central: 42.83, low: 33.7 },
  { year: 2058, high: 60, central: 42.22, low: 31.9 },
  { year: 2059, high: 60, central: 42.69, low: 32.95 },
  { year: 2060, high: 60, central: 42.15, low: 33.09 },
];

// Techno "Tracker" — millésime 2026-Q2 (nouvelle courbe pipe).
export const TRACKER_CURVE_2026Q2: MerchantCurvePoint[] = [
  { year: 2025, high: 84, central: 40, low: 33 },
  { year: 2026, high: 84.29, central: 43.1, low: 32.75 },
  { year: 2027, high: 71.04, central: 35.86, low: 27.51 },
  { year: 2028, high: 70.89, central: 35.49, low: 27.45 },
  { year: 2029, high: 66.4, central: 37.28, low: 28.46 },
  { year: 2030, high: 65.69, central: 41.99, low: 31.96 },
  { year: 2031, high: 66.35, central: 45.53, low: 32.92 },
  { year: 2032, high: 65.49, central: 45.27, low: 32.74 },
  { year: 2033, high: 63.77, central: 45.13, low: 32.75 },
  { year: 2034, high: 67.45, central: 49.89, low: 36.49 },
  { year: 2035, high: 65.45, central: 49.89, low: 37.63 },
  { year: 2036, high: 64.94, central: 51.63, low: 39.72 },
  { year: 2037, high: 65.08, central: 53.16, low: 40.9 },
  { year: 2038, high: 63.28, central: 52.44, low: 40.63 },
  { year: 2039, high: 63.22, central: 52.62, low: 41.06 },
  { year: 2040, high: 62.54, central: 51.95, low: 41.15 },
  { year: 2041, high: 62.37, central: 52.19, low: 41.78 },
  { year: 2042, high: 61.84, central: 52.06, low: 42.04 },
  { year: 2043, high: 60.44, central: 50.87, low: 42.3 },
  { year: 2044, high: 58.88, central: 49.11, low: 42.02 },
  { year: 2045, high: 56.69, central: 47.63, low: 41.04 },
  { year: 2046, high: 55.61, central: 47.72, low: 41.44 },
  { year: 2047, high: 54.85, central: 47.87, low: 40.54 },
  { year: 2048, high: 54.17, central: 47.67, low: 39.05 },
  { year: 2049, high: 54.6, central: 47.3, low: 37.9 },
  { year: 2050, high: 53.67, central: 45.28, low: 35.56 },
  { year: 2051, high: 53.69, central: 44.57, low: 36.42 },
  { year: 2052, high: 53.03, central: 43.17, low: 36.23 },
  { year: 2053, high: 52.01, central: 42.58, low: 36 },
  { year: 2054, high: 52.4, central: 43.29, low: 37.26 },
  { year: 2055, high: 52.87, central: 43.38, low: 37.28 },
  { year: 2056, high: 51.59, central: 42.63, low: 34.46 },
  { year: 2057, high: 51.73, central: 42.58, low: 33.78 },
  { year: 2058, high: 50.41, central: 41.95, low: 31.96 },
  { year: 2059, high: 50.71, central: 42.42, low: 33.02 },
  { year: 2060, high: 49.95, central: 41.86, low: 32.83 },
];

// Prix du certificat de capacité (marché capacité, indépendant de la techno). Partagé.
export const CAPACITY_PRICE_CURVE: number[] = [
  23.53, 5.4, 30.84, 30.79, 30.22, 29.57, 30.64, 30.58, 30.53, 29.06,
  29.06, 5.4, 5.4, 5.4, 5.4, 70.63, 70.63, 74.03, 74.03, 70.69,
  70.69, 88.0, 88.0, 68.78, 68.78, 21.63, 21.63, 22.35, 22.35, 22.35,
  22.35, 61.34, 61.34, 61.44, 61.44, 84.9,
];

export function merchantCurveForTechnology(technology: string): MerchantCurvePoint[] {
  return /track/i.test(technology) ? TRACKER_CURVE_2026Q2 : FIXED_CURVE_2026Q2;
}
