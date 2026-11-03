# UI Design Validation

Require a runnable UI demo when the user explicitly requests one, or when UI is
the primary change and a material visual or interaction choice must be seen or
tried to align it. A simple change that can be specified with existing placement,
labels, states and behavior needs no demo after the current UI evidence that
settles those choices is inspected and recorded. The skip is the main agent's call;
an explicit user request for a demo is binding. Decide code-fit proof
independently; the complete issue preview and implementation-time visual
verification still apply.

## Prepare Storybook

Use the reusable standalone [Storybook workspace](../../../../.storybook-preview/README.md)
for every required UI demo. From the repository root, check that workspace:

```bash
node .agents/skills/project-create-issue/scripts/checkStorybook.mjs \
  --project-dir .storybook-preview
```

Use the JSON status and evidence to decide readiness:

- `ready`: use the workspace and record its path and detector result in the checkpoint.
- `incomplete`: resolve the reported missing prerequisites. For missing installed
  packages, use the workspace's locked installation command with the required
  installation approval, then rerun the detector.
- `absent`, or a missing workspace directory: restore the version-controlled
  setup before continuing, then rerun the detector. Keep required UI proof blocked
  until the standalone Storybook setup is ready.

The standalone workspace supplies its own Storybook installation. If existing
application stories are relevant, inspect and copy their useful source into the
independent variant while keeping runtime imports local.

## Build an issue variant

Keep each issue's copied UI, stories, styles, assets and mocks in
`.storybook-preview/variants/<issueKey>/`, using a descriptive camelCase key.
The reusable manifest, lockfile, configuration and README are version controlled.
Variants are Git-ignored by default. When the user requests durable source,
force-add only the selected variant's sources. Keep dependencies, captures and
build output ignored; check the staging boundary before handing off changes.

Use the current configured demo and source snapshot as the visual baseline.
Represent an unchanged baseline and the proposal as stories in the variant,
with comparable viewport and fixture data. Retain the inspected source revision
and captured deployment separately. Existing UI source or captured HTML/CSS can
supply the story's appearance; preserve enough surrounding layout to judge it.
Keep components, scripts, styles and assets local to the standalone preview,
simulate relevant API behavior with local fixtures, and remove authentication
material and live remote mutations or navigation.

Apply the smallest proposed change using the captured structure and styling.
Add only local interaction needed to judge the design. The copy establishes the
proposal's appearance and local interaction; validate React and backend behavior
through the applicable code-fit and delivery checks. Use `$prototype` only when an
open visual or state question benefits from interactive alternatives. Retain the
result as design evidence under the variant persistence rules above.

Show each piece of information once per view, at the control where it affects
the user's action. For example, use checked member rows to convey the selection.
Add guidance only when it changes a decision or becomes useful after an error or
limit.

A disposable story or copied component is proposal evidence; add a permanent
story with real released components only as part of implementation.

## Verify and align

Run the workspace's typecheck and static build. Serve the built Storybook,
open the proposal's story URL and confirm it works without the application or backend
server. Inspect its rendered appearance, exercise the demonstrated interactions,
and cover additional states or viewports only when they change the decision. Capture
inspected screenshots of the selected design and decision-relevant states for
`For Human`; show the baseline only when comparison adds information.

The main agent accepts UI proof after inspecting the runnable proposal's rendered
appearance and exercised interactions against the required design choices.

Show the inspected runnable proposal to the user, ask the currently answerable
visual and interaction questions through the grilling decision flow, and wait for
the answers before treating the design as selected. Ask dependent questions in a
later round.

Keep demo artifacts and validation records internal unless the user requests
publication. Describe the selected appearance and interaction contract in
`For Agent` so it stands alone. Update evidence and preview when the proposal changes.

Map the proposal to actual component owners and apply
[code-design validation](03-code-design-validation.md)
separately when needed.

## Continue or share

Keep a short README beside each variant with its scope, source baseline, settled
decisions, mocked behavior and story IDs. Record its path, review URL and actual
verification results in the [checkpoint](00-run-checkpoint.md).

A new chat in the same checkout can reuse those files. For another checkout or
device, Git transfers tracked variants with the reusable setup and lockfile;
transfer ignored variants separately. For viewing only, transfer the built
static output. Inspect the included stories before sharing a bundle.
A localhost URL stays local; deploy only when the destination and deployment are
authorized, and verify the resulting remote URL.

If the target page cannot be accessed, faithfully copied, locally rendered or
inspected, remain in alignment and report the blocker.
