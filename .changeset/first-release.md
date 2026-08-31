---
"tokens-to-css": major
---

First release.

Converts design-token JSON into a CSS custom-properties stylesheet. Reads DTCG —
including the object notation the current spec uses for colours and dimensions —
Style Dictionary legacy, and Tokens Studio exports, from a local path or a URL.
References are emitted as `var(--…)` rather than flattened.

Published as 1.0.0 rather than 0.x deliberately: the emitted custom-property
names and the eight failure codes are frozen public contract from this version
on, and a `0.x` would have invited people not to rely on them.
