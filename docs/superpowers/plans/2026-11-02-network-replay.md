# H1 Network Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a D3 circular network replay with evidence, three independent layers and a timeline.
**Architecture:** Buildless HTML/CSS/JavaScript. A pure replay engine consumes the existing tables; D3 owns SVG joins and the timeline. Local JS data and vendored D3 support an offline single-file export.
**Tech Stack:** D3 7.9.0, browser DOM/SVG, Node built-in test runner.
**Spec:** PRODUCT.md and the user's three confirmed choices in this chat.

## Global Constraints
- Twelve fixed clockwise seats, eliminated seats remain visible.
- Relationships reset at day boundaries; take the last eligible current stance per directed pair.
- Conditional, reported, retrospective and ambiguous candidates do not become edges.
- Support/suspicion/vote layers toggle independently.
- Sheriff and exile ballots never accumulate together; missing/self votes stay excluded.
- Identity fields are hidden unless post-game view is enabled; confidence labels remain visible then.
- Do not change the existing research data.

## Review Focus
- Backward scrubbing must reconstruct state rather than retain future edges.
- Final pre-vote snapshots must equal the supplied 94-edge dataset.
- Ballots cannot expose an unreported sheriff vote or self-vote as an edge.
- Disabling all layers or focusing an eliminated player must give an intelligible empty state.
- Keyboard and mobile users must still reach evidence and timeline controls.

### Task 1: Replay model
Files: dist/engine.js, tests/engine.test.cjs, dist/data.js.
Interface: buildFrames(data) → frames; stateAt(data,frames,index) → {frame,edges,out,ballot,notices}; snapshotIndex(frames,day) → index; roleLabel(player,reveal) → label.
- [x] Write tests for the five model-specific requirements above, including all three fixture snapshots.
- [x] Run the tests and see missing replay functions fail.
- [x] Implement pure replay reconstruction and read-only data preparation.
- [x] Run Node tests and confirm all pass.

### Task 2: Interactive interface
Files: dist/index.html, dist/styles.css, dist/app.js.
Consumes Task 1's pure model. Produces accessible circular SVG, evidence inspector, day snapshots, per-layer controls, identity toggle, playback and scrubbing.
- [x] Implement UI using the confirmed design and model interfaces.
- [x] Inspect through browser at desktop and narrow width.
- [ ] Exercise scrubbing, playback, filtering, evidence selection and identity hiding.

### Task 3: Delivery and validation
Files: build-offline.py, README.txt, offline.html; Sites source manifest.
- [x] Export a self-contained HTML page with embedded data, D3, CSS and app code.
- [ ] Run the model suite, syntax checks and browser interaction checks.
- [x] Request one independent whole-change review and fix material findings.
- [ ] Package and publish privately using Sites; deliver verified URL and offline file.

## Execution record
The workspace initially has no Git repository. Work is isolated in the new werewolf-network directory; Sites source synchronization will initialize its repository. No existing analysis files are modified. Execute inline without another confirmation because the user has selected the design choices and requested the build.

Verification: 6 model tests passed, including all 94 supplied snapshot edges. Reviewer found final narrator identity disclosure; regression test failed first and now passes. At 375px the circle aspect-ratio/min-height caused 12px horizontal overflow; an explicit 100% width resolves pageWidth=viewportWidth=375. Browser checks cover player focus, independent layers, empty state, day switches, source jumps, unknown ballot and reveal.

Delivery: self-contained HTML saved to ../outputs/H1_狼人杀互动关系图.html and portable source archive saved beside it. Automatic approval review rejected external Sites upload because specific cloud payload authorization was absent. No source or transcript was uploaded; publishing awaits explicit user authorization. Browser download-event verification was interrupted and is not claimed as complete.
