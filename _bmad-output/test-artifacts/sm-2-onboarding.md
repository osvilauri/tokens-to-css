---
metric: SM-2
target: the five steps complete in under 15 minutes
status: not yet measured
---

# SM-2 — timing the fifteen minutes

The PRD claims a new developer reaches a working stylesheet in under fifteen
minutes. Nobody has checked. This is how to check it, and where the answer goes.

Everything else in this project is verified by a machine. This one cannot be:
the thing being measured is whether a person who has never seen it can follow
the page without help, and there is no test for that.

## Before the session

**Pick the right person.** Someone who writes frontend or design-system code and
has **never seen this repository**. Not you, and not anyone who has watched you
work on it. If they already know what a Token Source is because you told them,
the measurement is gone.

**Build the tarball.** The package is not published yet, so step 1 installs from
a file. It installs exactly the way the published one will.

```bash
npm pack
# → tokens-to-css-0.0.0.tgz
```

Send them the tarball and one link: [`docs/getting-started.md`](../../docs/getting-started.md).
Nothing else. No repository, no explanation, no "by the way".

Their step 1 becomes `npm i -D ./tokens-to-css-0.0.0.tgz` instead of
`npm i -D tokens-to-css`. Note it and move on — a local path is marginally
slower than the registry, so the measurement is conservative.

## During

**Start the clock when they open the page. Stop it when they read the error in
step 5 out loud.**

Sit where you can see the screen and say nothing. That part is harder than it
sounds, and it is the whole method: **the moment you help, that step has
failed.** Write down what they were stuck on instead — that sentence is worth
more than the total.

Record each step as it completes, so a failure lands somewhere specific:

| Step | Done at | Notes |
| --- | --- | --- |
| 1 · install | | |
| 2 · token file in place | | |
| 3 · the three lines written | | |
| 4 · stylesheet exists and looks right | | |
| 5 · error read and understood | | |

A step **fails** if they had to ask you, open the library's source, or search the
internet for something the page should have said. Any of those is a documentation
defect with an address, which is more useful than a number.

## The two questions worth asking afterwards

Ask them after the clock stops, not during:

1. **"At any point, did you expect something different from what happened?"**
   Surprises are where the naming rule and the fail-closed behaviour bite.
2. **"Would you have known what to do next if that error had been about your own
   file?"** That is SM-3, and it is free to ask while they are still here.

## Recording the result

Fill in the frontmatter of this file — `status`, the date, the person, the total —
and add the per-step table below. Then:

- **Under fifteen minutes, no step failed** → SM-2 passes. Record it in
  `docs/getting-started.md` so a future regression in onboarding is visible
  rather than argued about.
- **Over fifteen minutes, or a step failed** → the fix is the page, not the
  target. Note which step, change it, and time it again with a different person.
  A second attempt with the same person measures their memory, not the docs.

## The measurement

> Not yet taken.

<!--
When it is, replace the line above with:

**Timed 2026-…-… by Osvaldo Morgan. Participant: …. Total: … minutes.**

| Step | Elapsed | Passed | Notes |
| --- | --- | --- | --- |
| 1 · install | | | |
| 2 · token file | | | |
| 3 · the wrapper | | | |
| 4 · verify | | | |
| 5 · read the error | | | |
-->

## What is already known

The mechanical half is verified in CI, so the session is not spent finding
broken instructions:

- The three-line example on the page is **extracted from the page and executed**,
  not retyped into a test.
- The stylesheet the page shows in step 4 is compared byte for byte against what
  the library actually produces.
- The failure in step 5 is triggered for real, and the message is checked to
  contain what the page promises — including that the previous stylesheet
  survives.
- A full rehearsal has been run: `npm pack`, install into an empty project, the
  three lines, the expected output. It works.

What remains untested is the only thing that matters here: whether the page
makes sense to someone who is not us.
