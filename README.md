# Leanr

A mobile-first strength-training log for recording individual sets and tracking
all-time best weights.

## Live app

[leanr-bg.netlify.app](https://leanr-bg.netlify.app/)

The source repository is deployed through Netlify from the `main` branch.

## Features

- Start an upper-body, lower-body, full-body, or cardio workout
- Log every set with its own weight and rep count
- Automatically calculate personal-best weights by exercise
- Resume an active workout
- Review recent workout activity
- Create and switch between separate user profiles

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
npm run build
```

## Persistence

Workout data is stored in a strongly consistent Netlify Blobs store, partitioned
by profile. The original single-user data is automatically assigned to the first
profile created after upgrading. Profiles are intentionally lightweight and are
not password-protected accounts.
