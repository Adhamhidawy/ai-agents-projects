import { describe, test, expect, mock } from 'claude-code/testing';
import { supported, failureSignature, TEST_COMMAND } from '../hooks/fix-loop-breaker.mjs';
const REF = { plugin: 'fix-loop-breaker', key: 'loop' } as const;
const fail = (name = 'reconnect delivers each frame once', duration = '1.2') => ({
  isError: true as const, result: 'Exit code 1', text: `Exit code 1\n✖ ${name} (${duration}ms)\nAssertionError [ERR_ASSERTION]: duplicate\n`, context: ['original reminder'], ref: 41,
});
const pass = { result: { stdout: '✔ reconnect delivers each frame once', stderr: '', interrupted: false }, text: 'passed', ref: 42 };
function setup(on: any) {
  let exported = "";
  on("fs.write", ($: any, e: any) => { exported = e.text; return { value: undefined }; });
  mock.clock(on);
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }));
  on('command.register', ($: any, e: any) => ({ value: { command: e.name } }));
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'narrow test viewport' } }));
  on('ui.close', () => ({ value: undefined }));
  return async ($: any) => { await $.command.run({ command: 'fix-loop', args: 'export' }); return JSON.parse(exported); };
}
async function call($: any, extra = {}) { return $.tool.call({ tool: 'Bash', command: TEST_COMMAND, ...extra }); }
const band = ($: any, props = {}) => $.ui.mount({ plugin: 'fix-loop-breaker', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, ...props } });

describe('Fix Loop Breaker', () => {
  test('recognizes only the explicit supported command', () => {
    expect(supported(TEST_COMMAND)).toBe(true);
    expect(supported(`  ${TEST_COMMAND}  `)).toBe(true);
    expect(supported(`${TEST_COMMAND} || true`)).toBe(false);
    expect(supported(`cd app && ${TEST_COMMAND}`)).toBe(false);
    expect(supported('npm test')).toBe(false);
  });
  test('normalizes durations but distinguishes failing test names', () => {
    expect(failureSignature(fail('same', '1.2').text)?.key).toBe(failureSignature(fail('same', '92.8').text)?.key);
    expect(failureSignature(fail('same').text)?.key).not.toBe(failureSignature(fail('different').text)?.key);
    expect(failureSignature('Permission denied')).toBe(null);
  });
  test('three failures add a reminder; fourth retry never reaches the tool', async ($, on) => {
    const snapshot = setup(on); let calls = 0;
    on('tool.call', { tool: 'Bash' }, () => { calls++; return fail(); });
    await call($); await call($);
    expect((await snapshot($))?.blocked).toBe(false);
    const third = await call($);
    expect(third.text).toBe(fail().text);
    expect(third.ref).toBe(41);
    expect(third.context?.[0]).toBe('original reminder');
    expect(third.context?.[1]).toContain('3 consecutive failures');
    expect((await call($)).deny).toContain('same test signature');
    expect(calls).toBe(3);
    expect((await snapshot($))?.consecutive).toBe(3);
  });
  test('a passing test resets the repeat count', async ($, on) => {
    const snapshot = setup(on); let n = 0;
    on('tool.call', { tool: 'Bash' }, () => ++n === 2 ? pass : fail());
    await call($); await call($); await call($);
    const state = (await snapshot($))!;
    expect(state.consecutive).toBe(1);
    expect(state.attempts.map(a => a.outcome)).toEqual(['failed', 'passed', 'failed']);
  });
  test('a different failure starts a different sequence', async ($, on) => {
    const snapshot = setup(on); let n = 0;
    on('tool.call', { tool: 'Bash' }, () => fail(++n < 3 ? 'first test' : 'different test'));
    await call($); await call($); await call($);
    expect((await snapshot($))?.consecutive).toBe(1);
    expect((await snapshot($))?.blocked).toBe(false);
  });
  test('ignores unrelated commands, subagents and background calls', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    await call($, { command: 'npm test' });
    await call($, { agentId: 'worker' });
    await call($, { run_in_background: true });
    expect((await snapshot($)).attempts.length).toBe(0);
  });
  test('denials and unparseable errors do not become test failures', async ($, on) => {
    const snapshot = setup(on); let n = 0;
    on('tool.call', () => ++n === 1 ? { deny: 'permission denied' } : { isError: true, result: 'interrupted', text: 'Command interrupted' });
    await call($); await call($);
    expect((await snapshot($))?.attempts.length ?? 0).toBe(0);
  });
  test('backgrounded and interrupted successful envelopes are not passes', async ($, on) => {
    const snapshot = setup(on); let n = 0;
    on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: ++n === 1, ...(n === 2 ? { backgroundTaskId: 'task' } : {}) } }));
    await call($); await call($);
    expect((await snapshot($))?.attempts.length ?? 0).toBe(0);
  });
  test('records successful Edit paths but excludes staged and failed edits', async ($, on) => {
    const snapshot = setup(on);
    on('tool.call', { tool: 'Edit' }, ($, e: any) => e.file_path === 'staged.mjs' ? { result: { staged: true } } : e.file_path === 'failed.mjs' ? { isError: true, result: 'failed', text: 'failed' } : { result: {} });
    on('tool.call', { tool: 'Bash' }, () => fail());
    for (const path of ['receiver.mjs', 'staged.mjs', 'failed.mjs']) await $.tool.call({ tool: 'Edit', file_path: path, old_string: 'x', new_string: 'y' });
    await call($);
    expect((await snapshot($))?.attempts[0].files).toEqual(['receiver.mjs']);
  });
  test('session.start repeated in the same host preserves evidence', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any);
    await call($); await call($);
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any);
    expect((await snapshot($))?.consecutive).toBe(2);
  });
  test('continue acknowledges the hold and retains the evidence', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    await call($); await call($); await call($);
    await $.command.run({ command: 'fix-loop', args: 'continue' });
    expect((await snapshot($))?.attempts.length).toBe(3);
    expect((await snapshot($))?.blocked).toBe(false);
    expect((await call($)).deny).toBeUndefined();
  });
  test('band redraws when state changes and its button releases the hold', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    await call($);
    const ui = await band($);
    expect(await ui.find({ type: 'Text', text: /1\/3 repeated/ })).toBeDefined();
    await call($); await call($);
    expect(await ui.find({ type: 'Text', text: /Next matching retry held/ })).toBeDefined();
    await $.ui.press({ plugin: 'fix-loop-breaker', key: 'continue' } as any);
    expect((await snapshot($))?.blocked).toBe(false);
    await ui.unmount();
  });
  test('yields the band to a survey', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({ children: 'Survey owns this slot' }));
    await call($);
    const ui = await band($, { hasSurvey: true });
    expect(await ui.find({ type: 'Text', text: /Survey owns/ })).toBeDefined();
    await ui.unmount();
  });
  test('pane presents attempts and a next diagnostic step', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    await call($); await call($); await call($);
    const ui = await $.ui.mount({ plugin: 'fix-loop-breaker', surface: 'terminal', component: 'Pane', requestId: 'fix-loop-breaker', props: { title: 'Fix Loop Breaker', isFocused: true, bodyColumns: 70, placement: 'dock' } } as any);
    expect(await ui.find({ type: 'Text', text: /3\/3 repeated failures/ })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: /gather a new observation/ })).toBeDefined();
    await ui.unmount();
  });
  test('export writes structured evidence', async ($, on) => {
    const snapshot = setup(on); on('tool.call', () => fail());
    await call($);
    const output = await snapshot($);
    expect(output.consecutive).toBe(1);
    expect(output.supportedCommand).toBe(TEST_COMMAND);
  });
});
