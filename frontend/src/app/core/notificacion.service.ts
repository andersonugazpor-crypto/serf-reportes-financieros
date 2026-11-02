import { Injectable, signal } from '@angular/core';

export type TipoNotificacion = 'exito' | 'error' | 'info' | 'advertencia';

export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private contador = 0;
  readonly lista = signal<Notificacion[]>([]);

  exito(m: string): void {
    this.mostrar('exito', m);
  }
  error(m: string): void {
    this.mostrar('error', m, 6000);
  }
  info(m: string): void {
    this.mostrar('info', m);
  }
  advertencia(m: string): void {
    this.mostrar('advertencia', m, 5000);
  }

  cerrar(id: number): void {
    this.lista.update((l) => l.filter((n) => n.id !== id));
  }

  private mostrar(tipo: TipoNotificacion, mensaje: string, ms = 3500): void {
    const id = ++this.contador;
    this.lista.update((l) => [...l, { id, tipo, mensaje }].slice(-4));
    setTimeout(() => this.cerrar(id), ms);
  }
}
