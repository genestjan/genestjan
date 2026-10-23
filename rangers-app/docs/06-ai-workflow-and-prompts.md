# 06. AI workflow and prompts

How to run the build with two kinds of Claude Code session:

- **Planner**: your stronger model. Thinks, specifies, reviews. Does not write feature code.
- **Builder**: your faster model. Writes code and tests exactly to the spec.

Switch models in a Claude Code session with `/model`. Start a fresh session for each prompt below unless it says "same session"; fresh sessions read `CLAUDE.md` and stay focused.

## 1. The loop (one phase at a time)

```
 You fill decisions.md ─► P2 Planner writes spec ─► you read it, answer questions
        ▲                                                   │
        │                                                   ▼
 F1 field-test fixes ◄─ you test on real devices ◄─ R1 Planner reviews PR ◄─ B1 Builder builds
```

Rules that keep it working:
1. **One phase per branch and pull request.** Big phases may be split by the spec into parts A, B, C, each its own pull request.
2. **The spec is the contract.** If the Builder thinks the spec is wrong, it stops and asks; it does not improvise.
3. **Tests before merge.** No green CI, no merge.
4. **You test on a real phone before merging**, using the handoff file.
5. **Write things down.** Decisions go in `docs/decisions.md`, architecture choices in `docs/adr/`, field tests in `docs/field-tests/`.

## 2. Prompts

Copy each prompt as is. Replace anything in angle brackets.

### P1. Planner kickoff (run once, at the start)

```
You are the Planner for the Rangers App. Use plan mode: read and write docs only, no feature code.

1. Read README.md, CLAUDE.md, every file in docs/, and docs/decisions.md in full.
2. Check the plan for contradictions, gaps and risky assumptions. List them, each with a recommended fix.
3. List every question you need me (Jan) to answer before Phase 0 and Phase 1, with your recommended default. Add them to docs/decisions.md under "Open questions" without deleting my answers.
4. Write the ADRs listed in docs/04-technical-blueprint.md section 14 as docs/adr/0001-*.md to 0008-*.md (context, decision, consequences, alternatives).
5. Write docs/specs/phase-0.md and docs/specs/phase-1.md using the spec template in docs/06-ai-workflow-and-prompts.md section 3. Make each task small enough to finish and test in one sitting, name the files it touches, and list its tests.
6. Do not change the meaning of docs/03-coaching-playbook.md. Suggest playbook changes as a list for Coach James instead.
7. Finish with a short summary: what you wrote, the top 5 risks, and what I must do before the Builder starts.
Commit the docs on a branch named planning/phase-0-1 and open a pull request.
```

### P2. Planner: write the next phase spec

```
You are the Planner for the Rangers App. Use plan mode.

Write docs/specs/phase-<N>.md for Phase <N> in docs/05-build-roadmap.md.
Inputs to read first: README.md, CLAUDE.md, docs/02 to docs/05, docs/decisions.md, the latest files in docs/field-tests/, and docs/specs/phase-<N-1>-handoff.md.
Use the spec template in docs/06-ai-workflow-and-prompts.md section 3.
Adjust scope based on what the field tests taught us; say what you changed and why.
Split the phase into parts (A, B, C) if it is more than about 10 tasks.
List questions for me with recommended defaults. Commit on branch planning/phase-<N> and open a pull request.
```

### B1. Builder: build a phase (or part)

```
You are the Builder for the Rangers App.

Read CLAUDE.md, then docs/specs/phase-<N>.md (part <A/B/C> only, if split), then the docs it links to.
Build exactly that scope on a branch named phase-<N><part>. Work task by task in the spec's order:
- write or update tests first for any logic in src/lib/,
- implement,
- run npm run typecheck, npm run lint, npm test, and the Playwright tests the spec names,
- commit with a clear message after each task.
If the spec is unclear or seems wrong, stop and ask me; do not guess.
Never use real children's names; use the demo team.
When done, write docs/specs/phase-<N>-handoff.md (what was built, how to test it on a real phone step by step, known gaps, decisions needed), push, and open a pull request with a summary and the test results.
```

### R1. Planner: review a pull request

```
You are the Planner reviewing pull request <link or number> for the Rangers App.

Check it against docs/specs/phase-<N>.md and CLAUDE.md:
1. Scope: anything missing, anything extra?
2. Non-negotiables in CLAUDE.md: children's data, RLS and pgTAP tests, secrets, safety logic, offline behaviour, touch targets.
3. Correctness of the logic in src/lib/ against the blueprint (test vectors, properties).
4. Simplicity: anything that could be removed or made plainer?
5. Would a volunteer coach on a cheap Android phone at a sunny pitch manage this screen in under a minute?
Write findings as a numbered list: Must fix, Should fix, Nice to have. Post them as a pull request review. Do not change code yourself.
```

Then, in the **Builder** session (same session as B1 is fine):

```
Fix every "Must fix" and "Should fix" item from the review on pull request <link>. Reply on each review thread with what you changed. Re-run all checks and push.
```

### F1. Turn a field test into fixes

```
You are the Planner. Read docs/field-tests/<date>.md and the current code.
For each problem the coaches had, find the cause and write a small fix spec in docs/specs/fix-<date>.md: problem, cause, change, test, how I will check it at the next match.
Rank them by how much they hurt on match day. Keep the list short; drop anything that is a preference rather than a problem, and say so.
Open a pull request with the fix spec. The Builder will implement it with prompt B1 using this file as the spec.
```

### S1. Security and privacy review (before Phase 2 goes live, and after any schema change)

```
You are the Planner doing a security and privacy review of the Rangers App. Use plan mode.
1. Read every migration in supabase/migrations/ and every pgTAP test in supabase/tests/.
2. For every table, write down who can select, insert, update and delete, and compare with docs/04-technical-blueprint.md section 7. List any gap.
3. Check helper functions are security definer with an empty search_path and cannot be abused.
4. Search the frontend for secrets, service keys, console logging of personal data, and third-party scripts.
5. Check invite redemption, uploads, storage policies and retention jobs.
6. Write missing pgTAP tests as a list for the Builder.
Report as Must fix / Should fix. Do not change code.
```

### C1. Draft coaching content for coach review

```
You are the Builder. Draft drill write-ups for drills <D01 to D10> from docs/03-coaching-playbook.md section 5, in the exact format of the two examples there (Setup, How to play, three Coaching points, Easier, Harder), plus a BoardDoc diagram of 1 to 3 steps for each.
Keep language plain and short. Use only standard, widely used grassroots drills; do not invent unusual rules.
Save to src/content/drills.json with reviewed: false. Generate a printable review page at /content-review so Coach James can read and approve them on a phone.
```

### H1. When the Builder is stuck or CI is red

```
CI is failing on pull request <link> (or: this is not working: <describe>).
Reproduce the failure locally first and show me the exact error. Find the root cause; do not skip, disable or weaken any test. Make the smallest fix, re-run every check, and explain the cause in one paragraph in the pull request.
```

## 3. Phase spec template (the Planner fills this in)

```markdown
# Phase N: <name>  (part A/B/C if split)

## Goal
One paragraph: what a coach or parent can do after this phase.

## In scope
- ...

## Out of scope (and where it goes instead)
- ...

## User stories
- As a <coach/parent/admin>, I want ..., so that ...

## Screens
For each screen: purpose, entry point, layout in words (top to bottom), every control and what it does, empty state, offline state, error state.

## Data
- Dexie tables and versions changed
- SQL migrations (tables, columns, indexes, policies, helper functions)
- Content files and their zod schemas

## Logic
Function signatures in src/lib/ with inputs, outputs, rules, edge cases and test vectors.

## Tasks (in order)
1. <task>. Files: ... Tests: ... Done when: ...

## Acceptance tests
Playwright scenarios (viewport, steps, expected result), pgTAP cases, unit tests.

## Manual test script for Jan
Step-by-step on a real phone, including airplane mode where relevant.

## Risks and open questions
Each with a recommended default.
```

## 4. Handoff template (the Builder fills this in)

```markdown
# Phase N handoff

## Built
- ...

## How to test on a real phone
1. ...

## Not built / known gaps
- ...

## Decisions needed from Jan
- ...

## Notes for the Planner
- Anything the next spec should know.
```

## 5. Tips that save evenings

- Keep sessions short and single-purpose. If a session gets long or confused, start a new one with the same prompt; the docs carry the memory.
- Ask the Builder to show a screenshot from Playwright at the TV size for any board or slide change.
- Put real coach words into the field-test files. "Kim couldn't find the sub button with sweaty hands" is worth more than "UX issue".
- Never paste real children's data into a prompt. Use the demo team.
- If a dependency, API or limit in this plan has changed by the time you build, the Planner records it in an ADR and updates the blueprint. The plan is a starting point, not a law.
