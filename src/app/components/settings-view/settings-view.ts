import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';

@Component({
  selector: 'app-settings-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-view.html'
})
export class SettingsView {
  readonly botService = inject(BotService);
  readonly savedToast = signal<boolean>(false);

  readonly currentConfig = this.botService.config();

  readonly settingsForm = new FormGroup({
    botName: new FormControl(this.currentConfig.botName, { nonNullable: true }),
    sessionName: new FormControl(this.currentConfig.sessionName, { nonNullable: true }),
    prefix: new FormControl(this.currentConfig.prefix, { nonNullable: true }),
    saveDirectory: new FormControl(this.currentConfig.saveDirectory, { nonNullable: true }),
    groupFolderByContact: new FormControl(this.currentConfig.groupFolderByContact, { nonNullable: true }),
    groupFolderByMonth: new FormControl(this.currentConfig.groupFolderByMonth, { nonNullable: true }),
    maxImageSizeMb: new FormControl(this.currentConfig.maxImageSizeMb, { nonNullable: true }),
    autoReplyEnabled: new FormControl(this.currentConfig.autoReplyEnabled, { nonNullable: true }),
    welcomeMessage: new FormControl(this.currentConfig.welcomeMessage, { nonNullable: true }),
    unauthorizedMessage: new FormControl(this.currentConfig.unauthorizedMessage, { nonNullable: true })
  });

  toggleAutoReply() {
    const cur = this.settingsForm.get('autoReplyEnabled')?.value ?? false;
    this.settingsForm.get('autoReplyEnabled')?.setValue(!cur);
  }

  saveSettings() {
    const val = this.settingsForm.getRawValue();
    this.botService.updateConfig(val);
    this.savedToast.set(true);
    setTimeout(() => {
      this.savedToast.set(false);
    }, 3000);
  }
}
