# Visual reference scoring

Apply when a UI change has reference images: issue-linked images, images under
`reference/` named by the issue, or the matching baselines listed in
[the visual style guide](../../../../reference/email-island/README.md). Functional
behavior in `project.md` wins over any image; never score down a difference that
`project.md` or the accepted issue scope requires (for example the right-side
mail card, or tokens owned by a later ticket).

## Capture

The Spec reviewer captures the application state that corresponds to each
reference itself, from the frozen reviewed revision, at the reference's aspect
ratio (16:9 at 1600×900 unless the issue states otherwise) with the same data
state, camera and zoom the reference depicts. Capture with the project's
Playwright dev dependency (`import { chromium } from "playwright"`, Chromium via
`npx playwright install chromium`), saving the screenshot and the DOM boxes of
visible labels, tokens and controls. Worker screenshots are supporting evidence
only. Without browser access or a corresponding state, report that pair BLOCKED.

Each reference needs a stored annotation with the values deterministic metrics
compare against: board bounding box, label centers and heights, and its dominant
palette. Measure it once with the same procedures below and keep it beside the
image as `<image>.annotation.json`. A missing annotation makes the affected
deterministic metrics BLOCKED, not guessed.

Run [scripts/visualMetrics.mjs](../scripts/visualMetrics.mjs): `annotate <reference.png>`
writes the annotation; `score --reference <png> --target <url|file> [--allow <selector>]
[--wait <ms>] [--screenshot <png>]` captures the target and prints every D metric
with its raw value and tier. Pass scope-allowed elements, such as the mail card,
through `--allow`; use `--wait` for a 3D canvas to settle.

## Evaluation methods

- **D: deterministic.** Computed from the screenshot pixels, DOM boxes, computed
  styles and the reference annotation. Same inputs give the same tier.
- **P: prompted checklist.** A vision judgment, constrained to yes/no items so
  the tier is derived by counting. Run the prompt below three times in fresh
  contexts; each item takes the majority answer. Report any item that did not
  agree in all three runs.

P prompt, one call per metric:

```
You compare an application screenshot against a design reference.
Reference: <image>   Screenshot: <image>   Scope exclusions: <list>
Answer each item strictly from what is visible in the screenshot.
For each item return {"id","answer": true|false,"evidence": "<what you see, where>"}.
Do not score, summarize or suggest fixes. Unsure counts as false.
Items:
<the metric's checklist>
```

## Metrics

Every metric yields tier 1–5. An aspect's tier is the **lowest** tier among its
metrics: an aspect is only as good as its weakest metric, so easy metrics (no
chrome, pill style) cannot offset a failed core one (projection, material, family). Checklist tiers use the pass ratio: 100% → 5, ≥ 75% → 4,
≥ 50% → 3, ≥ 25% → 2, otherwise 1.

### Layout & composition — weight 25%

| ID | Metric | Method | Tier 5 / 4 / 3 / 2 / 1 |
| -- | ------ | ------ | ---------------------- |
| L1 | UI chrome: DOM elements anchored to a viewport edge spanning > 30% of its width or height, excluding scope-allowed elements | D | 0 / – / – / – / ≥ 1 (binary: 5 or 1) |
| L2 | Board footprint: board bbox width ÷ viewport width, as \|app − ref\| | D | ≤ 0.05 / ≤ 0.10 / ≤ 0.15 / ≤ 0.25 / more |
| L3 | Board placement: board bbox center, positioned relative to the free area (viewport minus scope-allowed panels spanning ≥ 50% of it), offset from the reference center relative to the viewport, % of viewport diagonal | D | ≤ 3 / ≤ 6 / ≤ 10 / ≤ 15 / more |
| L4 | Arrangement: tile count and adjacency match; outlying tile placed as in reference; water fills the remaining canvas | P | checklist ratio |

Board bbox: union of components covering ≥ 1% of the viewport among pixels whose
CIEDE2000 distance from the median color of the outer 5% frame exceeds 12, after
a 5 px morphological opening. Regions of scope-allowed elements (`--allow`) are
excluded first. The main island is the largest component.

### Geometry & proportion — weight 20%

| ID | Metric | Method | Tier 5 / 4 / 3 / 2 / 1 |
| -- | ------ | ------ | ---------------------- |
| G1 | Main island aspect: main island bbox width ÷ height, as \|app ÷ ref − 1\| | D | ≤ 5% / ≤ 10% / ≤ 15% / ≤ 25% / more |
| G2 | Projection: top faces foreshortened by one isometric camera; buildings drawn in the same camera as tiles; tile thickness visible on front edges | P | checklist ratio |
| G3 | Tiling: adjacent tiles share full edges; no tile overlaps another; no gaps between adjacent tiles | P | checklist ratio |

### Color & material — weight 20%

| ID | Metric | Method | Tier 5 / 4 / 3 / 2 / 1 |
| -- | ------ | ------ | ---------------------- |
| C1 | Palette distance: k-means (k = 6, Lab) on the board bbox; area-weighted mean CIEDE2000 from each reference color to its nearest app color | D | ≤ 5 / ≤ 10 / ≤ 15 / ≤ 25 / more |
| C2 | Water color: CIEDE2000 between median colors of the outer 5% frame | D | ≤ 5 / ≤ 10 / ≤ 15 / ≤ 25 / more |
| C3 | Material and light: faces show directional shading; objects cast soft shadows; surfaces are matte low-poly; simple geometric trees present where the reference has them | P | checklist ratio |

### Labels & controls — weight 15%

| ID | Metric | Method | Tier 5 / 4 / 3 / 2 / 1 |
| -- | ------ | ------ | ---------------------- |
| B1 | Overlap: pairs of visible labels, tokens and controls whose DOM boxes intersect | D | 0 / – / 1 / 2 / ≥ 3 |
| B2 | Label size: median label height, app from DOM boxes, reference from detected pills (near-white L ≥ 88, chroma ≤ 12, width ≥ 1.8 × height), as \|app ÷ ref − 1\| | D | ≤ 10% / ≤ 20% / ≤ 35% / ≤ 50% / more |
| B3 | Label style from computed styles: pill radius ≥ height ÷ 2; background luminance ≥ 0.85; text contrast ≥ 7:1; sans-serif family | D | 4 / 3 / 2 / 1 / 0 checks passed |
| B4 | Legibility: no label hides its building's silhouette; one label per tile name; counts read as compact tokens | P | checklist ratio |
| B5 | Interface text (screenshot only; scored even when the reference shows no such text; any false item caps the tier at 2): one item per visible text string, "names the thing or action only — no state the control's appearance already shows (e.g. `尚未開放` on a greyed button) and no developer or build wording such as `示範`, `示範用`, `demo`, `mock`, `測試` or `placeholder`, even inside a product phrase like `打開你的示範群島` or `體驗示範`" | P | checklist ratio |

### Element identity — weight 20%

| ID | Metric | Method | Tier 5 / 4 / 3 / 2 / 1 |
| -- | ------ | ------ | ---------------------- |
| E1 | Family match: one item per visible category, "the building's silhouette, structure and material form match [style guide family]" — judge massing, roof form and structure, never roof or wall color, which varies between generated concepts | P | checklist ratio |
| E2 | Distinct silhouettes: one item per pair of different visible categories, "silhouettes differ without relying on color or label" | P | checklist ratio |

Drop C1 and C2 when the reference shows a lighting state (night, dusk) that the
captured state does not, or that the issue scope excludes; color then rests on C3.
Drop a metric the reference does not depict and record why (`--drop`); drop an aspect only
when all its metrics are dropped, and renormalize the aspect weights.

## Total, findings and verdict

`Total = Σ(aspect weight × (aspect tier − 1) ÷ 4)`, as a percentage: tier 1
contributes 0%, tier 5 the full weight.

- An aspect at tier 1–2 → one T2 finding for that aspect.
- An aspect at tier 3 → one T3 finding for that aspect.
- Total below 50 → one T2 finding for overall visual fidelity, in addition.
- Visual PASS requires total ≥ 75 and every aspect at tier ≥ 3.

Each finding cites the failing metric IDs with their measured values or
checklist evidence. Generated concept images vary in sample counts and colors,
so thresholds compare design intent; never require pixel equality.

## Report

Return one scorecard per reference pair, with every metric's raw value or
checklist answers, its tier, and P-item agreement across the three runs:

```
Reference: reference/email-island/generated/home-page/nighttime-island.png
Screenshot: <path>  Viewport: 1600x900  Revision: <sha>  State: <state>
Layout 25%    L1 0→5  L2 0.12→3  L3 2.1%→5  L4 3/4→4      tier 4
Geometry 20%  G1 18%→2  G2 1/3→2  G3 1/3→2                  tier 2  → T2
...
Total 58%  Verdict FAIL   Unstable P items: G3.2
```

On correction rounds, rescore affected pairs from new screenshots and keep each
metric's history in the finding ledger.
