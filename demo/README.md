# Demo

```bash
npm run demo
```

A local server on loopback with two inputs — a URL and a file picker — that
shows the first 200 lines of the result and offers the whole thing as a
download.

## Why it is a server and not a page

The library is Node-only and writes to disk. Both are decisions in the PRD, not
oversights, so there is no way to run the conversion inside a browser tab. This
server is the thinnest thing that lets a browser drive the real library: it
holds no state, keeps no uploads, and calls the same entry point an application
would.

**Nothing is relaxed to make the demo look better.** The network policy is the
production one — https by default, internal addresses refused — so pointing it
at `http://169.254.169.254/` gets refused here exactly as it would in a build.

## Two kinds of example

**Published files**, fetched over the network exactly as a build would fetch
them. They prove the library against documents nobody here wrote — which is the
lesson `docs/proceso/cero-de-trece.html` records, and the reason nine green
fixtures once hid that thirteen real files all failed.

| Sample | What it shows |
| --- | --- |
| IBM Carbon · colours | Object-form colours and references |
| IBM Carbon · typography | 58 typography tokens expanding into **290 custom properties** |
| Microsoft Fluent · shadows | Stacked shadows from a real elevation scale |
| Shopify Polaris · fonts | Font stacks written as arrays |
| Style Dictionary · legacy | A dialect that never migrated to `$value` |
| Adobe Spectrum · base | **Fails on purpose**: one token measured in `dp` |

**Worked examples**, in [`samples/`](./samples). These are files on disk, shown
next to the stylesheet they produce, so a conversion can be read against its
source instead of taken on faith. Open one, change it, reload.

| File | What it shows |
| --- | --- |
| `01-composites` | Shadow, border, transition, gradient — including stacked and inset shadows, and aliased sub-values staying `var(--…)` |
| `02-tipografia` | A type scale expanding into five properties each, built on primitives it keeps pointing at |
| `03-arrays` | All four `fontFamily` notations found in published files, and easing curves |
| `04-parcial` | Four tokens skipped for four different reasons, while the rest converts |
| `05-sistema` | A small complete system: primitives → semantic → components, chained by reference |
| `06-referencia-rota` | **Fails**: a shadow's colour points nowhere. Sub-references are real graph edges |
| `07-colision` | **Fails**: an expanded name claims a property another token already claimed |

Each file names itself. Its `$description` opens with a title, then `·`, then
what it is for — the server splits there to label the button and caption the
result, so the file is the only place either is written. Adding an example is
dropping a `.json` into `samples/`; there is no list to edit.

Three of the thirteen fail on purpose. A demo that only showed conversions
working would hide half of what makes the library worth using.

## Caveats

It converts whatever it is pointed at, including files on the machine running
it, so it listens on `127.0.0.1` only. It is a demo for the person running it,
not a service. Uploads are capped at 8 MB and written to a temporary directory
that is deleted after every request.
