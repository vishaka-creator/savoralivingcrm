export type WareRemarks = {
  influencer: string;
  showroom: string;
  other: string;
};

const STORAGE_PREFIX = "savora:ware-remarks:";

export function parseWareRemarks(value: string | null): WareRemarks {
  const empty: WareRemarks = { influencer: "", showroom: "", other: "" };
  if (!value) return empty;

  if (value.startsWith(STORAGE_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(STORAGE_PREFIX.length)) as Partial<WareRemarks>;
      return {
        influencer: typeof parsed.influencer === "string" ? parsed.influencer : "",
        showroom: typeof parsed.showroom === "string" ? parsed.showroom : "",
        other: typeof parsed.other === "string" ? parsed.other : "",
      };
    } catch {
      return { ...empty, other: value };
    }
  }

  return { ...empty, other: value };
}

export function serializeWareRemarks(value: WareRemarks): string | null {
  const remarks = {
    influencer: value.influencer.trim(),
    showroom: value.showroom.trim(),
    other: value.other.trim(),
  };
  return Object.values(remarks).some(Boolean)
    ? `${STORAGE_PREFIX}${JSON.stringify(remarks)}`
    : null;
}