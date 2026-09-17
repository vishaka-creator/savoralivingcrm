/**
 * Savora CRM configuration.
 *
 * Everything that depends on how the Google Sheet is named or laid out lives
 * here. If a tab is renamed or a collection maps to a different Shopify
 * collection, this is the only file that needs to change.
 */

export const SPREADSHEET_ID = "1dixSJJzV6SunQ5dKZJt9ViEH1G1d7hkWGZlcAk3EdsE";
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;


export type CollectionSlug = "zebra" | "mini" | "le-cirque" | "mahjong" | "orchid";

export interface CollectionConfig {
  slug: CollectionSlug;
  name: string;
  /** Tab holding the ware list / material quantities. */
  sheetTab: string;
  /** Tab holding production costs (and sometimes live stock). */
  costTab: string;
  /** savora.in collection handle. `null` = unconfirmed / not listed. */
  shopifyHandle: string | null;
  /** Whether the savora.in mapping has been confirmed internally. */
  shopifyConfirmed: boolean;
  accent: string;
}

export const COLLECTIONS: CollectionConfig[] = [
  {
    slug: "zebra",
    name: "Zebra",
    sheetTab: "ZEBRA ",
    costTab: "Zebra Production cost",
    shopifyHandle: "masai",
    shopifyConfirmed: false,
    accent: "collection-zebra",
  },
  {
    slug: "mini",
    name: "Mini",
    sheetTab: "MINI",
    costTab: "Mini Production Cost",
    shopifyHandle: "masai-minis",
    shopifyConfirmed: false,
    accent: "collection-mini",
  },
  {
    slug: "le-cirque",
    name: "Le Cirque",
    sheetTab: "LE CIRQUE",
    costTab: "Le cirque Production Cost",
    shopifyHandle: "le-cirque",
    shopifyConfirmed: true,
    accent: "collection-cirque",
  },
  {
    slug: "mahjong",
    name: "Mahjong",
    sheetTab: "MAHJONG",
    costTab: "Mahajong Production Cost",
    shopifyHandle: null,
    shopifyConfirmed: false,
    accent: "collection-mahjong",
  },
  {
    slug: "orchid",
    name: "Orchid",
    sheetTab: "EDEN BLOOM ",
    costTab: "Savora Costing_Eden Bloom",
    shopifyHandle: "eden-bloom",
    shopifyConfirmed: true,
    accent: "collection-orchid",
  },
];

export const collectionBySlug = (slug: string) =>
  COLLECTIONS.find((c) => c.slug === slug) ?? null;

export const DEFAULT_LOW_STOCK_THRESHOLD = 20;

/**
 * Column header keywords used by the tolerant sheet parser.
 * Order matters: more specific keys must come first so a header like
 * "Product Name" is not consumed by the generic "product" ware column.
 */
export const HEADER_KEYWORDS = {
  weight: ["approx weight", "approximate weight", "weight (gm)", "weight"],
  productName: ["product name"],
  dimensionsCatalogue: ["dimension in catalogue", "dimensions in catalogue"],
  dimensions: ["dimensions", "dimension"],
  printedImage: ["final printed image", "printed image"],
  image: ["images", "image"],
  name: ["product (ware)", "product", "description of goods", "description", "ware", "item"],
  code: ["ware code", "code"],
  stock: ["stock in hand", "stock"],
  quantity: [
    "orderd quantity",
    "ordered quantity",
    "quantity ordered",
    "quantity",
    "revised",
  ],

  cost: [
    "per unit price",
    "price per unit",
    "revised unit price",
    "cost per piece",
    "per piece",
    "unit price",
  ],
};


export const SALES_STATUSES = ["Received", "Invoice raised", "Pending", "Delivered"] as const;
