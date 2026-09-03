---
'tokens-to-css': minor
---

A token whose value cannot be written as CSS no longer fails the whole document.

Until now a single composite — a typography block, a shadow list — cost the file
it lived in, so a system with two hundred good colours and one malformed token
produced no stylesheet at all. Such a token is now **skipped**: left out, and
announced in two places.

`GenerateCssResult` gains `skipped`, listing each omitted token with its path,
its `FailureCode` and a reason. And the stylesheet itself carries a comment
block above `:root` naming them — which is the half that matters, because a
generated stylesheet lives in a repository and a token that stopped being
emitted shows up in the next pull request's diff.

Three rules keep partial from becoming lossy. A conversion that would declare
zero custom properties fails with the new `NOTHING_EMITTED` code rather than
writing an empty stylesheet. A reference to a skipped token is dangling, and
still fatal. And a document with nothing skipped emits no comment block, so
every conversion that succeeded before this change produces identical bytes.

Only composite values are skipped. Everything else fails exactly as it did: an
unreadable source, invalid JSON, a shape outside the allowlist, an alias cycle,
a dangling reference, a name collision, Tokens Studio arithmetic, a non-CSS
unit, a reference buried inside a larger value.
