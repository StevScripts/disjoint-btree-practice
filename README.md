# CS2 Structure Practice

Static Vite React app for practicing disjoint sets and 2-4 tree insertion/deletion.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Vercel

Import this folder as a Vite project. Vercel should use:

- Build command: `npm run build`
- Output directory: `dist`

## Practice Modes

- Disjoint-set parent arrays after union operations
- Disjoint-set path compression after `findset`
- 2-4 tree insertion with worksheet-style overflow behavior
- 2-4 tree deletion with borrow and merge repairs
- Mixed review with generated problems
