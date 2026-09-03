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

## The samples

Seven one-click examples, chosen so that between them they show every outcome
the library has.

| Sample | What it shows |
| --- | --- |
| IBM Carbon · colours | The ordinary case: object-form colours and references |
| IBM Carbon · typography | 58 typography tokens expanding into **290 custom properties** |
| Microsoft Fluent · shadows | Composites that fit one value, including stacked shadows |
| Shopify Polaris · fonts | Font stacks written as arrays, quoted only where they must be |
| Style Dictionary · legacy | A dialect that never migrated to `$value` |
| Partial conversion | A document that converts **while leaving a token out** |
| Adobe Spectrum · base | **Fails on purpose** |

Two of those earn their place by not being the happy path.

**Partial conversion** is the one case with no published file to point at, so
the document is written into the page itself: its typography is missing
`letterSpacing`, which the spec marks required — the shape GitHub Primer
publishes. It converts, minus that token, and the demo shows what was left out
and why, next to the comment block the stylesheet itself carries.

**Adobe Spectrum's base file** fails, and is here for that. It contains one
token measured in `dp`, an Android unit; emitting it would produce a
declaration a browser ignores in silence. A demo that only showed conversions
working would hide half of what makes the library worth using.

## Caveats

It converts whatever it is pointed at, including files on the machine running
it, so it listens on `127.0.0.1` only. It is a demo for the person running it,
not a service. Uploads are capped at 8 MB and written to a temporary directory
that is deleted after every request.
