---
created: 2026-03-24T08:09:17.329Z
title: Fix npm run dev watch restart loop
area: tooling
files:
  - server/package.json
  - server/src/server.js
---

## Problem

`npm run dev` uses `node --watch src/server.js` which causes an infinite restart loop.
Node's `--watch` monitors all required files including `express.static` paths, so when
the client directory (`../../client`) triggers a file-watch event, the server restarts —
which then triggers another event, causing a continuous restart loop.

## Solution

Limit watch scope with `--watch-path=src` flag so only the `src/` directory is watched,
or replace `--watch` with `nodemon` configured to ignore the client directory:

Option A: `node --watch-path=src src/server.js`
Option B: `nodemon --watch src src/server.js`
