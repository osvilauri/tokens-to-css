<!--
  GENERATED FILE — do not edit.

  Written by scripts/generate-docs.mjs from src/errors.ts. Change the doc comment
  on a code and run `npm run docs:generate`; lint and CI fail if this file and
  that source disagree.
-->

# Failure codes

Every failure this library raises is a `TokenCssError` carrying one of these
codes. Branch on `error.code`; never match on the message, which is free to
improve.

The codes are **public contract**. Adding one is a minor release; renaming,
merging or removing one is a major release.

| Code | Raised when |
| --- | --- |
| `SOURCE_UNREADABLE` | The path or URL could not be read: missing, denied, unreachable, timed out, oversized, or refused by network policy. |
| `SOURCE_INVALID_JSON` | The source was read but its content is not valid JSON. |
| `FORMAT_NOT_ALLOWED` | The document is not a shape this version accepts. |
| `ALIAS_CYCLE` | Aliases reference each other in a loop. |
| `ALIAS_DANGLING` | An alias points at a token that does not exist. |
| `COMPOSITE_VALUE` | A value is an object, array, boolean, or null rather than a scalar. |
| `NAME_COLLISION` | Two or more tokens would emit the same custom-property name. |
| `OUTPUT_WRITE_FAILED` | The stylesheet could not be written. |

## What an error carries

```ts
try {
  await generateCss('design/tokens.json')
} catch (error) {
  error.code        // one of the 8 above
  error.source      // the Token Source, as you passed it
  error.tokenPaths  // the offending tokens — empty when the failure is not token-scoped
}
```

## Nothing is written on a failure

Whatever goes wrong, no stylesheet is produced: not an empty one, not a partial
one, and not a truncated overwrite of the one already there. A failed run leaves
your last good output exactly as it was.
