import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService, ScreenType } from '../../services/bot.service';

interface NavItem {
  id: ScreenType;
  label: string;
  icon: string;
  badgeCount?: Signal<number>;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html'
})
export class Sidebar {
  readonly botService = inject(BotService);

  readonly activeTab = input<ScreenType>('inicio');

  readonly botStatus = this.botService.status;

  readonly navItems: NavItem[] = [
    { id: 'inicio', label: 'Inicio', icon: 'dashboard' },
    { id: 'logs', label: 'Logs en vivo', icon: 'terminal' },
    { id: 'imagenes', label: 'Imágenes', icon: 'collections' },
    { id: 'contactos', label: 'Contactos', icon: 'people' },
    { id: 'configuracion', label: 'Configuración', icon: 'settings' }
  ];

  selectTab(tab: ScreenType) {
    this.botService.setActiveScreen(tab);
  }

  openQrModal() {
    this.botService.openQrModal();
  }
}
