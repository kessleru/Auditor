import { EventEmitter } from 'node:events';
import type { CollectionEvent } from '@auditoria-rf/contracts';

/** Barramento de eventos da coleta, publicado via SSE em /collections/:id/events. */
export class CollectionEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Cada aba aberta no progresso da coleta é um ouvinte.
    this.emitter.setMaxListeners(0);
  }

  publish(collectionId: number, event: CollectionEvent): void {
    this.emitter.emit(String(collectionId), event);
  }

  subscribe(collectionId: number, listener: (event: CollectionEvent) => void): () => void {
    const key = String(collectionId);
    this.emitter.on(key, listener);
    return () => this.emitter.off(key, listener);
  }
}
