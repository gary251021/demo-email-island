# Email Island visual style

Visual reference only. `project.md` owns functional behavior and tier thresholds; when an image conflicts with it, follow `project.md`.

## References

Keep researched inspiration and generated concepts separate, and state each input's role (inspiration, style reference, or edit target) in image prompts.

- `researched/` — external HEART policy island screenshots (see `../../reference.md`), not Email Island artwork: [detail](researched/policy-island-detail.png), [overview](researched/policy-island-overview.png), [vertical map](researched/policy-island-vertical-map.png).
- `generated/home-page/` — archipelago layer baseline: [nighttime island](generated/home-page/nighttime-island.png); card views: [project timeline](generated/home-page/project-timeline.png), [newsletter discovery](generated/home-page/newsletter-discovery.png), [harbor arrivals](generated/home-page/harbor-arrivals.png).
- `generated/tile-layer/` — tile layer baseline: [Core Projects tile](generated/tile-layer/core-projects-tile.png).
- `generated/props/` — architectural direction only; they show two stages, not the four tiers: [team, projects, newsletters, finance](generated/props/building-tiers-team-projects-newsletters-finance.png), [alerts, social, spam](generated/props/building-tiers-alerts-social-spam.png).

All generated images are raster concepts; sample counts and colors vary between them.

## Composition

- 16:9 landscape, full-screen canvas. No sidebars, top navigation, dashboard panels, or bottom cards/toolbars.
- Congruent regular hexagons under one orthographic isometric camera (pointy-top tile about 1.1× wider than tall on screen), with visible beveled tile thickness. Adjacent tiles share full edges.
- Roads run along hex edges and turn at vertices.
- Small buildings, small white rounded pill labels in dark sans-serif, compact tokens and controls. Broad calm water and clear terrain; avoid filling space with decoration.

## Interface text

Text names things and actions; appearance carries state. A disabled, selected or loading control shows only its own name — a greyed button reads `Google 登入`, never `Google 登入・尚未開放`. Explain a state only when the issue asks for it, in a tooltip or adjacent note. On-screen text is written for the player, so notes such as "示範用", "placeholder" or "TODO" stay out of visuals and UI.

## Color and detail

Muted teal water, soft greens, sandy cream, ochre, clay, restrained coral or blue accents. Matte low-poly materials, simple geometric trees, gentle shadows. Avoid dense flowers, rocks, animals, waves, ornamental walls, oversized signs, and intricate textures.

## Building families

Category identity comes from silhouette, roof form, material, and structure, not labels or color alone.

| Category | Family |
| --- | --- |
| Team Chats | Timber cabins growing into guildhalls with a bell turret |
| Core Projects | Stone workshops with slate roofs growing into a city with a tall square tower |
| Newsletters | Round windmill gaining a sawtooth-roof printing hall |
| Finance & Bills | Barrel-vault strongroom growing into a domed treasury |
| System/Dev Alerts | Signal scaffold and brick sheds growing into a communications tower |
| Social & Events | Single tent growing into joined canopies and a gathering deck |
| Spam/Low Priority | Low sandstone sorting hut growing into a walled depot |
| Shopping & Delivery | Not yet explored |

Tiers follow `project.md` §3.2 (unread email count). Upgrade through footprint, height, and roof masses within the same family, never by scaling one mesh. Tier sheets use one camera, lighting, and world scale.

## Saving

Save under the matching `generated/` folder with a descriptive filename and no version suffix; replace the file when a new version is approved. Keep only the approved image; delete intermediates. Update the links above when a new image becomes the baseline.
