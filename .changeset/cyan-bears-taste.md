---
"tokens-to-css": minor
---

The custom-property naming rule and literal serialization. Token paths become
`--dashed-lowercase-names`; strings are written verbatim and numbers plainly,
with no unit inference. Values that are not scalars are refused rather than
stringified.
