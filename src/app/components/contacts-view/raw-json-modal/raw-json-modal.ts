import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { EmployeesFileMeta } from '../../../services/contacts.service';

@Component({
  selector: 'app-raw-json-modal',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
        <div class="bg-[#0c1220]/95 border border-cyan-500/30 rounded-3xl max-w-3xl w-full p-6 shadow-[0_0_120px_rgba(6,182,212,0.3)] backdrop-blur-3xl flex flex-col max-h-[85vh]">
          <div class="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div class="flex items-center gap-3">
              <mat-icon class="text-cyan-400 text-xl">description</mat-icon>
              <div>
                <h3 class="text-base font-bold text-white">Fichero: data/employees.json</h3>
                <p class="text-[11px] text-slate-400">Contenido persistido en el sistema de archivos del servidor</p>
              </div>
            </div>
            <button type="button" (click)="closeModal.emit()" class="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
              <mat-icon class="text-base">close</mat-icon>
            </button>
          </div>

          <div class="py-4 space-y-3 flex-1 flex flex-col min-h-0">
            <div class="flex items-center justify-between text-xs text-slate-400">
              <span>Edición directa de registros JSON:</span>
              <button
                type="button"
                (click)="copyJsonToClipboard()"
                class="hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors cursor-pointer"
              >
                <mat-icon class="text-xs">content_copy</mat-icon>
                <span>{{ copied() ? '¡Copiado!' : 'Copiar JSON' }}</span>
              </button>
            </div>

            <textarea
              [formControl]="rawJsonControl"
              rows="16"
              class="w-full flex-1 bg-black/70 border border-white/10 rounded-2xl p-4 font-mono text-xs text-cyan-200 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 resize-none leading-relaxed"
            ></textarea>

            @if (jsonError()) {
              <p class="text-xs text-rose-400 flex items-center gap-1.5">
                <mat-icon class="text-sm">error</mat-icon>
                <span>{{ jsonError() }}</span>
              </p>
            }
          </div>

          <div class="flex items-center justify-between pt-4 border-t border-white/10 shrink-0">
            <span class="text-xs text-slate-400 font-mono">
              {{ fileMeta().sizeBytes }} bytes · {{ fileMeta().employeesCount }} items
            </span>

            <div class="flex items-center gap-3">
              <button
                type="button"
                (click)="closeModal.emit()"
                class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                (click)="submitJson()"
                class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
              >
                Guardar fichero
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class RawJsonModal {
  readonly isOpen = input<boolean>(false);
  readonly jsonContent = input<string>('');
  readonly fileMeta = input<EmployeesFileMeta>({
    relativePath: 'data/employees.json',
    exists: true,
    sizeBytes: 0,
    modifiedAt: '',
    employeesCount: 0,
    allowedCount: 0
  });

  readonly closeModal = output<void>();
  readonly saveRawJson = output<string>();

  readonly rawJsonControl = new FormControl('', { nonNullable: true });
  readonly copied = signal<boolean>(false);
  readonly jsonError = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.rawJsonControl.setValue(this.jsonContent());
      this.jsonError.set(null);
    });
  }

  submitJson() {
    const text = this.rawJsonControl.value.trim();
    this.jsonError.set(null);
    try {
      JSON.parse(text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'JSON inválido';
      this.jsonError.set(`Error de sintaxis: ${msg}`);
      return;
    }
    this.saveRawJson.emit(text);
  }

  copyJsonToClipboard() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.rawJsonControl.value).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }
}
