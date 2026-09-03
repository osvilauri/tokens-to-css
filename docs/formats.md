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
- **Font families and easing curves written as arrays are accepted**, on the same
  reasoning: an array of names and four numbers are one CSS value each.

  | In the file | In the stylesheet |
  | --- | --- |
  | `["Monaco", "Consolas", "monospace"]` | `Monaco, Consolas, monospace` |
  | `["Monaco", "Lucida Console"]` | `Monaco, "Lucida Console"` |
  | `["SF Pro"]` | `"SF Pro"` |
  | `[0.2, 0, 0, 1]` | `cubic-bezier(0.2, 0, 0, 1)` |

  A family name is quoted only when it needs to be — more than one word, a
  leading digit, or a collision with a CSS-wide keyword. **A generic family is
  never quoted**, because `"sans-serif"` in quotes is the name of a font that
  does not exist rather than the generic family.

  An entry that already contains a comma or a quote is written out untouched. It
  is a whole stack rather than one name, which is what Microsoft Fluent and
  GitHub Primer both publish, and quoting it would produce one bogus font name.

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

## Composite tokens

**Shadow, border, transition and gradient become one custom property each.** The
component order below is part of the public contract: changing it is a major
version.

| Type | Emitted as | Example |
| --- | --- | --- |
| shadow | `offsetX offsetY blur spread color`, `inset` in front when true | `0px 2px 6px 0px rgb(0 0 0 / 0.15)` |
| border | `width style color` | `2px solid var(--color-focus)` |
| transition | `duration timingFunction delay` | `200ms cubic-bezier(0.2, 0, 0, 1) 0ms` |
| gradient | the stops, no axis | `var(--color-focus) 0%, #FBFAFD 100%` |

A list of shadows joins with `, ` and stays one value.

**An aliased sub-value stays an alias.** A shadow built on `{color.shadow}`
emits `var(--color-shadow)` inside the larger value, so the shadow still moves
when the colour does.

**Two of them are deliberately partial**, because the token does not say the
whole thing. A transition never says *which* property it animates, and a DTCG
gradient is stops with no direction — so you supply the missing part:

```css
.panel { transition: opacity var(--motion-emphasized); }
.hero  { background: linear-gradient(to right, var(--gradient-hero)); }
```

Inventing `to bottom`, or a property name, would be putting words in the token's
mouth.

**Typography and object-form stroke styles expand**, because they describe more
than one CSS property. Each sub-value becomes its own custom property, named by
appending the property it feeds:

```css
  --type-body-font-family: var(--font-sans);
  --type-body-font-size: 0.875rem;
  --type-body-font-weight: 400;
  --type-body-letter-spacing: 0.16px;
  --type-body-line-height: 1.42857;
```

| Sub-property | Suffix |
| --- | --- |
| `fontFamily` | `-font-family` |
| `fontSize` | `-font-size` |
| `fontWeight` | `-font-weight` |
| `letterSpacing` | `-letter-spacing` |
| `lineHeight` | `-line-height` |
| `dashArray` | `-dash-array` |
| `lineCap` | `-line-cap` |

The suffix is the CSS property the sub-value feeds, so the token is spelled the
way the declaration that uses it is spelled. These suffixes are public contract.

**The `font` shorthand is never emitted**, not even as an extra convenience
property: used alone it drops `letter-spacing` in silence.

A `fontWeight` written as a word is translated through the spec's closed table
(`thin`=100 … `ultra-black`=950). A word outside it skips the token, because
`font-weight: regular` is invalid CSS a browser ignores without saying so.

A `lineHeight` with no unit is emitted with no unit: the unitless number
inherits as a ratio rather than as a length, so adding one would change what it
does.

## What is skipped

| What | Why |
| --- | --- |
| A composite missing a sub-property the spec marks required — a shadow with no `spread`, a transition with no `delay` | Defaulting it would be this product's first inference. The message names which one is absent. |
| A border whose `style` is an object | `dashArray` is SVG geometry a CSS border cannot carry. The spec permits a "closest approximation"; approximating in silence is what this product does not do. |

**A skipped token does not stop the document.** The rest of the file converts,
and the omission is reported twice: in `skipped` on the result, and in a comment
above `:root` in the stylesheet itself — so a token that stopped being emitted
shows up in the diff of your next pull request.

```css
/* 1 token was skipped:
 *   token "type.heading" has an object as its value, but this version writes one custom property per scalar token
 */
:root {
  --color-text: #161616;
```

If **every** token is skipped, that is a failure (`NOTHING_EMITTED`), not an
empty stylesheet. And a reference pointing at a skipped token is a dangling
reference, which still fails the whole document — skipping cannot quietly hollow
out a token that survived.

## What is refused

| What | Why |
| --- | --- |
| Expressions — `{spacing.md} * 2`, `16 * 2`, `roundTo(…)` | Nothing here evaluates anything. Resolve them in Tokens Studio before exporting. `calc()` and `clamp()` are valid CSS and pass through untouched. |
| Units CSS does not have — `dp`, `sp` | A browser ignores the declaration silently. |
| More than one token set in a Tokens Studio export | Merging would mean choosing a winner. |
| `$ref` and resolver manifests | One self-contained file at a time. |
| A directory or a glob as the Token Source | One file at a time. |
| `__proto__`, `constructor`, `prototype` as token keys | Refused outright. |

**A refusal stops the whole document.** Unlike a skip, everything in the table
above says the file is not what it appears to be, and there is no partial answer
to give: no stylesheet is written at all, and an existing one is left untouched.

## The fixtures are the specification

Everything above is proved by files in [`fixtures/`](../fixtures/README.md):
twelve that must convert to a stored stylesheet byte for byte, seventeen that
must fail with a named code, and three that must convert while leaving named
tokens out. If the documentation and the fixtures ever disagree, the fixtures are
right.
