import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificacionesComponent } from './shared/ui.components';

@Component({
  selector: 'serf-root',
  imports: [RouterOutlet, NotificacionesComponent],
  template: `<router-outlet /><serf-notificaciones />`,
})
export class App {}
