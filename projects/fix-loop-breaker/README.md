# Fix Loop Breaker for Claude Code

A mod that makes repeated test failures visible. After three consecutive failures with the same signature, it requests a review pane and refuses the next matching test attempt until you acknowledge the hold.

This is the companion code for Adham Khaled's Claude Code mods article project, built and tested with Codex assistance. The article link will be added after publication.

## What it watches

This prototype watches serial, foreground calls from the main conversation to exactly this command:

```sh
node --test --test-reporter=spec tests/reconnect.test.mjs
```

It compares failing test names and `ERR_*` error codes, ignoring durations. It also records successful Edit/Write file paths observed between test runs.

The record gives you something to review before another retry. The mod does not diagnose the bug or compare the meaning of code changes.

## Requirements

- Claude Code 2.1.287 or later, with mods allowed in your workspace. The recorded build used 2.1.288.
- Node.js for the demo. The recorded demo used v26.9.0.
- An authenticated, interactive Claude Code session for the live demonstration.

The mod has no npm dependencies or separate build step. Claude Code provides the mod runtime and its test kit.

## Validate and test

From the repository root:

```sh
cd projects/fix-loop-breaker
claude plugin validate .
claude plugin test .
```

The suite contains 15 runtime tests. They use controlled tool and API replies, so they check the hook logic, state and UI elements without running a live model.

See [verification details](VERIFICATION.md) for the recorded checks and what they establish.

## Open the actual review pane

Stay in the project folder after running the commands above. Copy the deliberately broken demo into a fresh temporary directory and load the mod there:

```sh
FIX_LOOP_PLUGIN_DIR="$PWD"
FIX_LOOP_DEMO_DIR="$(mktemp -d)"
cp -R demo/baseline/. "$FIX_LOOP_DEMO_DIR/"
cd "$FIX_LOOP_DEMO_DIR"
claude --plugin-dir "$FIX_LOOP_PLUGIN_DIR"
```

Complete the normal startup and workspace trust prompts.

1. Open [demo/prompts.md](demo/prompts.md) in your editor and paste its first user prompt into Claude Code. It deliberately requests three ineffective edits and a fourth test attempt.
2. After the turn finishes, enter `/fix-loop` inside Claude Code.
3. The pane should show `3/3 repeated failures`, three failed attempts and the recorded edited file. Widen the terminal if labels or controls are cropped.
4. Capture the pane before continuing or resetting it.
5. Enter `/fix-loop continue`, then paste the second user prompt to inspect the listener counts, apply the correction and rerun the test.

The first three tests are expected to fail. The fourth matching attempt should be refused before execution. If Claude stops after the third failure, the pane is already ready to inspect; ask for one more exact attempt if you also want to see the refusal.

This is an intentionally staged demonstration. The prompts supply both the ineffective edits and the later diagnostic and correction.

## Commands

Enter these inside the running Claude Code session:

| Command | Effect |
| --- | --- |
| `/fix-loop` | Open the review pane. |
| `/fix-loop continue` | Clear the hold and repetition count while retaining previous attempts. |
| `/fix-loop reset` | Clear the ledger and hold. |
| `/fix-loop export` | Write `fix-loop-evidence.json` in the session's working directory. |

The pane also provides Continue anyway, Reset ledger and Close view buttons.

State survives a hot reload of the mod. It does not persist across clear, resume, branch or another session. Export the record if you need to keep it.

## Compare the broken and corrected programs

You can inspect both versions without a model session. From this project folder, run the broken example:

```sh
cd demo/baseline
node diagnostic.mjs
node --test --test-reporter=spec tests/reconnect.test.mjs
```

The diagnostic reports one listener before reconnect, two afterward and two delivered frames. The test fails because it expects one frame.

Then run the corrected example:

```sh
cd ../fixed
node diagnostic.mjs
node --test --test-reporter=spec tests/reconnect.test.mjs
```

It reports one listener before and after reconnect, one delivered frame and a passing test. The fix removes the old listener in `disconnect()`; changing `retryDelay` is insufficient in this fixture.

## Files

| Path | Purpose |
| --- | --- |
| [.claude-plugin/plugin.json](.claude-plugin/plugin.json) | Plugin identity and authored state-type contract path. |
| [hooks/hooks.json](hooks/hooks.json) | Points to the mod's hooks module. |
| [hooks/fix-loop-breaker.mjs](hooks/fix-loop-breaker.mjs) | Detection, ledger, refusal, commands and UI. |
| [types/index.d.ts](types/index.d.ts) | Declares the session-state shape. |
| [tests/loop.test.ts](tests/loop.test.ts) | The 15 runtime tests. |
| [demo/baseline](demo/baseline) | Deliberately broken receiver and test. |
| [demo/fixed](demo/fixed) | Corrected receiver and test. |
| [demo/prompts.md](demo/prompts.md) | Exact demonstration prompts and operator steps. |

Claude Code generates `.claude-plugin/types/` for the installed runtime. Those declarations are ignored by Git. The checked-in `tsconfig.json` extends that generated configuration.

## Limits

- One configured command and Node's spec-reporter output. Wrappers, extra flags and other runners are outside this version.
- Serial calls from the main conversation. Subagents and background runs are skipped; concurrent calls remain untested.
- Matching test names and error codes do not establish the same cause. Assertion values are not compared.
- File-path records cover successful Edit/Write calls, not every disk change.
- Partial error output can count if it contains a parseable failure and lacks interruption indicators.
- Disabled or failed hooks and unmonitored commands can bypass the hold. This is a workflow aid.
- The experiment does not measure natural loop frequency, time or token savings, or general debugging effectiveness.

## References

- [Getting started with Claude Code mods](https://claude.dev/blog/getting-started-with-claude-code-mods/)
- [Create a mod](https://code.claude.com/docs/en/plugins/mods/create)
- [React to events](https://code.claude.com/docs/en/plugins/mods/events)
- [Test a mod](https://code.claude.com/docs/en/plugins/mods/test)
