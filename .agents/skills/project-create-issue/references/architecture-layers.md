# Architecture Axes

Document a slice's code architecture on two axes:

- **Functional modules** (vertical): cohesive capabilities named in domain
  vocabulary, such as `building`, `emailLoader` or `classifier`. Each lives under
  `src/features/<module>/` per the [frontend contract](../../../../docs/agents/architecture/frontend.md).
- **Architectural layers** (horizontal): the technical role a piece of code plays
  inside a module — routing, UI view, UI model, service, data access,
  integration, shared contract.

The design is a **module × layer matrix**: rows are the functional modules the
slice adds or changes, columns are the layers each row touches, and each cell
names the path and its one-line responsibility. Add each module's public
interface and the dependency direction between modules. Leave a cell empty when
the module has nothing in that layer; never create a layer to fill a cell.

The examples below use hypothetical Email Island modules and are illustrative.

## Functional modules

Document per module: its capability in one line, its public interface (what
other modules may import), the data it owns, and which modules it depends on.

- ✅ `classifier` owns assigning a mail to a domain and subcategory, exports
  `classifyMail(mail) → Classification`, owns the classification cache, and
  depends on `emailLoader` for mail content.
- ✅ `building` derives building tiers from unread counts and depends on
  `emailLoader`; `emailLoader` never imports `building`.
- ✅ A capability that two modules now need moves to the smallest shared scope,
  and the issue says which module gave it up.
- ❌ Modules named after a layer or a grab bag: `services`, `utils`, `helpers`.
- ❌ Modules named after the ticket or screen instead of the capability:
  `ticket1`, `homePage`.
- ❌ Splitting one capability into modules with a single consumer:
  `classifierCache` separate from `classifier` when only `classifier` uses it.
- ❌ Listing modules the slice does not touch, or modules planned for later
  tickets (mention those only under foundations for later tickets).

## Architectural layers

Document only decisions: placement, ownership, contracts and boundaries. Rules
the architecture contracts already state are not repeated; deviations are.

### Routing — `src/routes/`

Route adapters: paths, param/search validation, loaders, redirects.

- ✅ New paths and their params; which server function each loader calls; access
  rules enforced at the route (for example, redirect to the demo entry without a
  session).
- ❌ Loader internals, `await` ordering, or "use `createFileRoute`".

### UI view — `src/features/<module>/` components

Components and 3D scene composition the user sees.

- ✅ Top-level components each module exports for others, and which module
  composes which (for example, the island scene renders `MailPanel` exported by
  `emailLoader`).
- ❌ Props, styling, Tailwind classes, camera or material parameters.

### UI model — `src/features/<module>/` hooks and state

Client-side state and the view model derived from server data.

- ✅ Where each piece of state lives and its source of truth (server state cached
  with React Query versus client-only state); derived values and where they are
  computed (for example, building tier computed from unread count in
  `building`).
- ❌ Hook internals, memoization, or local component state.

### Service — server functions and domain logic

`createServerFn` handlers and the domain rules behind them, per the
[backend contract](../../../../docs/agents/architecture/backend.md).

- ✅ Each server function's signature and validating schema; where authorization
  is enforced (for example, owner taken from the session, never from client
  input); domain rules that decide results.
- ❌ Handler bodies, loops, or "every server function validates with Zod".

### Data access — `*.server.ts` persistence

Storage library, data model and queries.

- ✅ Storage library and version with the rejected alternative; entities and key
  fields; ownership scoping of every query; cache keys and invalidation rules;
  what is seeded and who owns the copy.
- ❌ Index names, migration file names, raw SQL, or fields for features no ticket
  has asked for.

### Integration — `*.server.ts` external providers

Clients for external services and models.

- ✅ The single module allowed to call each provider; call policy (cache first,
  call on miss, at most once per item); where credentials are read; how tests
  fake the provider.
- ❌ Retry timings, or request formats copied from the provider's docs.

### Shared contract — `src/lib/`

Schemas, types and pure logic used by both client and server.

- ✅ Cross-boundary schemas and types as short snippets; pure logic shared by both
  sides and why it is shared.
- ❌ Every field of a schema, or types used on only one side.

## Matrix example

| Module        | Routing                | UI view        | UI model                 | Service                   | Data access                | Integration     |
| ------------- | ---------------------- | -------------- | ------------------------ | ------------------------- | -------------------------- | --------------- |
| `emailLoader` | `/island/$domain/$sub` | `MailPanel`    | unread counts (RQ cache) | `getMailList`, `markRead` | `mail` table, owner-scoped |                 |
| `building`    |                        | `BuildingTile` | tier from unread count   |                           |                            |                 |
| `classifier`  |                        |                |                          | `classifyMail`            | classification cache       | `jev.server.ts` |

Module dependencies: `building → emailLoader`, `classifier → emailLoader`.
