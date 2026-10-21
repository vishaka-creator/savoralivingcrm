/** Savora works on India time, so "tomorrow" is the next calendar day in Asia/Kolkata. */
export function tomorrowInIndia(now: Date = new Date()): string {
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  ist.setUTCDate(ist.getUTCDate() + 1);
  return ist.toISOString().slice(0, 10);
}

export const MAX_SETS_PLANNED = 100000;

/** Parse a typed sets number: whole, non-negative; blank means 0. Returns null when invalid. */
export function parseSetsPlanned(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return 0;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= MAX_SETS_PLANNED ? n : null;
}
