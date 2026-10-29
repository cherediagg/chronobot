import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Contact } from '../../../models/bot.model';

@Component({
  selector: 'app-contact-form-modal',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6">
        <div class="bg-[#0e1422]/90 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl">
          <div class="flex items-center justify-between pb-4 border-b border-white/5">
            <div class="flex items-center gap-2">
              <mat-icon class="text-cyan-400 text-lg">{{ contactToEdit() ? 'edit' : 'person_add' }}</mat-icon>
              <h3 class="text-base font-bold text-white">
                {{ contactToEdit() ? 'Editar empleado' : 'Añadir empleado al fichero' }}
              </h3>
            </div>
            <button type="button" (click)="closeModal.emit()" class="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer">
              <mat-icon class="text-base">close</mat-icon>
            </button>
          </div>

          <p class="text-xs text-slate-400 mt-3">
            Se registrará directamente en <span class="text-cyan-300 font-mono">data/employees.json</span>.
          </p>

          <form [formGroup]="form" (ngSubmit)="submitForm()" class="mt-4 space-y-4">
            <div>
              <label for="modal-contact-name" class="block text-xs font-semibold text-slate-300 mb-1.5">Nombre completo</label>
              <input
                id="modal-contact-name"
                type="text"
                formControlName="name"
                placeholder="Ej. Roberto Sánchez"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 font-sans"
              />
            </div>

            <div>
              <label for="modal-contact-phone" class="block text-xs font-semibold text-slate-300 mb-1.5">Número WhatsApp</label>
              <input
                id="modal-contact-phone"
                type="text"
                formControlName="phone"
                placeholder="+52155..."
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label for="modal-contact-role" class="block text-xs font-semibold text-slate-300 mb-1.5">Rol / Privilegios</label>
              <select
                id="modal-contact-role"
                formControlName="role"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans cursor-pointer"
              >
                <option value="Contacto Autorizado">Contacto Autorizado</option>
                <option value="Admin">Admin</option>
                <option value="Usuario Estándar">Usuario Estándar</option>
              </select>
            </div>

            <div>
              <label for="modal-contact-notes" class="block text-xs font-semibold text-slate-300 mb-1.5">Notas / Cargo</label>
              <input
                id="modal-contact-notes"
                type="text"
                formControlName="notes"
                placeholder="Ej. Supervisor de turno vespertino"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            @if (contactToEdit()) {
              <div class="flex items-center gap-3 p-3 rounded-2xl bg-black/30 border border-white/5">
                <input
                  id="modal-contact-authorized"
                  type="checkbox"
                  formControlName="authorized"
                  class="w-4 h-4 rounded text-cyan-500 bg-black/40 border-white/20 focus:ring-cyan-400 cursor-pointer"
                />
                <label for="modal-contact-authorized" class="text-xs text-slate-300 cursor-pointer">
                  Permitir que envíe fotos y mensajes a ChronoBot (Autorizado)
                </label>
              </div>
            }

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                (click)="closeModal.emit()"
                class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="form.invalid"
                class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 disabled:opacity-40 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class ContactFormModal {
  readonly isOpen = input<boolean>(false);
  readonly contactToEdit = input<Contact | null>(null);

  readonly closeModal = output<void>();
  readonly saveContact = output<{
    id?: string;
    name: string;
    phone: string;
    role: 'Admin' | 'Contacto Autorizado' | 'Usuario Estándar';
    notes: string;
    authorized: boolean;
  }>();

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('+52', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    role: new FormControl<'Admin' | 'Contacto Autorizado' | 'Usuario Estándar'>('Contacto Autorizado', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true })
  });

  constructor() {
    effect(() => {
      const contact = this.contactToEdit();
      if (contact) {
        this.form.setValue({
          name: contact.name,
          phone: contact.phone,
          role: contact.role,
          notes: contact.notes || '',
          authorized: contact.authorized
        });
      } else {
        this.form.reset({
          name: '',
          phone: '+52',
          role: 'Contacto Autorizado',
          notes: '',
          authorized: true
        });
      }
    });
  }

  submitForm() {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saveContact.emit({
      id: this.contactToEdit()?.id,
      ...val
    });
  }
}
