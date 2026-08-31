# tokens-to-css

## 1.0.0

### Major Changes

- e3426d1: First release.
  
  Converts design-token JSON into a CSS custom-properties stylesheet. Reads DTCG —
  including the object notation the current spec uses for colours and dimensions —
  Style Dictionary legacy, and Tokens Studio exports, from a local path or a URL.
  References are emitted as `var(--…)` rather than flattened.
  
  Published as 1.0.0 rather than 0.x deliberately: the emitted custom-property
  names and the eight failure codes are frozen public contract from this version
  on, and a `0.x` would have invited people not to rely on them.

### Minor Changes

- 58eef0f: Name collision detection: two token paths that arrive at the same custom
  property are refused by name rather than one quietly overwriting the other.
- 37ebd16: The public surface is settled: `generateCss`, `TokenCssError`, the eight
  `FailureCode` values, and the option and result types. The conversion behind the
  entry point arrives in Story 1.10; until then a publish guard refuses release.
