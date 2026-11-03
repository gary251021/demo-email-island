# Email Island prototype visual style

Create a calm, zoomed-out miniature island map with small buildings, discreet labels, and generous empty space. Use the researched images for the miniature city character and the generated home-page image for the latest composition. These rules capture the user's corrections from 3 November 2026 and apply to future prototype images and building concepts.

## Reference sources

Keep these two sources separate when saving files or assembling image-generation prompts. Identify each input as researched inspiration, a generated concept, or the image being edited.

| Folder | Purpose |
| --- | --- |
| `researched/` | External inspiration screenshots supplied in the original OpenDesign session. Preserve their provenance; they are not artwork created for Email Island. |
| `generated/home-page/` | Home-page concepts generated for Email Island in this chat. |
| `generated/props/` | Building concept sheets generated for Email Island in this chat. These are image references, not 3D model files. |

Researched inspiration, identified as HEART policy island in [the project reference notes](../../reference.md):

- [Detail view](researched/policy-island-detail.png): simple miniature architecture, rounded trees, small map labels.
- [Overview](researched/policy-island-overview.png): zoomed-out island scale, small buildings within a larger landscape, calm water.
- [Vertical map](researched/policy-island-vertical-map.png): spatial category navigation and compact floating labels. Use its map language while keeping our home-page image landscape.

These screenshots were recovered from attachments 001, 002, and 003 respectively in OpenDesign conversation `73029398-8e55-4ee6-b884-ae5e0bf5c664`. Original source URLs were not recorded with the attachments.

Generated concepts:

- [Latest home page](generated/home-page/home-page.png): reference for small buildings, small labels, open terrain, and no bottom cards. It predates the distinct architectural families in the prop sheets.
- [Team, projects, newsletters, and finance props](generated/props/building-tiers-team-projects-newsletters-finance.png).
- [Alerts, social, and spam props](generated/props/building-tiers-alerts-social-spam.png).

The prop sheets show two architectural stages only. Their “City · 20+ emails” captions conflict with the four-tier project specification below. Use their architectural direction, not their tier count or thresholds. Complete four-tier sheets remain to be created.

## Home-page composition

- Use one landscape image, preferably 16:9, showing the whole connected hex island and its floating controls.
- Use an elevated isometric overview with soft, low-poly miniature architecture. Buildings should read as small objects within terrain, with substantial clear ground around them.
- Keep broad areas of calm water around the island. The user's direction is to avoid filling every pixel with detail. Empty water and empty terrain are part of the composition.
- Match the small building and label scale in the latest home-page reference. The preceding iteration's buildings and labels were reduced roughly by half; use the saved result as the baseline instead of repeatedly halving future versions.
- Keep category labels as small white rounded pills with plain dark sans-serif text. They should annotate the map without obscuring buildings or becoming the focal point.
- Keep unread tokens, the prosperity badge, day/night toggle, and newsletter nudge compact. Localize the storm to the relevant project area.
- Keep the home-page overview free of bottom resource cards. This explicit user correction supersedes the bottom hand dock in the earlier image brief; the dock has since been removed from `project.md`. Do not substitute another bottom toolbar.
- Preserve the full-screen island canvas without fixed SaaS sidebars, top navigation bars, or dashboard panels.

## Color and detail

Use muted teal water, soft greens, sandy cream, ochre, clay, and restrained coral or blue accents. Favor matte materials, simple geometric trees, clean roof shapes, and gentle shadows.

Keep only scenery that communicates a category or function. Use a few trees, a small crop patch, modest docks, and simple paths. Avoid dense flowers, rocks, animals, waves, ornamental walls, repeated towers, oversized signs, and intricate facade textures. Enlarged prop sheets can reveal construction details, but their silhouettes must remain readable at the small scale used on the map.

## Building architecture

Category identity must come from silhouette, roof form, material, and structure. A category should remain recognizable when labels, icons, and color are removed. Changing a sign or roof color on the same house does not establish a different building type.

Use the latest prop sheets as the current architectural direction:

| Email category | Architectural family | Visible progression |
| --- | --- | --- |
| Team Chats | Timber post cabins and communal guildhalls, exposed framing, pitched roofs | Small mail shelter grows into connected wooden wings and a shared courtyard with a bell turret. |
| Core Work Projects | Stone workshops and civic cities, steep slate roofs, square towers | Compact stone building grows into multiple roof masses and a tall city tower. |
| Newsletters | Round windmill buildings and publishing mills | Small cylindrical mill gains a printing hall with a sawtooth roof. |
| Finance & Bills | Heavy strongrooms and treasuries, barrel vaults and domes | Small secure vault gains wings and a central counting chamber. |
| System/Dev Alerts | Exposed signal structures, brick service sheds, lanterns and antennas | Simple watch scaffold grows into a communications tower with service halls. |
| Social & Events | Fabric tents and open timber gathering pavilions | Single tent grows into joined canopy roofs and a gathering deck. |
| Spam/Low Priority | Low sandstone sorting sheds, flat and stepped roofs | Small sorting hut grows into a horizontal depot with an enclosed sorting yard. |

Use small mail-related details where they help explain the function. Keep the architecture recognizable without oversized envelope, folder, or app icons. The seven categories above describe the current images; `project.md` also includes Shopping & Delivery, whose architectural family has not yet been explored in these sheets.

## Building tiers

Follow section 3.2 of [the functional specification](../../project.md). Tier represents the number of emails in a thread; unread-count tokens are a separate visual measure.

| Tier | Emails | Required visual progression |
| --- | --- | --- |
| Lv. 1 Camp | 1–2 | Smallest shelter, tent, stall, or marker appropriate to the category. |
| Lv. 2 Settlement | 3–9 | Compact building with a simple footprint and recognizable category structure. |
| Lv. 3 City | 10–29 | Added wings or roof masses and a stronger landmark silhouette. |
| Lv. 4 Metropolis | 30+ | Largest category-specific complex, with multiple connected structures and a clear spatial hierarchy. |

Keep each family's architectural identity through all four tiers. Express upgrades through structure, footprint, height, and roof configuration, rather than scaling up the same mesh or adding a new label. Retain the category-specific materials and shapes as the building grows. Even the largest tier must leave breathing room on the island.

For a tier comparison sheet, use one consistent camera angle, lighting setup, and world scale. Show every requested category at every required tier, with category and tier captions. Do not resize each model independently to fill its cell, since that hides progression.

## Generation workflow

1. Read the functional specification and this guide. Select references for the requested view or prop family.
2. Inspect the actual images. State each input's role in the prompt, especially which image is the edit target.
3. For an overview, preserve the latest home-page scale and sparse composition. For props, apply the architectural families and full tier system above.
4. Generate the requested image format. An image request should produce a raster concept image; interactive implementation is separate work.
5. Review the result at both full size and map scale. Check that buildings and labels remain small, the scene has open space, bottom cards are absent, categories have distinct silhouettes, and requested tiers are complete.
6. Save new concepts under `generated/home-page/` or `generated/props/` with descriptive versioned filenames. Keep researched sources under `researched/`, record their origin, and preserve earlier files unless replacement was requested. Update the reference links when a new image becomes the working baseline.

## Reusable prompt

> Create a landscape Email Island prototype image using the attached researched screenshots for miniature city character and the latest generated home-page image for composition and scale. Show a complete connected hex island in an elevated isometric view, surrounded by calm muted teal water. Use small, soft low-poly buildings, discreet white category labels, matte pastel materials, and generous empty terrain. Preserve the category-specific architectural families and the requested email-volume tiers from this guide. Keep the floating controls compact and the bottom of the view clear of cards. Leave visual breathing room instead of filling the scene with decoration. For building reference sheets, show each requested family at all four tiers using a consistent world scale and clearly different structures.
