# ZT Brand Color HTML — distilled style guide

This guide captures the stable visual decisions shared by the supplied HRIS / HRAS AI HTML decks. It is a design reference, not a content source. Replace all example copy with the user's actual content.

## 1. Brand character

The visual language is an editorial business system: calm paper background, confident navy structure, orange moments of action, and restrained blue/cyan metadata. It should feel like a considered operating model or product narrative, not a generic SaaS template.

The design has three recurring tensions:

- paper surface vs. dark structural anchor;
- system/process clarity vs. human business judgment;
- quiet grid/rings vs. a few high-contrast focal moments.

Use those tensions to give a slide a point of view. Do not decorate every empty area.

## 2. Tokens

Use CSS custom properties so the deck can be rethemed in one place.

```css
:root {
  --stage-bg: #071737;
  --slide-bg: #fbfaf5;
  --paper: #ffffff;
  --paper-2: #f5f2eb;
  --navy: #0c2459;
  --navy-deep: #081a45;
  --blue: #2d63ff;
  --blue-soft: #e8efff;
  --orange: #f27f22;
  --orange-soft: #fff0e3;
  --cyan: #168b98;
  --cyan-soft: #e3f6f5;
  --ink: #13224a;
  --muted: #68748d;
  --line: #d9deea;
  --font-display: "Manrope", "Noto Sans SC", sans-serif;
  --font-body: "Noto Sans SC", sans-serif;
  --ease: cubic-bezier(.16, 1, .3, 1);
}
```

For the softer paper-editorial variant, the following aliases are acceptable: `--stage-bg: #eeeae2`, `--slide-bg: #fbfaf6`, `--ink: #17233f`, `--muted: #4c5874`, and `--line: #e5e1d8`. Keep the orange/navy relationship intact. Semantic green, gold, and red may be added for status or validation only, with pale matching fills.

## 3. Typography

- Load `Manrope` for display labels/headlines and `Noto Sans SC` for Chinese body copy when network fonts are allowed; always keep the listed fallbacks.
- Rail-led headline: roughly `64–68px`, weight `800–900`, line-height `1.15–1.2`, letter-spacing around `-.04em`.
- Paper-editorial headline: roughly `56–64px`, weight `800`, line-height around `1.16`, letter-spacing around `-.025em`.
- Lead/deck explanation: roughly `22–27px`, line-height `1.55–1.65`, `--muted` or the soft-editorial ink.
- Kicker: `18–23px`, bold display font, orange, increased tracking (`.12–.18em`), often preceded by a short orange rule.
- Card headings: `25–38px`, weight `700–800`; card body: `18–23px`, line-height `1.5–1.6`.
- Footer and metadata should be noticeably quieter than the claim, usually `13–20px` depending on the frame.

Keep Chinese headline lines short enough to scan in one glance. Use `<em>` or a dedicated emphasis span only for the key phrase, and color it blue or orange according to meaning.

## 4. Canvas and frame

Every generated deck must contain this conceptual structure:

```html
<div class="deck-viewport">
  <main class="deck-stage" id="deckStage">
    <section class="slide active visible" data-title="..." aria-label="第1页：..."></section>
    <!-- more slides -->
  </main>
</div>
```

The stage is `1920px × 1080px`, absolutely positioned, `transform-origin: 0 0`, and centered by JavaScript using `Math.min(innerWidth / 1920, innerHeight / 1080)`. Slides stack in the stage and toggle `active`/`visible` classes. Use `overflow: hidden` on the viewport, stage, and slides. Media must have `max-width` and `max-height` guards.

Keep `@media print` so each slide becomes a visible, fixed-size page and outside-stage controls are hidden. Keep a reduced-motion rule that removes meaningful reveal delay without hiding any content.

### Variant A: rail-led

Use for strategic or operating-model storytelling.

```css
.rail { width: 175px; background: var(--navy); }
.topline { left: 260px; right: 100px; top: 76px; }
.content { left: 260px; right: 105px; top: 160px; bottom: 140px; }
.footer { left: 260px; right: 105px; bottom: 72px; }
```

The rail typically includes a 24px orange vertical bar near the upper left, a low-contrast circular line motif near the bottom, and a vertical white mark such as a deck label. The topline uses blue for the deck label and muted gray for an English section marker. The footer uses a thin top border.

### Variant B: paper-editorial

Use for workshops, explainers, or decks with more diagrams/data.

```css
.slide-inner { padding: 72px 100px 68px; }
.part-tag { right: 100px; top: 44px; }
.slide-foot { left: 100px; right: 100px; bottom: 32px; }
```

Use a faint warm/cool radial glow and a masked `76–80px` grid. Add a small progress bar at the viewport top when it helps orientation. This variant is more open and does not need the left rail.

Do not put the rail-led frame and paper-editorial frame on different slides of the same deck unless the user explicitly asks for a deliberate section break.

## 5. Surface and decoration

The base slide is usually `--slide-bg` with one or two very faint radial gradients. A grid may be added with two 1px linear gradients and a mask; it should disappear toward the edges, not become graph paper.

White content cards usually use:

```css
background: rgba(255,255,255,.96);
border: 1px solid rgba(12,36,89,.10–.14);
border-radius: 22–30px;
box-shadow: 0 16px 52px rgba(25,45,87,.06–.12);
```

Dark anchor panels use a navy-to-blue gradient and a stronger shadow. Orange-soft and blue-soft fills are for semantic grouping, not full-page background bands. Large translucent ghost numbers, circles, and rings can sit behind content through `::before`/`::after`; keep them low opacity and clipped.

## 6. Layout recipes

Pick the recipe that best proves the slide's claim.

### Hero / route

Two-column grid with the claim on the left and a white route card on the right. Show a concise progression of nodes separated by blue arrows; highlight the changed owner or destination in solid orange. Add one full-width navy thesis bar beneath the main content.

### Card grid

Use three cards for three categories or four cards for a 2×2 framework. Give each card a clear number/icon, heading, and short explanation. Add a colored top border or icon fill per category. A single ghost number can add rhythm; never let it compete with copy.

### Operating loop

Use four or five numbered cards aligned over a thin horizontal rule that ends in an orange arrow. Alternate blue and orange only when the sequence has a semantic transition; do not rainbow the loop.

### Before / after

Use a three-column row: muted gray before-state, dark navy transition cell, and orange-soft future-state. The middle arrow is a visual hinge, not a text column. Keep each row to one concise sentence per state.

### Rebuild / flow

Use two white cards separated by a central navy circular node such as `AI`, `产品`, or `机制`. Each card can contain a 4–5 step flow of circular nodes and thin arrows. This is useful for showing “process + experience” or two sides of a transformation.

### Close

Use a single large navy gradient card with one orange ring or arc, one short kicker, a strong closing statement, and one supporting paragraph. End on a clear decision or behavior, not a summary wall of text.

### Data / chart

Use CSS or inline SVG for simple bars, lines, or matrices. Label units, time range, and source when data is supplied. Keep chart ink navy/blue, reserve orange for the chosen insight, and show the takeaway in a nearby callout. Do not invent values to make a chart look complete.

## 7. Interaction chrome

The shared runtime should support:

- previous/next buttons with `aria-label`;
- `ArrowRight`, `ArrowDown`, `PageDown`, and space for next;
- `ArrowLeft`, `ArrowUp`, and `PageUp` for previous;
- `Home` and `End` when practical;
- touch swipe with a sensible threshold; wheel navigation only with a debounce/lock;
- a two-digit current/total page indicator and optionally a thin orange progress bar;
- `data-goto` links for slide-local calls to action;
- optional `history.replaceState` hash such as `#slide-3`.

Controls are deliberately quiet: translucent dark navy or white, rounded pill, low idle opacity, stronger on hover. Hide them in print.

## 8. Inline editing

Use a hidden top-left hot zone that reveals a pencil toggle. On `E`, toggle only nodes marked `.editable` (or the equivalent explicit selector) to `contenteditable="true"`; leave buttons, links, counters, and layout wrappers untouched. Show a dashed orange outline while editing. Ignore slide-navigation keystrokes when the event target is editable.

Persist edits as a JSON object keyed by each node's stable `data-id`; namespace the key per deck. Save on `Ctrl/Cmd + S` and when leaving edit mode. If a download button is included, clone the document, set all editable nodes to `contenteditable="false"`, and download the current HTML. Never overwrite the source file implicitly.

## 9. Content and QA checks

Before delivery, confirm:

- the deck has a coherent opening, middle, and close;
- each slide has one dominant claim and no accidental essay-length text;
- emphasized words use the palette consistently;
- cards line up on a visible spacing rhythm;
- no text, chart, image, rail, or footer is clipped at 1920×1080;
- contrast remains readable on paper, blue-soft, orange-soft, and navy surfaces;
- editable content has unique IDs and survives reload;
- navigation does not fire while typing;
- print shows all slides and no presentation chrome;
- all user-provided facts, labels, and sources are preserved exactly unless the user asked for editorial rewriting.
