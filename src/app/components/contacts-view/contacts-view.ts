import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { BotService } from '../../services/bot.service';
import { Contact } from '../../models/bot.model';
import { ContactFormModal } from './contact-form-modal/contact-form-modal';
import { ContactDeleteModal } from './contact-delete-modal/contact-delete-modal';
import { RawJsonModal } from './raw-json-modal/raw-json-modal';

@Component({
  selector: 'app-contacts-view',
  imports: [
    MatIconModule,
    ReactiveFormsModule,
    ContactFormModal,
    ContactDeleteModal,
    RawJsonModal
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 sm:p-10 space-y-8 max-w-[1600px] mx-auto select-none font-sans">
      <!-- Toast Notification -->
      @if (toastMessage()) {
        <div class="fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl bg-[#0f172a]/95 border border-cyan-400/40 text-cyan-200 text-xs font-semibold shadow-[0_10px_40px_rgba(6,182,212,0.3)] flex items-center gap-3 backdrop-blur-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <mat-icon class="text-cyan-400 text-lg">save</mat-icon>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-slate-400 text-xs">
            <button type="button" (click)="botService.activeScreen.set('inicio')" class="hover:text-blue-300 transition-colors">Inicio</button>
            <span>/</span>
            <span class="text-blue-400 font-medium">Contactos y Empleados</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-200">
            Gestión de Empleados
          </h1>
          <p class="text-sm text-slate-400">
            Fichero persistente en disco <span class="text-cyan-300 font-mono">data/employees.json</span> sincronizado en tiempo real con ChronoBot WhatsApp.
          </p>
        </div>

        <div class="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            (click)="openRawJsonModal()"
            title="Inspeccionar o editar fichero JSON en crudo"
            class="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-medium text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <mat-icon class="text-base text-cyan-400">code</mat-icon>
            <span>Ver Fichero JSON</span>
          </button>

          <button
            type="button"
            (click)="reloadFile()"
            title="Recargar desde fichero en disco"
            class="p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition-all active:scale-95 cursor-pointer"
          >
            <mat-icon class="text-base" [class.animate-spin]="isReloading()">refresh</mat-icon>
          </button>

          <button
            type="button"
            (click)="openAddModal()"
            class="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400 hover:from-blue-400 hover:to-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(6,182,212,0.35)] active:scale-95 cursor-pointer"
          >
            <mat-icon class="text-base">person_add</mat-icon>
            <span>Añadir empleado</span>
          </button>
        </div>
      </div>

      <!-- Persistent Storage File Banner -->
      <section class="p-5 rounded-3xl bg-gradient-to-r from-cyan-500/[0.08] via-blue-500/[0.05] to-purple-500/[0.04] backdrop-blur-3xl border border-cyan-500/20 shadow-[0_15px_40px_rgba(6,182,212,0.1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4" aria-label="Estado de persistencia">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <mat-icon class="text-2xl">storage</mat-icon>
          </div>
          <div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <span class="font-mono text-xs font-bold text-cyan-200 bg-cyan-500/20 px-2.5 py-0.5 rounded-full border border-cyan-400/30">
                data/employees.json
              </span>
              <span class="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Persistencia en servidor activa
              </span>
            </div>
            <p class="text-xs text-slate-300 mt-1">
              Todos los cambios en esta lista se escriben inmediatamente al archivo físico en el servidor.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3 text-xs text-slate-400 font-mono shrink-0">
          <span class="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            {{ botService.employeesFileMeta().employeesCount }} empleados en fichero
          </span>
          <span class="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            {{ botService.employeesFileMeta().sizeBytes }} bytes
          </span>
        </div>
      </section>

      <!-- Telemetry Stream -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]" aria-label="Métricas de contactos">
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

        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
            <mat-icon class="text-2xl">mark_chat_read</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Mensajes Totales</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ totalMessages() }}
            </h2>
            <span class="text-xs text-emerald-400/80">Procesados con éxito</span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
            <mat-icon class="text-2xl">photo_library</mat-icon>
          </div>
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold block">Fotos Recibidas</span>
            <h2 class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
              {{ totalImages() }}
            </h2>
            <span class="text-xs text-purple-400/80">Archivos clasificados</span>
          </div>
        </div>
      </section>

      <!-- Search Toolbar -->
      <div class="p-4 rounded-3xl bg-gradient-to-b from-white/[0.04] to-black/30 backdrop-blur-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="relative w-full sm:w-96">
          <mat-icon class="text-slate-500 text-base absolute left-3.5 top-2.5 pointer-events-none">search</mat-icon>
          <input
            type="text"
            [formControl]="searchControl"
            placeholder="Buscar empleado por nombre, teléfono o rol..."
            class="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-sans"
          />
        </div>

        <span class="text-xs text-slate-400 font-mono px-2">
          {{ filteredContacts().length }} de {{ botService.contacts().length }} empleados guardados
        </span>
      </div>

      <!-- Contacts List -->
      <div class="space-y-3.5">
        @for (contact of filteredContacts(); track contact.id) {
          <div class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-3xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_15px_35px_rgba(6,182,212,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-4 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-slate-800 overflow-hidden shrink-0 border border-white/10 shadow-lg">
                @if (contact.avatarUrl) {
                  <img [src]="contact.avatarUrl" [alt]="contact.name" class="w-full h-full object-cover" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-slate-300 font-bold text-sm bg-gradient-to-br from-cyan-500/30 to-blue-500/30">
                    {{ contact.name.substring(0, 1) }}
                  </div>
                }
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <h3 class="font-bold text-white text-sm tracking-tight truncate">{{ contact.name }}</h3>
                  <span 
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                    [class]="contact.role === 'Admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'"
                  >
                    {{ contact.role }}
                  </span>
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

            <div class="flex items-center gap-4 sm:gap-6 self-end md:self-center shrink-0 flex-wrap">
              <div class="text-right hidden sm:block">
                <span class="text-xs font-mono font-bold text-white block">{{ contact.messagesReceived }} msgs · {{ contact.imagesReceived }} fotos</span>
                <span class="text-[10px] text-slate-400 font-mono">{{ contact.lastActive }}</span>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400 font-medium">Permiso:</span>
                <button
                  type="button"
                  role="switch"
                  [attr.aria-checked]="contact.authorized"
                  (click)="toggleAuth(contact.id)"
                  class="w-11 h-6 rounded-full transition-colors relative inline-block align-middle focus:outline-none cursor-pointer"
                  [class]="contact.authorized ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-white/10'"
                >
                  <span
                    class="block w-5 h-5 rounded-full bg-white transition-transform transform shadow-md"
                    [class]="contact.authorized ? 'translate-x-5' : 'translate-x-0.5'"
                  ></span>
                </button>
              </div>

              <button
                type="button"
                (click)="openEditModal(contact)"
                title="Editar empleado"
                class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 text-xs transition-colors border border-white/5 hover:border-cyan-500/30 cursor-pointer"
              >
                <mat-icon class="text-sm">edit</mat-icon>
                <span>Editar</span>
              </button>

              <button
                type="button"
                (click)="askDeleteConfirm(contact)"
                title="Eliminar del fichero"
                class="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <mat-icon class="text-base">delete</mat-icon>
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Standalone Modal Components -->
    <app-contact-form-modal
      [isOpen]="showFormModal()"
      [contactToEdit]="contactToEdit()"
      (closeModal)="closeFormModal()"
      (saveContact)="handleSaveContact($event)"
    />

    <app-contact-delete-modal
      [contact]="contactToDelete()"
      (cancel)="contactToDelete.set(null)"
      (confirm)="confirmDelete($event)"
    />

    <app-raw-json-modal
      [isOpen]="showRawJsonModal()"
      [jsonContent]="rawJsonContent()"
      [fileMeta]="botService.employeesFileMeta()"
      (closeModal)="showRawJsonModal.set(false)"
      (saveRawJson)="handleSaveRawJson($event)"
    />
  `
})
export class ContactsView {
  readonly botService = inject(BotService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly showFormModal = signal<boolean>(false);
  readonly contactToEdit = signal<Contact | null>(null);
  readonly contactToDelete = signal<Contact | null>(null);
  readonly showRawJsonModal = signal<boolean>(false);
  readonly rawJsonContent = signal<string>('');
  readonly toastMessage = signal<string | null>(null);
  readonly isReloading = signal<boolean>(false);

  readonly totalMessages = computed(() => {
    return this.botService.contacts().reduce((acc, c) => acc + c.messagesReceived, 0);
  });

  readonly totalImages = computed(() => {
    return this.botService.contacts().reduce((acc, c) => acc + c.imagesReceived, 0);
  });

  readonly filteredContacts = computed(() => {
    const list = this.botService.contacts();
    const query = this.searchControl.value.toLowerCase().trim();
    if (!query) return list;

    return list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      c.role.toLowerCase().includes(query) ||
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
    this.contactToEdit.set(null);
    this.showFormModal.set(true);
  }

  openEditModal(contact: Contact) {
    this.contactToEdit.set(contact);
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
    this.contactToEdit.set(null);
  }

  async handleSaveContact(data: { id?: string; name: string; phone: string; role: 'Admin' | 'Contacto Autorizado' | 'Usuario Estándar'; notes: string; authorized: boolean }) {
    if (data.id) {
      const existing = this.botService.contacts().find(c => c.id === data.id);
      const updated: Contact = {
        id: data.id,
        name: data.name,
        phone: data.phone,
        role: data.role,
        authorized: data.authorized,
        notes: data.notes,
        avatarUrl: existing?.avatarUrl,
        messagesReceived: existing?.messagesReceived || 0,
        imagesReceived: existing?.imagesReceived || 0,
        lastActive: existing?.lastActive || 'Reciente'
      };
      await this.botService.updateContact(updated);
      this.showToast(`Cambios de "${data.name}" guardados.`);
    } else {
      await this.botService.addContact({
        name: data.name,
        phone: data.phone,
        role: data.role,
        authorized: data.authorized,
        notes: data.notes
      });
      this.showToast(`Empleado "${data.name}" guardado.`);
    }
    this.closeFormModal();
  }

  async toggleAuth(id: string) {
    await this.botService.toggleContactAuthorization(id);
    this.showToast('Permiso de WhatsApp actualizado.');
  }

  askDeleteConfirm(contact: Contact) {
    this.contactToDelete.set(contact);
  }

  async confirmDelete(contact: Contact) {
    await this.botService.deleteContact(contact.id);
    this.showToast(`"${contact.name}" eliminado.`);
    this.contactToDelete.set(null);
  }

  async reloadFile() {
    this.isReloading.set(true);
    await this.botService.reloadEmployeesFromFile();
    setTimeout(() => {
      this.isReloading.set(false);
      this.showToast('Fichero data/employees.json recargado.');
    }, 400);
  }

  openRawJsonModal() {
    const currentList = this.botService.contacts().map(c => ({
      id: c.id,
      nombre: c.name,
      name: c.name,
      telefono: c.phone,
      phone: c.phone,
      activo: c.authorized,
      authorized: c.authorized,
      rol: c.role,
      role: c.role,
      avatarUrl: c.avatarUrl,
      notes: c.notes || '',
      messagesReceived: c.messagesReceived,
      imagesReceived: c.imagesReceived,
      lastActive: c.lastActive
    }));
    this.rawJsonContent.set(JSON.stringify(currentList, null, 2));
    this.showRawJsonModal.set(true);
  }

  async handleSaveRawJson(jsonText: string) {
    const result = await this.botService.saveRawEmployeesJson(jsonText);
    if (result.success) {
      this.showRawJsonModal.set(false);
      this.showToast('Fichero data/employees.json actualizado correctamente.');
    }
  }
}
