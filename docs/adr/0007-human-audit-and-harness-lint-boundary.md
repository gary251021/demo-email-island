# Human-audited application code remains subject to coding standards

Status: Accepted

Date: 2026-08-31

## Context

Application and business-logic code must be audited by a human, so repository
coding standards and ESLint checks provide a consistent review baseline.
Agent and harness infrastructure is treated as black-box development tooling
rather than part of the audited application.

## Decision

Repository coding standards and ESLint remain enforced for application and
business-logic code. Harness-related files under `.agents/**` and `.codex/**`
are excluded from ESLint and are not required to follow application coding
standards.

## Consequences

- Business-logic changes require human audit and retain lint enforcement.
- Agent and harness tooling can follow the conventions of the tool that owns it.
- The exclusion does not extend to application code merely because an agent
  created or modified it.
