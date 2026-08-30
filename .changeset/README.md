# Changesets

Every pull request that changes behaviour adds a changeset describing its
version impact. CI checks for one.

```bash
npx changeset
```

For a change with no version impact — tests, docs, an internal refactor — say so
explicitly rather than skipping the step:

```bash
npx changeset --empty
```

**Read this before choosing `major`.** The public surface of this package is
larger than its function signature. A major bump is required for any change to:

- an emitted custom-property name (the naming rule, FR-9)
- a failure code, including renaming or merging one (AD-4)
- the default output path or filename
- a removal from the Format Allowlist
- **an existing golden file in `fixtures/`** — a golden changing means emitted
  output changed, which is the naming contract changing (AD-17)

A *new* fixture's first golden is not a breaking change.
