# Setmark / Leanr

A mobile-first strength-training log for recording individual sets and tracking
all-time best weights.

## Live app

[leanr-bg.netlify.app](https://leanr-bg.netlify.app/)

The source repository is deployed through Netlify from the `main` branch.

## Features

- Start an upper- or lower-body workout
- Log every set with its own weight and rep count
- Automatically calculate personal-best weights by exercise
- Resume an active workout
- Review recent workout activity

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm run build
```

## Persistence

Workout data is stored in a strongly consistent, site-wide Netlify Blobs store.
It persists across visits and deployments without a separate database account
or connection string.
