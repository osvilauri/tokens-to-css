---
"tokens-to-css": minor
---

`generateCss` now converts: it reads a local DTCG token file, validates it, and
writes the stylesheet atomically. A failed conversion writes nothing and leaves
any previous stylesheet exactly as it was.
