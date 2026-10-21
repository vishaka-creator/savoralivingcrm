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
