# Golf Club Advisor — Knowledge Base

> **App source of truth:** Runtime logic lives in `data/golfKnowledge.ts`.  
> Keep this document and that file aligned when changing fitting rules or catalog copy.

## Categories

| Category   | Role |
|-----------|------|
| Driver    | Max distance off the tee; loft, spin, and forgiveness tradeoffs. |
| Fairway   | Off-deck and light-rough play; smaller head than driver. |
| Hybrid    | Easier launch than long irons; gap filler for long approaches. |
| Irons     | Approach shots; cavity-back vs players distance vs blade spectrum. |
| Wedges    | Scoring clubs; bounce and grind for turf conditions and technique (home screen + quiz supported). |
| Putter    | Distance control and alignment on greens. |

## Fitting principles (used in scoring)

- **Swing speed / tempo:** Higher speed often benefits lower-spin / stiffer profiles; slower swings benefit launch and lightweight shafts.
- **Skill:** Beginners favor forgiveness (high MOI, wide soles); advanced players may prefer workability and thinner top lines.
- **Hand dominance:** Affects lie and sometimes grip thickness (coarse rule in app: slight preference for neutral-balanced models for left-handed users).
- **Age group:** Juniors/seniors often benefit from lighter total weight and more launch-friendly lofts (represented via quiz tags).

## Quiz → recommendation

Each answer option carries **tags** (e.g. `high-launch`, `max-forgiveness`).  
Products in each category carry **tags**. The app scores overlap between selected tags and product tags and returns the best match plus a short rationale.

## Product catalog (illustrative)

Not exhaustive; replace with real SKUs later. Names are representative of market segments.

### Driver

- **Max forgiveness / high launch** — Tags: `max-forgiveness`, `high-launch`, `mid-spin`  
- **Low spin / better player** — Tags: `low-spin`, `workable`, `stiff-profile`  
- **Lightweight / moderate speed** — Tags: `lightweight`, `high-launch`, `draw-bias-ok`

### Fairway wood

- **High launch fairway** — Tags: `high-launch`, `max-forgiveness`  
- **Compact fairway** — Tags: `low-spin`, `workable`  
- **Shallow face / sweep** — Tags: `rail-sole`, `high-launch`

### Hybrid

- **Rescue / iron replacement** — Tags: `high-launch`, `max-forgiveness`, `offset-ok`  
- **Compact hybrid** — Tags: `low-spin`, `workable`  
- **Dual-purpose long iron** — Tags: `penetrating`, `mid-launch`

### Irons

- **Game improvement cavity** — Tags: `max-forgiveness`, `high-launch`, `wide-sole`  
- **Players distance** — Tags: `ball-speed`, `slim-topline`, `mid-forgiveness`  
- **Players / blade** — Tags: `workable`, `feedback`, `low-offset`

### Wedges

- **High bounce / soft conditions** — Tags: `high-bounce`, `full-sole`  
- **Mid bounce / versatile** — Tags: `mid-bounce`, `all-around`  
- **Low bounce / firm links** — Tags: `low-bounce`, `tight-lie`

### Putter

- **Face-balanced mallet** — Tags: `stability`, `straight-back`  
- **Mid-mallet flow** — Tags: `arc-friendly`, `mid-toe-hang`  
- **Blade / slight arc** — Tags: `toe-hang`, `feedback`
