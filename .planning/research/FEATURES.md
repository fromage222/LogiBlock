# Feature Landscape

**Domain:** Browser-based cooperative multiplayer puzzle game (tetromino placement, shared grid, turn-based)
**Project:** LogiBlock
**Researched:** 2026-03-01

---

## Table Stakes

Features where absence means the game does not work or the project fails its requirements.

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| Room creation with shareable code | Without this, players cannot find each other. 6-char codes are the established convention (Jackbox, skribbl.io). | Low | Server generates unique code; client displays it prominently. |
| Room join by code | Counterpart to creation. Without it, multiplayer does not exist. | Low | Validate: code exists, lobby not full, game not started. |
| Lobby / waiting room | Players need to see who joined before starting. Prevents mid-join race conditions. | Low | Show player list; "Start" button only for room creator. |
| Room host concept | Someone must trigger game start. First player to create is host. | Low | Display host badge in lobby. |
| Player list visible to all | Players need to know who is in the game. | Low | Update live as players join/leave. |
| Shared grid display | Core game object. Every player must see the same grid state. | Medium | Server owns state; clients render from it. Grid is single source of truth. |
| Shared piece bank display | Players choose from the same pool. Must be synchronized. | Medium | Piece disappears from bank when placed on grid. |
| Anchor pieces pre-placed | Grid initialized with 1-2 fixed pieces that define the puzzle. | Low | Load from puzzle JSON; visually locked/distinct from placeable pieces. |
| Active player indicator | Every player must clearly know whose turn it is. | Low | Highlight active player; dim board for non-active players. |
| Turn progression | After an action, turn advances to next player. | Low | Circular order. Server controls turn index. |
| Place piece action (bank → grid) | The primary game action. | High | Client sends: piece ID, target cell, rotation. Server validates against solution. |
| Return piece action (grid → bank) | Collaborative correction — required per spec. | Medium | Server removes from grid, adds back to bank, advances turn. |
| Server-side move validation | The defining technical requirement. Every move checked against held solution. | High | Server holds solution map. Validate: target cells match solution, cells empty, correct player's turn. Solution never sent to client. |
| Win condition detection | Game must have an end state. | Medium | After every successful placement: check all cells filled correctly. Emit win event to all. |
| Win screen | Players need feedback they won. | Low | Display win message. Offer "Back to lobby." |
| Real-time state sync | When one player acts, all others see the update immediately. | High | Server emits updated state after every validated action. All clients re-render. |
| Disconnect handling | If a player disconnects, game must not freeze. | Medium | Skip disconnected player's turn. Advance turn if it was theirs. Remove from player list. |
| Invalid move feedback | If placement is invalid, acting player must know why. | Low | Server responds with error reason. Client shows inline message. |
| In-memory game state per lobby | State must be authoritative and survive between turns. | Medium | Server-side `Map<roomCode, GameState>`. No database persistence needed. |

---

## Differentiators

Not required but would elevate the project above minimum.

| Feature | Value | Complexity | Notes |
|---------|-------|------------|-------|
| Player color coding | Each player's placed pieces shown in their color. Makes board readable. | Low | Assign 4 colors at join. Store in grid cell metadata. |
| Piece ghost / preview on hover | Shows where piece would land before confirming. Reduces frustration. | Medium | Client-side only. No server call until confirmed. |
| Multiple puzzle selection | Host can choose from available puzzles. Shows JSON system is generic. | Low | Read all JSONs from `puzzles/` at startup. Expose list to lobby. |
| Move history log | "Player 2 placed L-shape at 3,4." Helps coordination. | Low | Append to in-memory log per lobby. Scrollable sidebar. |
| Piece rotation UI | 90-degree rotation button. Needed if puzzles use rotated placements. | Medium | Client sends rotation with placement. Server validates rotated form. |
| Puzzle completion time | Show how long team took to solve. Good for demos. | Low | Store `startedAt` in room state. Calculate delta on win. |
| Pass turn action | Player explicitly passes without acting. | Low | Server advances turn, logs it. No validation needed. |
| Animated piece placement | CSS transition when piece lands. Polished feel. | Low | Pure CSS. No logic changes. |

---

## Anti-Features

Things to deliberately NOT build.

| Anti-Feature | Why Avoid |
|--------------|-----------|
| User accounts / authentication | Out of scope. Adds OAuth, session storage, password handling — none demonstrates the core topic. |
| Persistent database | State doesn't need to survive server restart for a demo. Database adds deployment complexity. |
| Leaderboards / statistics | Requires accounts and database — both excluded. |
| Mobile / touch support | Desktop browser is the target. Touch drag-and-drop is a separate engineering problem. |
| In-game puzzle editor | A full sub-application. Distracts entirely from the multiplayer core. |
| Spectator mode | Adds a third client role, multiplies state management complexity. |
| Chat system | Move history log is sufficient for coordination. |
| AI / computer player | No requirement, significant complexity, no multiplayer demonstration value. |
| WebRTC / peer-to-peer | Would undermine server-authoritative validation, which is the core concept. State must flow through the server. |

---

## Feature Dependencies

```
Room creation
  └── Room join by code
      └── Lobby + player list
          └── Host starts game → [puzzle selection]
              └── Grid initialization (anchors pre-placed)
                  └── Shared piece bank
                      ├── Active player indicator
                      │   └── Turn progression
                      │       ├── Place piece → server validation → win detection → win screen
                      │       └── Return piece → server validation
                      └── Disconnect handling (skip turn)

Real-time state sync — cross-cutting concern, runs alongside ALL actions
Invalid move feedback — required as soon as place action exists
Player color coding — requires player list
Ghost preview — requires grid display; client-only, no server dependency
Move history — requires place/return actions; emits log entry alongside state
```

---

## MVP Priority

**Must ship (table stakes — project fails without these):**
1. Room creation + join by code
2. Lobby with player list + host-controlled start
3. Puzzle loading from JSON (≥1 puzzle), anchor pieces pre-placed
4. Shared grid + piece bank display
5. Active player indicator + turn progression
6. Place piece action with server-side validation
7. Return piece action
8. Real-time state broadcast via Socket.IO
9. Win condition detection + win screen
10. Disconnect handling (skip turn minimum)
11. Invalid move feedback

**Second priority (elevates grade):**
1. Player color coding — low effort, high visual impact
2. Multiple puzzle selection — shows JSON system is generic
3. Piece ghost/preview — demonstrates client-side polish
4. Move history log — makes event streaming visible to graders

**Defer or cut:**
- Turn timer — medium complexity; add only if time permits
- Piece rotation — decide based on whether puzzle JSONs use it
- Reconnect support — high complexity; not required for demo
