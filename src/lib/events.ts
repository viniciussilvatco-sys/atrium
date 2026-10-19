type Listener<T> = (payload: T) => void;

export class Emitter<T = void> {
  private listeners = new Set<Listener<T>>();

  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(payload: T): void {
    for (const fn of this.listeners) fn(payload);
  }
}

/** Disparado sempre que algo é alterado localmente (o motor de sync agenda um envio). */
export const localChanges = new Emitter<void>();
