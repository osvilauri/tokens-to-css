---
"tokens-to-css": minor
---

Stylesheet emission: a normalized document becomes one `:root` block of custom
properties in document order, with references written as `var(--target)` rather
than resolved to the target's value.
