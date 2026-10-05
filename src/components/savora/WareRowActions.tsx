import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteWare, updateWare } from "@/lib/savora.functions";
import { supabase } from "@/integrations/supabase/client";

export interface WareRow {
  id: string;
  ware: string;
  code: string | null;
  dimensionsCatalogue: string | null;
  productName: string | null;
  imageUrl: string | null;
  printedImageUrl: string | null;
  orderedQuantity: number | null;
  approxWeight: number | null;
  stockInHand: number;
  influencerStock: number;
  storeStock: number;
  costPrice: number | null;
  mrp: number | null;
  remarks: string | null;
  influencerRemarks?: string | null;
  showroomRemarks?: string | null;
  wareMediaPath?: string | null;
  wareMediaUrl?: string | null;
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function WareRowActions({ ware }: { ware: WareRow }) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateWare);
  const remove = useServerFn(deleteWare);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    name: ware.ware,
    code: ware.code ?? "",
    dimensionsCatalogue: ware.dimensionsCatalogue ?? "",
    productName: ware.productName ?? "",
    imageUrl: ware.imageUrl ?? "",
    printedImageUrl: ware.printedImageUrl ?? "",
    orderedQuantity: ware.orderedQuantity === null ? "" : String(ware.orderedQuantity),
    approxWeight: ware.approxWeight === null ? "" : String(ware.approxWeight),
    stockInHand: String(ware.stockInHand),
    influencerStock: String(ware.influencerStock),
    storeStock: String(ware.storeStock),
    costPrice: ware.costPrice === null ? "" : String(ware.costPrice),
    mrp: ware.mrp === null ? "" : String(ware.mrp),
    remarks: ware.remarks ?? "",
    influencerRemarks: ware.influencerRemarks ?? "",
    showroomRemarks: ware.showroomRemarks ?? "",
  });
  const [file, setFile] = useState<File | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const update = useMutation({
    mutationFn: async () => {
      let mediaPath = ware.wareMediaPath ?? null;
      if (file) {
        const okType = ["image/jpeg", "application/pdf"].includes(file.type);
        if (!okType) throw new Error("Please upload a JPEG image or a PDF");
        if (file.size > 20 * 1024 * 1024) throw new Error("File must be under 20 MB");
        const ext = file.type === "application/pdf" ? "pdf" : "jpg";
        const path = `${ware.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("savora-ware-media").upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        mediaPath = path;
      }
      return save({
        data: {
          id: ware.id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          dimensions_catalogue: form.dimensionsCatalogue.trim() || null,
          product_name: form.productName.trim() || null,
          image_url: form.imageUrl.trim() || null,
          printed_image_url: form.printedImageUrl.trim() || null,
          ware_media_path: mediaPath,
          ordered_quantity: numOrNull(form.orderedQuantity),
          approx_weight_grams: numOrNull(form.approxWeight),
          stock_in_hand: Number(form.stockInHand || 0),
          influencer_stock: Number(form.influencerStock || 0),
          store_stock: Number(form.storeStock || 0),
          cost_price: numOrNull(form.costPrice),
          mrp: numOrNull(form.mrp),
          remarks: form.remarks.trim() || null,
          influencer_remarks: form.influencerRemarks.trim() || null,
          showroom_remarks: form.showroomRemarks.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ware updated");
      setOpen(false);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => remove({ data: { id: ware.id } }),
    onSuccess: () => {
      toast.success("Ware deleted");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Edit ${ware.ware}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Delete ${ware.ware}`}
            disabled={del.isPending}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{ware.ware}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the ware and its stock line from the CRM. If the row still exists in the
              Google Sheet, the next sync will bring it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit ware</DialogTitle>
            <DialogDescription>
              Changes apply to everyone. A sheet sync can overwrite synced fields.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product (Ware)" id="w-name" value={form.name} onChange={set("name")} />
            <Field label="Code" id="w-code" value={form.code} onChange={set("code")} />
            <Field
              label="Dimension in Catalogue"
              id="w-dim"
              value={form.dimensionsCatalogue}
              onChange={set("dimensionsCatalogue")}
            />
            <Field
              label="Product Name"
              id="w-product"
              value={form.productName}
              onChange={set("productName")}
            />
            <Field label="Image URL" id="w-img" value={form.imageUrl} onChange={set("imageUrl")} />
            <Field
              label="Final Printed Image URL"
              id="w-printed"
              value={form.printedImageUrl}
              onChange={set("printedImageUrl")}
            />
            <Field
              label="Orderd Quantity"
              id="w-ordered"
              type="number"
              value={form.orderedQuantity}
              onChange={set("orderedQuantity")}
            />
            <Field
              label="Approx Weight (gm)"
              id="w-weight"
              type="number"
              value={form.approxWeight}
              onChange={set("approxWeight")}
            />
            <Field
              label="Stock in hand"
              id="w-stock"
              type="number"
              value={form.stockInHand}
              onChange={set("stockInHand")}
            />
            <Field
              label="Influencer stock"
              id="w-influencer-stock"
              type="number"
              value={form.influencerStock}
              onChange={set("influencerStock")}
            />
            <Field
              label="Stock on sales"
              id="w-store-stock"
              type="number"
              value={form.storeStock}
              onChange={set("storeStock")}
            />
            <Field
              label="Cost Price"
              id="w-cost-price"
              type="number"
              value={form.costPrice}
              onChange={set("costPrice")}
            />
            <Field
              label="MRP"
              id="w-mrp"
              type="number"
              value={form.mrp}
              onChange={set("mrp")}
            />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-file">Upload image or PDF (JPEG / PDF)</Label>
              <Input id="w-file" type="file" accept="image/jpeg,.jpg,.jpeg,application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {ware.wareMediaUrl && !file && (
                <a href={ware.wareMediaUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View current file</a>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-inf-remarks">Given to influencers</Label>
              <Textarea id="w-inf-remarks" value={form.influencerRemarks} onChange={(e) => setForm((c) => ({ ...c, influencerRemarks: e.target.value }))} placeholder="Which influencer, how many, when" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-show-remarks">Showroom display</Label>
              <Textarea id="w-show-remarks" value={form.showroomRemarks} onChange={(e) => setForm((c) => ({ ...c, showroomRemarks: e.target.value }))} placeholder="Which store / showroom, how many" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-remarks">Other remarks</Label>
              <Textarea
                id="w-remarks"
                value={form.remarks}
                onChange={(e) => setForm((current) => ({ ...current, remarks: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => update.mutate()} disabled={!form.name.trim() || update.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={onChange} />
    </div>
  );
}
