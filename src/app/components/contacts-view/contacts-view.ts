import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { Contact } from '../../models/bot.model';

@Component({
  selector: 'app-contacts-view',
  imports: [MatIconModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 sm:p-10 space-y-8 max-w-[1600px] mx-auto select-none font-sans">
      <!-- Toast Notification for Disk Persistence -->
      @if (toastMessage()) {
        <div class="fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl bg-[#0f172a]/95 border border-cyan-400/40 text-cyan-200 text-xs font-semibold shadow-[0_10px_40px_rgba(6,182,212,0.3)] flex items-center gap-3 backdrop-blur-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <mat-icon class="text-cyan-400 text-lg">save</mat-icon>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      <!-- Header with Gradient Title -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div class="space-y-1.5">
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-200">
            Gestión de Empleados
          </h1>
          <p class="text-sm text-slate-400">
            Control y autorización de contactos activos para ChronoBot WhatsApp.
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            (click)="openAddModal()"
            class="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400 hover:from-blue-400 hover:to-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(6,182,212,0.35)] active:scale-95"
          >
            <mat-icon class="text-base">person_add</mat-icon>
            <span>Añadir empleado</span>
          </button>
        </div>
      </div>

      <!-- Fluid Telemetry Wave (Zero Box Borders) -->
      <section class="grid grid-cols-1 gap-6 p-6 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" aria-label="Empleados autorizados">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(59,130,246,0.3)]">
            <mat-icon class="text-2xl">verified_user</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Acceso Autorizado</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ botService.authorizedContactsCount() }}
              <span class="text-xs font-normal text-slate-400 font-sans">empleados activos</span>
            </h2>
            <span class="text-xs text-blue-400/80">Lista blanca de WhatsApp</span>
          </div>
        </div>

      </section>

      <!-- Search Toolbar (Fluid Glass Ribbon) -->
      <div class="p-4 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/30 backdrop-blur-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="relative w-full sm:w-96">
          <mat-icon class="text-slate-500 text-base absolute left-3.5 top-2.5 pointer-events-none">search</mat-icon>
          <input
            type="text"
            [formControl]="searchControl"
            placeholder="Buscar empleado por nombre o teléfono..."
            class="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-sans"
          />
        </div>

        <span class="text-xs text-slate-400 font-mono px-2">
          {{ filteredContacts().length }} de {{ botService.contacts().length }} empleados
        </span>
      </div>

      <!-- Fluid Floating Contacts Stream (No Box Borders) -->
      <div class="space-y-3.5">
        @for (contact of filteredContacts(); track contact.id) {
          <div class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-3xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_15px_35px_rgba(6,182,212,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- Left: Avatar & Identity -->
            <div class="flex items-center gap-4 min-w-0">
              <div class="min-w-0">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <h3 class="font-bold text-white text-sm tracking-tight truncate">{{ contact.name }}</h3>
                  @if (contact.authorized) {
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Autorizado en Bot
                    </span>
                  } @else {
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Bloqueado
                    </span>
                  }
                </div>
                <p class="text-xs text-slate-300 font-mono mt-0.5">{{ contact.phone }}</p>
                <p class="text-[11px] text-slate-400 mt-0.5 truncate">{{ contact.notes || 'Sin notas asignadas' }}</p>
              </div>
            </div>

            <!-- Right: Authorization, Edit & Delete Actions -->
            <div class="flex items-center gap-4 sm:gap-6 self-end md:self-center shrink-0 flex-wrap">
              <!-- Permission Switch -->
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400 font-medium">Permiso:</span>
                <button
                  type="button"
                  role="switch"
                  [attr.aria-checked]="contact.authorized"
                  (click)="toggleAuth(contact.id)"
                  class="w-11 h-6 rounded-full transition-colors relative inline-block align-middle focus:outline-none"
                  [class]="contact.authorized ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-white/10'"
                >
                  <span
                    class="block w-5 h-5 rounded-full bg-white transition-transform transform shadow-md"
                    [class]="contact.authorized ? 'translate-x-5' : 'translate-x-0.5'"
                  ></span>
                </button>
              </div>

              <!-- Edit Button -->
              <button
                type="button"
                (click)="openEditModal(contact)"
                title="Editar empleado"
                class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 text-xs transition-colors border border-white/5 hover:border-cyan-500/30"
              >
                <mat-icon class="text-sm">edit</mat-icon>
                <span>Editar</span>
              </button>

              <!-- Delete Button -->
              <button
                type="button"
                (click)="askDeleteConfirm(contact)"
                title="Eliminar empleado"
                class="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors"
              >
                <mat-icon class="text-base">delete</mat-icon>
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Fluid Glass Add Contact Modal -->
    @if (showAddModal()) {
      <div class="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-6">
        <div class="bg-[#0e1422]/95 border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-[0_20px_70px_rgba(0,0,0,0.55)] animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between pb-4 border-b border-white/5">
            <div class="flex items-center gap-2">
              <mat-icon class="text-cyan-400 text-lg">person_add</mat-icon>
              <h3 class="text-base font-bold text-white">Añadir empleado</h3>
            </div>
            <button type="button" (click)="closeAddModal()" class="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
              <mat-icon class="text-base">close</mat-icon>
            </button>
          </div>

          <p class="text-xs text-slate-400 mt-3">
            Se añadirá a la lista de contactos autorizados de WhatsApp.
          </p>

          <form [formGroup]="contactForm" (ngSubmit)="submitAddContact()" class="mt-4 space-y-4">
            <div>
              <label for="contact-name" class="block text-xs font-semibold text-slate-300 mb-1.5">Nombre completo</label>
              <input
                id="contact-name"
                type="text"
                formControlName="name"
                placeholder="Ej. Roberto Sánchez"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 font-sans"
              />
            </div>

            <div>
              <label for="contact-phone" class="block text-xs font-semibold text-slate-300 mb-1.5">Número WhatsApp (código internacional)</label>
              <input
                id="contact-phone"
                type="text"
                formControlName="phone"
                placeholder="+346..."
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label for="contact-notes" class="block text-xs font-semibold text-slate-300 mb-1.5">Notas</label>
              <input
                id="contact-notes"
                type="text"
                formControlName="notes"
                placeholder="Notas del empleado (opcional)"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                (click)="closeAddModal()"
                class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="contactForm.invalid"
                class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 disabled:opacity-40 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
              >
                Guardar empleado
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Fluid Glass Edit Contact Modal -->
    @if (showEditModal()) {
      <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6">
        <div class="bg-[#0e1422]/90 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between pb-4 border-b border-white/5">
            <div class="flex items-center gap-2">
              <mat-icon class="text-cyan-400 text-lg">edit</mat-icon>
              <h3 class="text-base font-bold text-white">Editar empleado</h3>
            </div>
            <button type="button" (click)="closeEditModal()" class="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
              <mat-icon class="text-base">close</mat-icon>
            </button>
          </div>

          <p class="text-xs text-slate-400 mt-3">
            Actualiza los datos y permisos de este empleado.
          </p>

          <form [formGroup]="editForm" (ngSubmit)="submitEditContact()" class="mt-4 space-y-4">
            <div>
              <label for="edit-name" class="block text-xs font-semibold text-slate-300 mb-1.5">Nombre completo</label>
              <input
                id="edit-name"
                type="text"
                formControlName="name"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 font-sans"
              />
            </div>

            <div>
              <label for="edit-phone" class="block text-xs font-semibold text-slate-300 mb-1.5">Número WhatsApp</label>
              <input
                id="edit-phone"
                type="text"
                formControlName="phone"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label for="edit-notes" class="block text-xs font-semibold text-slate-300 mb-1.5">Notas</label>
              <input
                id="edit-notes"
                type="text"
                formControlName="notes"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            <div class="flex items-center gap-3 p-3 rounded-2xl bg-black/30 border border-white/5">
              <input
                id="edit-authorized"
                type="checkbox"
                formControlName="authorized"
                class="w-4 h-4 rounded text-cyan-500 bg-black/40 border-white/20 focus:ring-cyan-400"
              />
              <label for="edit-authorized" class="text-xs text-slate-300">
                Permitir que envíe fotos y mensajes a ChronoBot (Autorizado)
              </label>
            </div>

            <div class="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                (click)="closeEditModal()"
                class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="editForm.invalid"
                class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 disabled:opacity-40 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Fluid Glass Delete Confirmation Modal -->
    @if (contactToDelete()) {
      <div class="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-6">
        <div class="bg-[#0e1422]/95 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-[0_20px_70px_rgba(0,0,0,0.55)] animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 pb-3 border-b border-white/5 text-rose-400">
            <mat-icon class="text-2xl">warning</mat-icon>
            <h3 class="text-base font-bold text-white">¿Eliminar empleado?</h3>
          </div>

          <p class="text-xs text-slate-300 mt-4 leading-relaxed">
            Se eliminará permanentemente a <strong class="text-white">{{ contactToDelete()?.name }}</strong> ({{ contactToDelete()?.phone }}).
          </p>

          <p class="text-[11px] text-slate-400 mt-2">
            El bot de WhatsApp revocará de inmediato su acceso y ya no podrá almacenar imágenes.
          </p>

          <div class="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-white/5">
            <button
              type="button"
              (click)="contactToDelete.set(null)"
              class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmDelete()"
              class="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all"
            >
              Sí, eliminar empleado
            </button>
          </div>
        </div>
      </div>
    }

  `
})
export class ContactsView {
  readonly botService = inject(BotService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly showAddModal = signal<boolean>(false);
  readonly showEditModal = signal<boolean>(false);
  readonly contactToDelete = signal<Contact | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly contactForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('+34', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    notes: new FormControl('', { nonNullable: true })
  });

  readonly editForm = new FormGroup({
    id: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    notes: new FormControl('', { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true })
  });

  readonly filteredContacts = computed(() => {
    const list = this.botService.contacts();
    const query = this.searchControl.value.toLowerCase().trim();
    if (!query) return list;

    return list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      (c.notes && c.notes.toLowerCase().includes(query))
    );
  });

  private showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }

  openAddModal() {
    this.contactForm.reset({
      name: '',
      phone: '+34',
      notes: ''
    });
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  async submitAddContact() {
    if (this.contactForm.invalid) return;
    const formVal = this.contactForm.getRawValue();

    await this.botService.addContact({
      name: formVal.name,
      phone: formVal.phone,
      authorized: true,
      notes: formVal.notes
    });

    this.closeAddModal();
    this.showToast(`Empleado "${formVal.name}" guardado.`);
  }

  openEditModal(contact: Contact) {
    this.editForm.setValue({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      notes: contact.notes || '',
      authorized: contact.authorized
    });
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
  }

  async submitEditContact() {
    if (this.editForm.invalid) return;
    const formVal = this.editForm.getRawValue();

    const updated: Contact = {
      id: formVal.id,
      name: formVal.name,
      phone: formVal.phone,
      authorized: formVal.authorized,
      notes: formVal.notes,
    };

    await this.botService.updateContact(updated);
    this.closeEditModal();
    this.showToast(`Cambios de "${updated.name}" guardados.`);
  }

  async toggleAuth(id: string) {
    await this.botService.toggleContactAuthorization(id);
    this.showToast('Permiso de WhatsApp actualizado.');
  }

  askDeleteConfirm(contact: Contact) {
    this.contactToDelete.set(contact);
  }

  async confirmDelete() {
    const contact = this.contactToDelete();
    if (contact) {
      await this.botService.deleteContact(contact.id);
      this.showToast(`"${contact.name}" eliminado.`);
    }
    this.contactToDelete.set(null);
  }

}
