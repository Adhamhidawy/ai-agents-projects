// Narrow MVP: serial main-loop calls of one explicit Node spec-reporter test.
// A repeated test signature is an observation, not a root-cause diagnosis.
const REF = { plugin: 'fix-loop-breaker', key: 'loop' };
export const TEST_COMMAND = 'node --test --test-reporter=spec tests/reconnect.test.mjs';
export const THRESHOLD = 3;
const LIMIT = 12;
const empty = () => ({ signature: '', consecutive: 0, blocked: false, attempts: [], pendingFiles: [] });

export function supported(command) {
  // Intentionally reject wrappers, redirection, compound commands and flags.
  return String(command ?? '').trim().replace(/\s+/g, ' ') === TEST_COMMAND;
}

export function failureSignature(text) {
  const clean = String(text ?? '').replace(/\x1b\[[0-9;]*m/g, '');
  const names = [...new Set([...clean.matchAll(/^\s*[✖×]\s+(.+?)\s+\([\d.]+ms\)\s*$/gm)].map(m => m[1]))].sort();
  const codes = [...new Set([...clean.matchAll(/\b(ERR_[A-Z_]+)\b/g)].map(m => m[1]))].sort();
  if (!names.length) return null; // Tool denial/interruption is not a test failure.
  return { key: JSON.stringify([names, codes]), summary: names.join('; ') };
}

async function read($) { return (await $.state.get(REF)).value ?? empty(); }
async function save($, value) { await $.state.set(REF, value); }
async function resume($, reset = false) {
  const state = reset ? empty() : { ...await read($), signature: '', consecutive: 0, blocked: false, pendingFiles: [] };
  await save($, state);
  await $.ui.close({ id: 'fix-loop-breaker' });
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e);
    if (!(await $.state.get(REF)).value) await save($, empty());
    await $.command.register({ name: 'fix-loop', description: 'Review repeated test failures; continue, reset, or export evidence' });
    return result;
  });

  on('command.run', { command: 'fix-loop' }, async ($, e) => {
    const action = e.args.trim();
    if (action === 'continue' || action === 'reset') {
      await resume($, action === 'reset');
      return { text: action === 'reset' ? 'Fix Loop Breaker reset.' : 'Further test attempts allowed; previous evidence retained.' };
    }
    const state = await read($);
    if (action === 'export') {
      await $.fs.write('fix-loop-evidence.json', JSON.stringify({ schemaVersion: 1, threshold: THRESHOLD, supportedCommand: TEST_COMMAND, ...state }, null, 2) + '\n');
      return { text: 'Saved fix-loop-evidence.json in the session working directory.' };
    }
    if (action) return { text: 'Usage: /fix-loop [continue|reset|export]' };
    await $.ui.open({ id: 'fix-loop-breaker', title: 'Fix Loop Breaker', focus: true, rows: 16 });
    return { text: `${state.consecutive}/${THRESHOLD} repeated failures. ${state.blocked ? 'Retry held until acknowledged.' : 'Monitoring.'}` };
  });

  on('tool.call', async ($, e, next) => {
    // Subagents and background commands are outside this MVP's coverage.
    if (e.agentId) return next(e);
    const isTest = e.tool === 'Bash' && supported(e.command) && !e.run_in_background;
    const before = isTest ? await read($) : null;
    if (isTest && before.blocked) {
      return { deny: `Fix Loop Breaker: ${THRESHOLD} consecutive failures with the same test signature. Pause and run a different diagnostic. The user can allow another attempt with /fix-loop continue. This mod has not diagnosed the cause.` };
    }
    const result = await next(e);
    if (result.deny) return result;
    if ((e.tool === 'Edit' || e.tool === 'Write') && !result.isError && !result.result?.staged) {
      const state = await read($);
      await save($, { ...state, pendingFiles: [...new Set([...state.pendingFiles, e.file_path])].filter(Boolean).slice(-20) });
    }
    if (!isTest || result.result?.interrupted || result.result?.backgroundTaskId) return result;
    const state = await read($);
    const signature = result.isError ? failureSignature(result.text) : null;
    if (result.isError && !signature) return result;
    const consecutive = signature ? (state.signature === signature.key ? state.consecutive + 1 : 1) : 0;
    const blocked = consecutive >= THRESHOLD;
    const attempt = { command: TEST_COMMAND, signature: signature?.key ?? '', summary: signature?.summary ?? 'Test command passed', files: state.pendingFiles, at: await $.clock.now(), outcome: signature ? 'failed' : 'passed' };
    await save($, { signature: signature?.key ?? '', consecutive, blocked, attempts: [...state.attempts, attempt].slice(-LIMIT), pendingFiles: [] });
    if (!blocked) return result;
    await $.ui.open({ id: 'fix-loop-breaker', title: 'Fix Loop Breaker', rows: 16 });
    // Preserve the original result/ref/text; add an explicit model reminder.
    return { ...result, context: [...(result.context ?? []), `Fix Loop Breaker observed ${consecutive} consecutive failures with the same test signature: ${signature.summary}. Stop repeating this test and collect a new diagnostic observation. The next matching retry is held until the user acknowledges it. Same signature does not establish the same cause.`] };
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($);
    if (e.props.hasSurvey || !state.attempts.length) return next(e);
    const { Box, Text, Button } = $.ui.resolve(e);
    return Box({ flexDirection: 'column', paddingX: 1, children: [
      Text({ color: state.blocked ? 'yellow' : 'cyan', children: state.blocked ? 'Fix Loop Breaker: 3 repeated failures. Next matching retry held.' : `Fix Loop Breaker: ${state.consecutive}/3 repeated failures.` }),
      ...(state.blocked ? [Button({ key: 'continue', label: 'Continue anyway', hotkey: '1', onPress: () => resume($) })] : []),
    ] });
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'fix-loop-breaker') return next(e);
    const state = await read($);
    const { Box, Text, Button } = $.ui.resolve(e);
    const rows = [Text({ bold: true, color: state.blocked ? 'yellow' : 'cyan', children: `Fix Loop Breaker — ${state.consecutive}/3 repeated failures` })];
    for (const [index, attempt] of state.attempts.slice(-3).entries()) {
      rows.push(Text({ children: `${index + 1}. ${attempt.outcome.toUpperCase()}: ${attempt.summary}` }));
      rows.push(Text({ dimColor: true, children: attempt.files.length ? `Edited files: ${attempt.files.map(path => path.split('/').pop()).join(', ')}` : 'No successful Edit/Write observed since the previous test.' }));
    }
    rows.push(Text({ children: 'Next: inspect the failing assertion and gather a new observation before another patch. Same signature does not prove the same cause.' }));
    rows.push(Button({ key: 'continue', label: 'Continue anyway', hotkey: '1', onPress: () => resume($) }));
    rows.push(Button({ key: 'reset', label: 'Reset ledger', hotkey: '2', onPress: () => resume($, true) }));
    rows.push(Button({ key: 'close', label: 'Close view', hotkey: '3', onPress: () => $.ui.close({ id: 'fix-loop-breaker' }) }));
    return Box({ flexDirection: 'column', paddingX: 1, children: rows });
  });
}
