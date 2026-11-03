# Frontend Architecture

Apply these ownership rules when adding frontend files, explicitly refactoring,
or changing responsibility or dependencies. This contract takes precedence over
existing patterns. Keep ordinary edits scoped to their requested change.

### `src/` — UI and routing

TanStack Start owns `src/router.tsx`, the file routes under `src/routes/` and the
generated `src/routeTree.gen.ts` (never edit it by hand). Ownership is a
recursive tree: app-global → route → feature → detail. Each scope creates only
the directories it needs.

- `src/routes/` holds route adapters: define the route with `createFileRoute`,
  validate search and path params, load data through `loader` and server
  functions, and compose UI. Keep queries, business policy and cross-feature
  orchestration in their owning modules.
- `src/features/<feature>/` holds a feature's components, hooks and state.
- `src/components/` holds app-global components; manage shadcn primitives in
  `src/components/ui/` through the CLI.

**Import direction:** descendants may import from ancestors; ancestors and
siblings reach a feature only through what that feature exports for them.

Keep state, event handling and presentation with the smallest scope that owns
their consumers. Put server work behind the [backend](backend.md) contract.

For cross-boundary changes, also read [backend.md](backend.md). Verify rendering
and affected interactions under [acceptance testing](../acceptance-testing.md).
