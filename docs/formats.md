# What it accepts

Three input shapes, listed here in the order they are checked. The first that
matches decides how the document is read, so a file that could be read two ways
is always read the same way.

Anything outside this list is refused with `FORMAT_NOT_ALLOWED`, naming what is
accepted. There is no heuristic fallback: a shape is on this list or it is not.

## 1. Tokens Studio exports

Recognized by `$themes` or `$metadata` at the top level.

```json
{
  "$metadata": { "tokenSetOrder": ["global"] },
  "$themes": [],
  "global": {
    "color": { "brand": { "value": "#5A4FCF", "type": "color" } }
  }
}
```

- The plugin's own keys are read and ignored.
- **The token set wrapper is dropped from the name.** This emits
  `--color-brand`, not `--global-color-brand`.
- Only the **top-level** key is a wrapper. Everything below it is an ordinary
  group, including a key that happens to look like a set name.
- **One set per file.** More than one is refused: merging them would mean
  deciding which set wins, and the export does not record that.
- Either dialect below may appear inside the wrapper.

## 2. DTCG

Recognized by `$value` anywhere in the document.

```json
{
  "color": {
    "brand": { "$value": "#5A4FCF", "$type": "color" },
    "text":  { "$value": "{color.brand}" }
  },
  "spacing": { "md": { "$value": { "value": 16, "unit": "px" } } }
}
```

- `$type` and `$description` are read and **ignored**. Nothing is inferred from
  a declared type — see [the naming rule](./naming.md) and the note on numbers
  below.
- `$`-prefixed keys at group level (`$schema`, and so on) are document metadata.
- **Colours and dimensions written as objects are accepted.** The current spec
  writes them that way, and each still describes one CSS value:

  | In the file | In the stylesheet |
  | --- | --- |
  | `{ "value": 0.25, "unit": "rem" }` | `0.25rem` |
  | `{ "value": 0, "unit": "" }` | `0` |
  | `{ "colorSpace": "srgb", "components": [0,0,0] }` | `rgb(0 0 0)` |
  | `{ "colorSpace": "srgb", "components": [0,0,0], "alpha": 0.4 }` | `rgb(0 0 0 / 0.4)` |
  | `{ "colorSpace": "display-p3", "components": [0.35,0.31,0.81] }` | `color(display-p3 0.35 0.31 0.81)` |

  A colour's optional `hex` is ignored: it is not always there, and output whose
  form depended on an optional field would be less predictable than output that
  never uses it.

## 3. Style Dictionary legacy

Recognized by `value` where there is no `$value` anywhere.

```json
{
  "color": {
    "brand": { "value": "#5A4FCF", "type": "color", "comment": "the accent" }
  }
}
```

Once read, this is **indistinguishable** from the DTCG version of the same
catalogue: same validation, same stylesheet, byte for byte. The dialect is an
input shape, never a mode.

A node carrying both `$value` and `value` is refused rather than resolved — the
precedence above would read it as DTCG and quietly ignore the other.

---

## References

A value that is entirely `{path.to.token}` is a reference, and it is emitted as
one:

```json
{ "color": { "brand": { "$value": "#5A4FCF" },
             "text":  { "$value": "{color.brand}" } } }
```

```css
:root {
  --color-brand: #5A4FCF;
  --color-text: var(--color-brand);
}
```

**References are never flattened.** A chain of three emits three `var()`, so
changing a primitive still moves everything that referred to it — which is the
reason to keep tokens in a hierarchy at all.

A value that merely *contains* `{…}` — `1px solid {color.border}` — is refused.
Writing it verbatim would produce syntactically valid CSS that silently does
nothing.

Every reference is checked before anything is written: a target that does not
exist is `ALIAS_DANGLING`, and a loop is `ALIAS_CYCLE`.

## Values are written as they are

A string goes out verbatim, unquoted. A number goes out as its digits.

**No unit is ever invented.** A token whose value is `16` emits `16`, not
`16px`, whatever its `$type` says. If you meant a length, write the unit in the
token — either as `"16px"` or as `{ "value": 16, "unit": "px" }`.

## What is refused

| What | Why |
| --- | --- |
| Composite tokens — typography, shadow, border, gradient, transition, stroke-style | Five CSS properties are not one custom property. Deferred to a version after the first release. |
| Expressions — `{spacing.md} * 2`, `16 * 2`, `roundTo(…)` | Nothing here evaluates anything. Resolve them in Tokens Studio before exporting. `calc()` and `clamp()` are valid CSS and pass through untouched. |
| Units CSS does not have — `dp`, `sp` | A browser ignores the declaration silently. |
| More than one token set in a Tokens Studio export | Merging would mean choosing a winner. |
| `$ref` and resolver manifests | One self-contained file at a time. |
| A directory or a glob as the Token Source | One file at a time. |
| `__proto__`, `constructor`, `prototype` as token keys | Refused outright. |

**A refusal stops the whole document.** One composite token in a file of two
hundred stops the conversion — there is no partial output, because a stylesheet
missing a token while reporting success is worse than no stylesheet.

## The fixtures are the specification

Everything above is proved by files in [`fixtures/`](../fixtures/README.md):
nine that must convert to a stored stylesheet byte for byte, and seventeen that
must fail with a named code. If the documentation and the fixtures ever
disagree, the fixtures are right.
