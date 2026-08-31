---
name: zt-brand-color-html
description: Create or restyle single-file, editable 16:9 HTML slide decks in the ZT navy-orange visual system, with Chinese-first typography, strong editorial hierarchy, and lightweight presentation controls.
---

# ZT Brand Color HTML

Use this skill when the user asks for an HTML presentation, slide deck, editable HTML deck, or a restyle that should match the ZT / HRAS reference style. Do not use it for PowerPoint/Google Slides output or for ordinary web pages unless the user explicitly asks for the slide-deck treatment.

## Source of truth

Read [references/style-guide.md](references/style-guide.md) before creating or substantially restyling a deck. It is a distilled visual system from the three supplied reference HTML files; it contains no reference-deck business copy.

When starting from scratch, use [assets/zt-deck-starter.html](assets/zt-deck-starter.html) as the runtime scaffold, then replace its sample slide content and deck-specific labels. Do not copy a whole reference deck and merely swap words: preserve the system, but make the composition fit the user's story.

## Required output

- Produce one self-contained `.html` file with embedded CSS and JavaScript and no build step.
- Author the canvas at exactly `1920 × 1080` and scale the complete stage to the available viewport. Do not reflow the authored slide into a mobile layout.
- Keep presentation chrome outside the authored stage: navigation, progress, edit toggle, and similar controls must not change the slide composition or appear in print output.
- Default to inline editing. Mark user-editable copy with a stable, unique `data-id` and the `.editable` class; do not make navigation, controls, decorative nodes, or structural wrappers editable.
- Include keyboard navigation, touch swipe navigation, a visible but quiet page indicator, and print CSS. If using the starter, retain its behavior unless the user asks for a different interaction model.
- Keep content inside the 16:9 bounds. Check for clipping, overflow, overlapping text, low contrast, and controls that cover content before handing off.

## Working method

1. Establish the deck's single narrative arc and a one-sentence claim for each slide before styling. Each slide needs one dominant message, one supporting explanation, and one visual proof structure (cards, flow, comparison, loop, or chart).
2. Choose one layout variant for the deck. Use `rail-led` for strategic narratives, role/operating-model stories, and sectioned business presentations. Use `paper-editorial` for lighter workshops, explainers, or data-heavy decks. Do not mix both page frames on the same slide.
3. Use the shared ZT tokens and component recipes in the style guide. Let layout, spacing, and type hierarchy carry the message; do not add a new accent color or decorative motif without a clear semantic reason.
4. Keep CSS class names and `data-id` values deck-specific where needed. Use semantic HTML (`main`, `section`, `header`, `footer`, `article`, `nav`) and meaningful `aria-label` text for slides and controls.
5. Give editable decks a deck-specific `localStorage` key. Save on exit from edit mode and on `Ctrl/Cmd + S`; if a download action is present, serialize the edited HTML with editing disabled in the downloaded copy.
6. If the user supplies new content, preserve the content's facts and intent. The visual system is a style constraint, not permission to invent statistics, logos, sources, or business claims.

## Visual guardrails

- Default palette is warm paper + deep navy structure + orange emphasis, with blue or cyan as restrained secondary accents.
- Use large, compact headlines; Chinese body copy must remain readable at presentation scale. Avoid paragraphs that turn a slide into a document.
- Prefer white cards with thin cool-gray borders, generous radius, and soft navy shadows. Use one dark navy anchor panel when a slide needs contrast.
- Use quiet radial glows, hairline grid texture, thin rules, numbered markers, rings, and geometric pseudo-elements. Keep decoration subordinate to the claim.
- Use orange to signal action, emphasis, or transition; use blue for structure, navigation, and primary sequence. Use cyan only as a third semantic category. Do not turn every item into a colorful badge.
- Avoid generic dashboard chrome, dense pill clusters, stock-image collages, excessive gradients, and unmotivated glassmorphism.
- Do not let reveal animations hide content in print or reduced-motion mode. Respect editable text and never intercept navigation keys while the user is typing.

## Verification

After writing the HTML, inspect it as a rendered slide deck when a browser or local preview is available. Verify at least the first slide, a dense content slide, and the final slide at the 1920×1080 authored canvas. Also verify that `@media print` exposes one slide per page and that edit mode does not make controls editable. Fix layout issues instead of explaining them away.

User-specific layout, color, typography, accessibility, or interaction requirements override these defaults. If a required asset, logo, font, or source is missing and cannot be inferred safely, state the gap plainly and proceed with a neutral fallback only when that does not change the user's meaning.
