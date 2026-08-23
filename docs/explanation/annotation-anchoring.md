# Annotation Anchoring

Annotation anchoring is the mechanism that lets a saved highlight reappear after
the page is reloaded.

## The Problem

The user selects text in an iframe. A DOM `Range` can describe that exact
selection right now, but a range cannot be saved directly:

- it contains live DOM node references
- those nodes disappear when the page reloads
- source pages can insert ads, scripts, math rendering, or layout wrappers
- text nodes are split when highlights are injected

So the app stores a text anchor instead of a DOM range.

## The TextAnchor Model

The global `TextAnchor` type is:

```ts
type TextAnchor = {
  version: 1;
  start: number;
  end: number;
  exact: string;
  prefix: string;
  suffix: string;
};
```

`exact` is the selected text. `prefix` and `suffix` are nearby context used when
the same quote appears more than once.

Runtime annotation rows store:

- `exact`
- `prefix`
- `suffix`

`normalizeAnnotationRow()` turns those fields back into a `TextAnchor`.

## Text Indexing

[core/annotation/dom/dom.ts](../../core/annotation/dom/dom.ts) builds a visible
text index for the iframe root.

The index:

- walks visible text nodes
- ignores script/style/template/noscript/hidden content
- excludes assistive MathJax/KaTeX duplicates
- normalizes Unicode to NFC
- removes invisible text characters
- collapses whitespace
- maps each normalized character back to its original text node and offset

That character-to-node mapping is what lets the app move between text anchors
and DOM ranges.

## Creating A New Anchor

The highlight creation path lives in
[components/SelectionToolbar.tsx](../../components/SelectionToolbar.tsx).

The important order is:

1. Read the user's current selection as a DOM `Range`.
2. Build or reuse a text index for the content root.
3. Convert the range into a `TextAnchor`.
4. Save the annotation row.
5. Wrap the range with highlight spans.

The anchor must be created before wrapping. `highlightRange()` mutates the DOM
by splitting text nodes and moving selected nodes into `span.highlighted-text`.

## Reconstructing A Range

`getRange(root, position)` reconstructs a DOM range from a saved anchor.

It tries:

1. Fast path: `text.slice(position.start, position.start + exact.length)`.
2. Single match: if `exact` appears only once, use it.
3. Context match: if `exact` appears multiple times, rank candidates by prefix
   and suffix context.

It refuses to guess when candidates are ambiguous.

## Applying Saved Highlights

[core/annotation/session/highlights.ts](../../core/annotation/session/highlights.ts)
applies a batch of saved annotations.

The function:

1. Builds one text index for the current iframe root.
2. Resolves every annotation to a range before mutating the DOM.
3. Sorts ranges from bottom to top.
4. Calls `highlightRange()` for each range.
5. Repairs stored anchors if the resolved position changed.

Bottom-to-top wrapping is important because wrapping earlier text can invalidate
range boundaries that appear later in document order.

## Dynamic Pages

Some pages continue changing after iframe load. `useAnnotationSession()` retries
unmatched annotations after meaningful DOM mutations for a short period.

It ignores annotator-owned mutations so the highlight spans themselves do not
cause infinite retry loops.

## Resizing

Resizing uses the same model. A resized selection is converted to a new
`TextAnchor`, then the annotation row is updated.

The resize code removes old highlight spans and reconstructs the new range from
the new anchor before highlighting it. That validates that the new saved anchor
can actually be recovered.

## Sanitized HTML Excerpts

Each annotation can also store a sanitized HTML excerpt. That is for display in
the dashboard and annotations panel. It is not the durable anchor.

The sanitizer removes dangerous elements, event handlers, and annotator-owned
highlight spans. The text anchor remains the source of truth for finding the
highlight in the iframe.

## Tests

The main tests are in [tests/textAnchor.test.ts](../../tests/textAnchor.test.ts).
They cover:

- Unicode and whitespace normalization
- repeated text matching
- refusal to guess ambiguous matches
- MathJax indexing
- relocation after surrounding text changes
