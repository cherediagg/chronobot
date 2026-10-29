import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Sidebar } from './components/sidebar/sidebar';
import { V2Dashboard } from './components/v2-dashboard/v2-dashboard';
import { LogsView } from './components/logs-view/logs-view';
import { ImagesView } from './components/images-view/images-view';
import { ContactsView } from './components/contacts-view/contacts-view';
import { SettingsView } from './components/settings-view/settings-view';
import { BotService } from './services/bot.service';

@Component({
  selector: 'app-root',
  imports: [
    MatIconModule,
    Sidebar,
    V2Dashboard,
    LogsView,
    ImagesView,
    ContactsView,
    SettingsView
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly botService = inject(BotService);
  readonly mobileMenuOpen = signal<boolean>(false);

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }
}
