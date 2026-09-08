# Savora CRM v2 build plan

## Outcome
Turn the current inventory dashboard into the v2 CRM described in the brief: an Overview landing page, editable collections workspace, contacts, calendar, and an Admin area for global controls and sync history.

## User-visible work

1. **Navigation and Overview**
   - Rename the first destination to Overview and add Collections, Contacts, Calendar, and Admin navigation.
   - Make Overview the signed-in landing screen.
   - Add quarter selector and collection-filtered sales chart.
   - Add costing summary, contact snapshot, upcoming events, and major-events panels.

2. **Collections workspace**
   - Keep the current collection selector and ware table as the foundation.
   - Add collection detail tabs for Costing, Special Combinations, Wares, and Sales & Stock.
   - Add editable costing rows and structured special-combination rows.
   - Preserve row/column drag-and-drop and computed buildable-set fields as locked values.
   - Keep the existing add/edit/delete/reorder behavior for wares.

3. **Contacts**
   - Add a B2B/B2C tabbed list with search, add, edit, and delete.
   - Keep fields intentionally limited to name, company (B2B), phone, and email.

4. **Calendar**
   - Add a month/list calendar surface with event type and major-event filters.
   - Add create, edit, and delete event controls.
   - Add a Google Calendar connection entry point and use the connected calendar for reads/writes once linked.
   - Keep the Overview widgets backed by the same event data.

5. **Admin and access**
   - Make every authenticated user an Admin in the application experience; remove Viewer-only editing restrictions from new CRM screens.
   - Keep role data separate and do not store permissions on profiles.
   - Retain the existing BOM, thresholds, sync log, and activity log sections.

## Technical details

- Add Cloud tables for contacts, costing rows, special combinations, CRM calendar events, and shared settings with explicit grants, RLS, timestamps, and activity logging.
- Add authenticated server functions for list/create/update/delete operations, quarter analytics, and calendar synchronization calls.
- Keep external calendar calls server-side through the connector gateway; do not expose connector credentials in the browser.
- Use existing design tokens, shadcn controls, Lucide icons, Recharts, TanStack Router, and React Query.
- Add route metadata for every new content route and keep sensitive CRM pages `noindex`.
- Validate with the build log and live preview after the migration and UI changes.

## Delivery order

1. Database schema and access rules.
2. Server functions and shared types.
3. Navigation, Overview, and Collections screens.
4. Contacts and Calendar screens.
5. Admin/access alignment, metadata, and verification.
