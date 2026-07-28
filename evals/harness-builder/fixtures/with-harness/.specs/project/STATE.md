# STATE — orders-api

## Lessons

- **The agent keeps re-adding the `src/lib/index.ts` barrel file** after it was
  deleted twice (2026-05-02, 2026-06-18). It re-exports everything and defeats
  tree-shaking; the convention is to import from the concrete module path.
- Coverage runs but nothing gates on it.
