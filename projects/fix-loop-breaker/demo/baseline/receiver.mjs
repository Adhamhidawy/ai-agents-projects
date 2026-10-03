// Deliberately broken fixture: reconnect forgets to remove the old listener.
export class Receiver {
  constructor(bus) {
    this.bus = bus;
    this.retryDelay = 100;
    this.frames = [];
    this.onFrame = (frame) => this.frames.push(frame);
  }
  connect() { this.bus.on('frame', this.onFrame); }
  disconnect() { /* bug: listener remains attached */ }
  reconnect() { this.disconnect(); this.connect(); }
}
