# Change Annotation Behavior

Use this guide when changing how highlights are created, displayed, resized, or
saved.

## Before You Start

Read:

- [Annotation anchoring](../explanation/annotation-anchoring.md)
- [Project map](../reference/project-map.md)

## Selection And Highlight Creation

Start in [components/SelectionToolbar.tsx](../../components/SelectionToolbar.tsx).

The creation path is:

1. Detect a non-collapsed selection inside `session.root`.
2. Clone the selected `Range`.
3. Save a sanitized HTML excerpt with `cleanHtml(convertRangeToHtml(range))`.
4. Create a durable `TextAnchor` with `createTextAnchor(root, range)`.
5. Save the annotation through `addAnnotation()`.
6. Visually wrap the selected range with `highlightRange()`.

Keep the order. Creating the anchor after `highlightRange()` is risky because
highlighting mutates text nodes.

## Existing Highlight Actions

Start in [components/FocusedAnnotationToolbar.tsx](../../components/FocusedAnnotationToolbar.tsx).

This file handles:

- focusing a clicked highlight
- comment editing
- color changes
- delete actions
- entering resize mode on coarse-pointer devices

Color changes update the DOM immediately through `session.updateHighlightColor()`
and persist through `updateAnnotation()`.

## Resizing

Start in [components/AnnotationResizeHandles.tsx](../../components/AnnotationResizeHandles.tsx).

Desktop resizing uses custom start/end handles. Coarse-pointer resizing uses the
browser's native selection handles. Both paths eventually call `commitRange()`.

`commitRange()`:

1. Converts the candidate range to a new `TextAnchor`.
2. Removes old highlight spans.
3. Reconstructs the range from the new anchor.
4. Saves a new sanitized HTML excerpt.
5. Re-highlights the page.
6. Persists the updated annotation row.

If persistence fails, the code tries to roll the DOM back to the previous
position.

## Reapplying Saved Highlights

Start in [core/annotation/session/highlights.ts](../../core/annotation/session/highlights.ts).

Saved annotations are matched against a single text index and sorted from bottom
to top before wrapping. That order reduces the chance that earlier wrapping
invalidates later ranges.

## Tests To Run

```sh
npm run test
npm run typecheck
```

If you touched anchoring, add tests in `tests/textAnchor.test.ts`.

If you touched sanitization, add tests in `tests/sanitizeHtml.test.ts`.
