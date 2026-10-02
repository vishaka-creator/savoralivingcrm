# Add ware stock, pricing, and remarks fields

## Outcome
Each ware can store and edit influencer stock, stock on sales, remarks about where it was given, cost price, and MRP. The ware table will display these values, and the public landing title will read “Savora CRM Dashboard.”

## Changes
- Add five persistent ware fields: influencer stock, stock on sales, remarks, cost price, and MRP.
- Extend the existing Edit ware form with numeric inputs for both stock values and prices, plus a remarks field.
- Add matching draggable columns to the ware table while keeping the existing stock-in-hand and sales calculations unchanged.
- Keep these fields manual-only so the five-tab Google Sheet sync does not overwrite them.
- Replace “A calm command center for every Savora collection.” with “Savora CRM Dashboard.”
- Record edits in the existing activity log and refresh the table after saving.

## Technical details
- Apply a Lovable Cloud migration to extend the existing ware records; existing access policies and grants remain unchanged.
- Update generated database typings, authenticated read/update functions, and shared row types.
- Verify the build and the signed-in edit flow in the live preview.
