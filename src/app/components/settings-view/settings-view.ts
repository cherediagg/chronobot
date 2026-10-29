import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-settings-view',
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-view.html'
})
export class SettingsView {
  private readonly botService = inject(BotService);

  readonly config = this.botService.config;

  readonly storagePath = 'public/saved_images/';
  readonly employeesJsonPath = 'data/employees.json';

  updateBotName(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.botService.updateConfig({ botName: val });
  }

  toggleAutoReply() {
    this.botService.updateConfig({
      autoReplyEnabled: !this.config().autoReplyEnabled
    });
  }

  toggleNotifyUnauthorized() {
    this.botService.updateConfig({
      notifyUnauthorized: !this.config().notifyUnauthorized
    });
  }
}
