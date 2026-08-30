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

Five one-click examples from published design systems, and **one of them
fails on purpose**. IBM Carbon's typography file contains composite tokens,
which this version refuses by design; a demo that only shows the happy path
hides half of what makes the library worth using.

## Caveats

It converts whatever it is pointed at, including files on the machine running
it, so it listens on `127.0.0.1` only. It is a demo for the person running it,
not a service. Uploads are capped at 8 MB and written to a temporary directory
that is deleted after every request.
