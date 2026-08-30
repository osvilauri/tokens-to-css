# Review — version / reality check

**Verdict:** two real errors, one design claim that does not survive contact with the runtime.

## Critical

**C1 — AD-8 cannot be implemented as written under AD-13 (zero runtime dependencies).**
The spine binds remote fetching to global `fetch` while requiring per-hop resolved-IP validation
against link-local / metadata ranges (PRD §9). Node's global `fetch` never exposes the resolved
address, and pinning the connection to a validated IP requires an `undici` `Agent` / `dispatcher`
— `undici` is not reachable as a `node:` builtin, so this would force a runtime dependency and
break AD-13. Even with `redirect: 'manual'` (which does work in Node's fetch — the 3xx and its
`Location` header are readable), DNS rebinding between check and connect stays open.
**Fix:** implement the adapter on `node:https` with a custom `lookup` that validates the address
and returns it, so the socket connects to the address that was checked. Range checks belong on
`node:net.BlockList`, not regexes. Both are builtins; AD-13 survives.

## High

**H1 — Changesets version is wrong.** The spine pins "Changesets latest 2.x". `@changesets/cli`
is at **3.0.1** (published ~2026-08-21). Asserted from training data, not verified.

## Medium

**M1 — tsdown pinned vaguely.** "latest 0.x" → tsdown is at **0.22.14**. Pin the minor line.

**M2 — TypeScript 7 toolchain compatibility unverified.** TS 7.0 ships the Go-native compiler.
That tsdown 0.22 and Vitest 4.1 both drive TS 7 cleanly is plausible but was not confirmed.
Verify at repo bootstrap; it is a one-command check, not a spine blocker.

## Confirmed current (2026-08-29)

Node 24 Active LTS / 22 Maintenance / 26 Current; TypeScript 7.0.2; Vitest 4.1.11; tsup no longer
actively maintained and pointing users at tsdown.
