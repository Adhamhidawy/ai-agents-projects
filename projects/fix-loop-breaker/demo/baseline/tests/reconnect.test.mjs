import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Receiver } from '../receiver.mjs';

test('reconnect delivers each frame once', () => {
  const bus = new EventEmitter();
  const receiver = new Receiver(bus);
  receiver.connect();
  receiver.reconnect();
  bus.emit('frame', 'hello');
  assert.equal(receiver.frames.length, 1, 'reconnect must not duplicate a frame');
});
