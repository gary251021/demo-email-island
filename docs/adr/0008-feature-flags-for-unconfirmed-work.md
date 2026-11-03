# Feature flags are exceptions for unconfirmed work

Status: Accepted

Date: 2026-09-04

## Context

A tracked issue normally represents work the team has agreed should eventually
reach all users. Experimental features and fixes may instead need to be tested
before that agreement exists. Requiring a feature flag for every issue would
add conditional paths and cleanup work without improving ordinary delivery.

## Decision

Implement each issue without a feature flag by default. Treat the issue as
approved for eventual general availability unless the issue or an accepted
comment explicitly says the feature or fix is experimental or still requires
stakeholder confirmation.

Put explicitly unconfirmed work behind a feature flag so it can be tested
without making it generally available. Once the work is confirmed, the feature
flag is no longer required for final delivery and should be removed when it no
longer serves a rollout purpose. If the work is rejected, remove the flagged
work instead of retaining a permanent dormant path.

This default does not authorize a production operation. Human selection and
approval of each production release remain governed by
[ADR 0004](0004-production-release-branching.md).

## Consequences

- Issues need to request a feature flag explicitly; silence means unflagged
  implementation intended for eventual general availability.
- Experimental work can be tested without exposing it to everyone.
- Feature flags do not become permanent infrastructure by default.
