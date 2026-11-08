# Target-side conflict integration

Handle an existing change-request conflict only after confirming the tracker, remote, source, target and their current SHAs, along with permission to update the target. Preserve the source branch and the reviewed patch. Show the exact proposed merge and verification before a remote write.

If the target update or tracker state cannot be verified, report the blocker. The prior GitLab-specific procedure for a fixed development branch is parked in [_temp-target-side-conflict-integration.md](_temp-target-side-conflict-integration.md). Use it only after the project has explicitly adopted and checked its branch and provider assumptions.
