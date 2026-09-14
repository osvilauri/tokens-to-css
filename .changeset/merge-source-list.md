---
'tokens-to-css': minor
---

A Token Source can now be a list, and the documents are merged in order (FR-27).

Each source is read, detected and normalized on its own — so one design system may mix DTCG and Style Dictionary legacy files — and the merge happens on the internal representation, keyed by token path. First appearance decides a token's position in the stylesheet; a later source redefining it updates the value in place. The alias graph and the collision pass run once, over the merged document, which is what makes a reference from one file to a token defined in another an ordinary reference instead of a dangling one.

`generateCss` accepts `string | URL | readonly (string | URL)[]`, and the result carries `sources`: everything that was merged, in order, as it resolved. A stylesheet built from more than one source names them in a comment above `:root`.

Additive in every direction: a conversion from a single source type-checks as it did, returns a one-element `sources`, writes no comment block, and produces the same bytes.
