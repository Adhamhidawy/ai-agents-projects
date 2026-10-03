# Verification

## Checks on the public source copy

Verified October 3, 2026 by Codex on macOS, using Claude Code 2.1.288 and Node.js v26.9.0.

| Check | Result |
| --- | --- |
| `claude plugin validate .` | Passed. |
| `claude plugin test .` | 15 passed, 0 failed. |
| Broken demo test | Expected failure, exit code 1. Actual deliveries 2, expected 1. |
| Broken demo diagnostic | Listeners 1 before reconnect, 2 after; 2 delivered frames. |
| Corrected demo test | 1 passed, 0 failed, exit code 0. |
| Corrected demo diagnostic | Listeners 1 before and after reconnect; 1 delivered frame. |

The six mod source, configuration, state-type and test files are unchanged from the original tested project. The corrected demo's introductory comment was updated to describe the correction; its executable code is unchanged.

The hooks module's SHA-256 is:

```text
e909f653d6f1a28bde03855316332ffa57991c75fb5a75523cb8fc1089d5d0a8
```

## What the runtime tests cover

- Exact command recognition and duration-independent failure signatures.
- Three matching failures, preservation of the third result, and refusal of the fourth attempt before it reaches the tool.
- Counter reset after a passing result or a different failure.
- Unrelated commands, subagents, background runs, denials and unparseable errors.
- Successful Edit paths versus staged or failed edits.
- Repeated session-start handling in the same host.
- Explicit continuation that retains previous attempts.
- UI updates, the Continue button, survey yielding and pane content.
- Structured evidence export.

These tests use controlled tool and API replies in Claude Code's mod runtime. They do not call a live model or certify native terminal rendering.

## Original interactive demonstration

The original project was also exercised in one deliberately staged interactive Claude Code session on October 3, 2026. Codex operated the session with Claude Code 2.1.288, Node.js v26.9.0 and `claude-sonnet-5-5` at low effort.

The prescribed delay edits produced three matching failures. The fourth matching test attempt was refused before execution. The review pane was opened with `/fix-loop`, and the attempt record survived a live reload of the pane layout.

After acknowledgement with `/fix-loop continue`, the supplied diagnostic found the duplicate listener. The explicitly requested cleanup produced a passing test with `retryDelay` still set to 800.

The [saved prompts](demo/prompts.md) reproduce the inputs and relevant operator steps. Raw local session recordings are not part of this repository.

No additional model session was run while preparing this public copy. No time, token or cost savings, natural-loop frequency or autonomous diagnosis were measured.
