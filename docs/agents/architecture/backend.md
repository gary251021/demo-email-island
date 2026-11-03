# Backend Architecture

TanStack Start runs server code in the same `src/` tree as the UI. Apply these
rules when adding server code or changing what runs on the server.

## Server functions are the transport

- Expose server work through `createServerFn` with an input validator (Zod).
  The validator is the trust boundary: inside the handler, use the validated,
  typed value directly.
- Use route `server` handlers under `src/routes/` only for HTTP endpoints that
  must be addressable by URL, such as webhooks or OAuth callbacks.
- Call server functions from route `loader`s or from components; the router
  handles the network hop.

## Keep server-only code server-only

- Name modules that touch secrets, databases or provider SDKs `*.server.ts`.
  TanStack Start blocks them from client bundles; import them only from server
  functions, server handlers or other `*.server.ts` modules.
- Read environment variables and credentials only in `*.server.ts` modules.

## Shared contracts

Put types, Zod schemas and pure logic used by both sides in
`src/lib/` (no server-only imports). Derive types from those schemas under
[source-backed types](../../code-principle.md#source-backed-types).

## Ownership

Keep a server function next to the feature it serves
(`src/features/<feature>/`) until a second feature needs it, then move it to the
smallest shared scope. Add a layer only when it owns work.
