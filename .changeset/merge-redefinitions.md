---
'tokens-to-css': minor
---

A merge now says which tokens one source took over from another (FR-27).

When two sources define the same token path with different values the later one wins, as it always did, and the conversion announces it: `GenerateCssResult.redefinitions` carries the path, the source that lost and the source that won, and the comment above `:root` names them next to the values that survived — which is where somebody reading the next pull request will see it.

**Only value-changing redefinitions are announced.** A later source that repeats a token verbatim, or a source listed twice — which published resolver manifests do — changed nothing and is reported as nothing. Measured across seven published design systems: 98 identical re-applications, zero value-changing ones.

A redefinition is not a name collision. Two *different* paths that would emit the same custom property still fail with `NAME_COLLISION`; a merge cannot resolve that and must not try.

Additive: single-source conversions return an empty `redefinitions` and produce the same bytes.
