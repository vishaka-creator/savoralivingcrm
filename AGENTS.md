<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep ware-level influencer stock, stock on sales, pricing, and remarks in `skus` because they are manual CRM attributes that sheet sync must preserve.
- Keep product media in private Cloud Storage and expose short-lived signed links only through authenticated user sessions, protecting internal product assets.
- Ask CRM answers from a fresh read-only CRM snapshot built server-side with the caller's session (`src/lib/ask-crm.server.ts`), so the AI never writes data and only sees what the signed-in user can read.
- Store daily build plans in `build_plans` keyed by collection and India-time plan date (`src/lib/build-plan.ts`), so "tomorrow" matches the team's working day regardless of server timezone.
- Sheet sync targets come from the `collections` table (built-in collections use the tab names in `savora-config.ts`, in-app ones use their saved `sheet_tab`), resolved case-insensitively against the live tab list, so new collections sync without code changes and a single collection can be synced on its own.
- Pre-bundle every UI library in `vite.config.ts` `optimizeDeps.include`, so importing a not-yet-used one never re-optimizes deps mid-session and crashes open tabs with two React copies.
- Access has two tiers in `user_roles`: admins edit, viewers only read. Every write server function calls `assertAdmin` (`src/lib/savora-admin.server.ts`) and write RLS policies require `has_role(admin)`, so hidden buttons are never the only protection; new sign-ups get the viewer role from the signup trigger.
- Picking a sheet tab by name (read into a collection, or write a collection out) goes through the rules in `src/lib/sheet-tabs.ts`: excluded tabs are never read or written and cost/costing tabs are never overwritten, checked again server-side; writes use RAW values so remarks never become formulas, and an existing tab is replaced only with explicit confirmation.
