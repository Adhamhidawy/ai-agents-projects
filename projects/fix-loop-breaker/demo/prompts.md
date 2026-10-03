# Controlled demonstration prompts

Run these in the fresh demo copy described in the [project README](../README.md). The sequence deliberately creates repeated failures; it does not measure naturally occurring debugging loops.

## Optional system prompt from the recorded experiment

```text
You are a coding assistant running a controlled local mod integration demonstration. Follow the user steps in order. Work only in the current fixture directory. Do not delegate or access external services. Report observed results accurately. This artificial sequence is not evidence of naturally occurring debugging loops.
```

## First user prompt

Paste this into Claude Code after launching the broken demo with the mod loaded.

```text
This is a deliberately staged integration test of Fix Loop Breaker, not a real debugging attempt. Work only in this fixture directory. Read receiver.mjs. Using Edit, change this.retryDelay from 100 to 200, then run exactly: node --test --test-reporter=spec tests/reconnect.test.mjs. Change 200 to 400 and run the exact same test command. Change 400 to 800 and run it a third time. Then attempt the exact same test command a fourth time to check that the mod refuses the retry. Keep all calls serial; do not combine commands or use wrappers/background jobs. Do not fix the underlying listener bug, do not reset or continue the mod, and do not bypass its refusal. Stop after the fourth attempt and report only what you observed.
```

## Your steps between prompts

1. Enter `/fix-loop` to open the review pane.
2. Inspect or capture the three failures and controls.
3. Optionally enter `/fix-loop export` to save the local ledger.
4. Enter `/fix-loop continue` to acknowledge the hold.

The original experiment also changed the pane layout while the session stayed open and checked that the ledger survived hot reload. That extra step is unnecessary for reproducing the retry hold.

## Second user prompt

Paste this after acknowledging the hold.

```text
I have acknowledged the retry hold with /fix-loop continue. Now run exactly node diagnostic.mjs and report the listener counts before and after reconnect. Read receiver.mjs, use Edit to fix disconnect so it removes this.onFrame from the bus, then run exactly node --test --test-reporter=spec tests/reconnect.test.mjs. Leave retryDelay at 800 to show that correcting the listener lifecycle is sufficient in this fixture. Keep tool calls serial, work only here, and report observed diagnostic and test results.
```
