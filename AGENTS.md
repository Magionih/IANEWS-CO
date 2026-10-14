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

- Keep newsletter subscription presentation in a reusable site form using existing subscription and URL-context helpers; this shares validation and states across both placements without changing email delivery.
- Public newsletter content uses the existing recent-article server function through a suspense query and SSR loader; this reuses public content access without new backend logic.
- Keep historical advertising metrics isolated to existing backend/admin modules, with no public-site tracking client or ad-slot module; this preserves historical reporting without public ad requests.
