import type { WebSocket } from '@fastify/websocket';
import type { WsServerEvent, WsVanPosition } from '@family-ice/shared';

/**
 * Realtime fan-out sink used by the proximity engine, ingest, and hand-raise flow. Decouples
 * them from the transport: today an in-process WebSocket hub; the multi-instance swap is Redis
 * pub/sub behind this same interface.
 */
export interface Realtime {
  /** Send a live van position to every connected client. */
  broadcastVanPosition(ev: WsVanPosition): void;
  /** Send an event to all of one user's connected sockets. */
  toUser(userId: string, ev: WsServerEvent): void;
  /** Send an event to all connected driver-role sockets (hand-raise inbox updates). */
  toDrivers(ev: WsServerEvent): void;
}

export class WsHub implements Realtime {
  /** userId → set of that user's live sockets. */
  private readonly byUser = new Map<string, Set<WebSocket>>();
  /** all sockets currently in the driver role. */
  private readonly drivers = new Set<WebSocket>();

  add(userId: string, role: 'user' | 'driver', socket: WebSocket): void {
    let set = this.byUser.get(userId);
    if (!set) {
      set = new Set();
      this.byUser.set(userId, set);
    }
    set.add(socket);
    if (role === 'driver') this.drivers.add(socket);
  }

  remove(userId: string, socket: WebSocket): void {
    const set = this.byUser.get(userId);
    if (set) {
      set.delete(socket);
      if (set.size === 0) this.byUser.delete(userId);
    }
    this.drivers.delete(socket);
  }

  broadcastVanPosition(ev: WsVanPosition): void {
    const payload = JSON.stringify(ev);
    for (const set of this.byUser.values()) {
      for (const socket of set) this.safeSend(socket, payload);
    }
  }

  toUser(userId: string, ev: WsServerEvent): void {
    const set = this.byUser.get(userId);
    if (!set) return;
    const payload = JSON.stringify(ev);
    for (const socket of set) this.safeSend(socket, payload);
  }

  toDrivers(ev: WsServerEvent): void {
    const payload = JSON.stringify(ev);
    for (const socket of this.drivers) this.safeSend(socket, payload);
  }

  private safeSend(socket: WebSocket, payload: string): void {
    try {
      socket.send(payload);
    } catch {
      // socket may be mid-close; ignore.
    }
  }
}
