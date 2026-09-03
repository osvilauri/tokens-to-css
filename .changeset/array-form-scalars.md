---
'tokens-to-css': minor
---

Font families and easing curves written as arrays now convert.

```json
{ "font": { "mono": { "$type": "fontFamily", "$value": ["Monaco", "Consolas", "monospace"] } },
  "easing": { "in": { "$type": "cubicBezier", "$value": [0.2, 0, 0, 1] } } }
```

```css
  --font-mono: Monaco, Consolas, monospace;
  --easing-in: cubic-bezier(0.2, 0, 0, 1);
```

Neither is a composite: an array of names and four numbers describe exactly one
CSS value each. They were refused for being arrays, in the same way colours and
dimensions were refused for being objects before the previous release — the same
mistake standing in the other notation.

Recognition reads the shape and never the declared `$type`, so a `16` still
never becomes `16px`.

A family name is quoted only when it needs to be, and a generic family never is:
`"sans-serif"` in quotes names a font that does not exist. An entry that already
contains a comma or a quote is passed through untouched — Microsoft Fluent and
GitHub Primer both write a whole pre-quoted stack where the spec says one name
goes, and quoting that would produce a single bogus font name.

An array that is neither shape — empty, mixed, a shadow list, or holding a
reference — is skipped rather than guessed at.
