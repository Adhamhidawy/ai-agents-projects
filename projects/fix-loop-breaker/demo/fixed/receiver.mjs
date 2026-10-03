// Corrected fixture: disconnect removes the old listener before reconnect.
export class Receiver {
  constructor(bus) {
    this.bus = bus;
    this.retryDelay = 800;
    this.frames = [];
    this.onFrame = (frame) => this.frames.push(frame);
  }
  connect() { this.bus.on('frame', this.onFrame); }
  disconnect() { this.bus.off('frame', this.onFrame); }
  reconnect() { this.disconnect(); this.connect(); }
}
