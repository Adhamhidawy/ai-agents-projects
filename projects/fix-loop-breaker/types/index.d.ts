export type Attempt = { command: string; signature: string; summary: string; files: string[]; at: number; outcome: 'failed' | 'passed' };
export type LoopState = { signature: string; consecutive: number; blocked: boolean; attempts: Attempt[]; pendingFiles: string[] };
declare module 'claude-code' {
  interface PluginState { 'fix-loop-breaker': { loop: LoopState }; }
}
