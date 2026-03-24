---
created: 2026-03-24T08:09:17.329Z
title: Erstes richtiges Level bauen
area: general
files:
  - puzzles/puzzle_01.json
  - puzzles/puzzle_02.json
  - puzzles/puzzle_v11.json
---

## Problem

Die vorhandenen Puzzles (`puzzle_01.json`, `puzzle_02.json`, `puzzle_v11.json`) sind
Test-Puzzles ohne finales Design. Es fehlt ein echtes, durchdachtes Level das als
erstes "richtiges" Spielerlebnis dienen soll.

## Solution

Ein neues Puzzle-JSON nach dem bestehenden Schema entwerfen:
- Passendes Grid-Layout und Größe festlegen
- Anker-Shapes und bewegliche Teile definieren
- Lösung (solution-Array) korrekt hinterlegen
- Validierung via `validatePuzzleSchema` sicherstellen
- Als `puzzle_level01.json` o.ä. in `/puzzles/` ablegen
