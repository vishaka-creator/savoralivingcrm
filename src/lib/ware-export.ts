import * as XLSX from "xlsx";
import type { WareTableRow } from "@/components/savora/WareTable";

const rowsForExport = (wares: WareTableRow[]) => [
  [
    "Product (Ware)",
    "Code",
    "Dimension in Catalogue",
    "Product Name",
    "Images",
    "Ordered Quantity",
    "Final Printed Image",
    "Approx Weight (gm)",
    "Remarks",
    "Influencer Stock",
    "Stock on Sales",
    "Cost Price",
    "MRP",
    "Remarks / Where Given",
    "Stock",
  ],
  ...wares.map((ware) => [
    ware.ware,
    ware.code ?? "",
    ware.dimensionsCatalogue ?? "",
    ware.productName ?? "",
    ware.wareMediaUrl ?? ware.imageUrl ?? "",
    ware.orderedQuantity ?? "",
    ware.printedImageUrl ?? "",
    ware.approxWeight ?? "",
    ware.salesRemarks ?? "",
    ware.influencerStock,
    ware.storeStock,
    ware.costPrice ?? "",
    ware.mrp ?? "",
    [
      ware.influencerRemarks ? `Influencers: ${ware.influencerRemarks}` : "",
      ware.showroomRemarks ? `Showroom: ${ware.showroomRemarks}` : "",
      ware.remarks ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
    ware.stockInHand,
  ]),
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(collectionName: string) {
  return collectionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "wares";
}

export function downloadWaresXlsx(wares: WareTableRow[], collectionName: string) {
  const sheet = XLSX.utils.aoa_to_sheet(rowsForExport(wares));
  sheet["!cols"] = [
    { wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 32 },
    { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 38 }, { wch: 18 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 14 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sales & Stock");
  XLSX.writeFile(workbook, `${safeFilename(collectionName)}-sales-and-stock.xlsx`);
}

export function downloadWaresCsv(wares: WareTableRow[], collectionName: string) {
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(rowsForExport(wares)));
  downloadBlob(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    `${safeFilename(collectionName)}-sales-and-stock.csv`,
  );
}