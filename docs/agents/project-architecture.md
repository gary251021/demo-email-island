# Project Architecture

This document routes architecture work to the contract that owns it. For new
files, explicit refactors, or changes to responsibility or dependencies, read
only the applicable side; cross-boundary changes require both.

| Work                                                                   | Contract                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| Routes, components, frontend state, UI ownership or imports            | [Frontend architecture](architecture/frontend.md) |
| Server functions, server handlers, server-only modules, shared schemas | [Backend architecture](architecture/backend.md)   |

These contracts own their respective boundaries. Follow them when existing
implementation patterns differ. Keep code at the smallest scope owning its
real consumers, and preserve the meaning of persisted fields and API contracts.

Add a layer only when it owns work.
