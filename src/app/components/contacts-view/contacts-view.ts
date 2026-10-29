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
            class="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 font-medium text-xs flex items-center gap-2 transition-all active:scale-95"
          >
            <mat-icon class="text-base text-cyan-400">code</mat-icon>
            <span>Ver Fichero JSON</span>
          </button>

          <button
            type="button"
            (click)="reloadFile()"
            title="Recargar desde fichero en disco"
            class="p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border border-white/10 transition-all active:scale-95"
          >
            <mat-icon class="text-base" [class.animate-spin]="isReloading()">refresh</mat-icon>
          </button>

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

      <!-- Persistent Storage File Banner (Fluid Glass Ribbon) -->
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
              Todos los cambios en esta lista se escriben inmediatamente al archivo físico en el servidor. ChronoBot nunca usa arrays mockeados.
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

      <!-- Fluid Telemetry Wave (Zero Box Borders) -->
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

      <!-- Search Toolbar (Fluid Glass Ribbon) -->
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
          {{ filteredContacts().length }} de {{ botService.contacts().length }} empleados guardados en data/employees.json
        </span>
      </div>

      <!-- Fluid Floating Contacts Stream (No Box Borders) -->
      <div class="space-y-3.5">
        @for (contact of filteredContacts(); track contact.id) {
          <div class="p-5 rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-3xl border border-white/5 hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_15px_35px_rgba(6,182,212,0.15)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <!-- Left: Avatar & Identity -->
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

            <!-- Right: Activity Stats, Edit, Switch & Delete Actions -->
            <div class="flex items-center gap-4 sm:gap-6 self-end md:self-center shrink-0 flex-wrap">
              <!-- Counters -->
              <div class="text-right hidden sm:block">
                <span class="text-xs font-mono font-bold text-white block">{{ contact.messagesReceived }} msgs · {{ contact.imagesReceived }} fotos</span>
                <span class="text-[10px] text-slate-400 font-mono">{{ contact.lastActive }}</span>
              </div>

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
                title="Editar empleado en data/employees.json"
                class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 text-xs transition-colors border border-white/5 hover:border-cyan-500/30"
              >
                <mat-icon class="text-sm">edit</mat-icon>
                <span>Editar</span>
              </button>

              <!-- Delete Button -->
              <button
                type="button"
                (click)="askDeleteConfirm(contact)"
                title="Eliminar del fichero data/employees.json"
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
      <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6">
        <div class="bg-[#0e1422]/90 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-[0_0_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between pb-4 border-b border-white/5">
            <div class="flex items-center gap-2">
              <mat-icon class="text-cyan-400 text-lg">person_add</mat-icon>
              <h3 class="text-base font-bold text-white">Añadir empleado al fichero</h3>
            </div>
            <button type="button" (click)="closeAddModal()" class="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
              <mat-icon class="text-base">close</mat-icon>
            </button>
          </div>

          <p class="text-xs text-slate-400 mt-3">
            Se registrará directamente en <span class="text-cyan-300 font-mono">data/employees.json</span> y quedará activo para WhatsApp.
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
                placeholder="+52155..."
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label for="contact-role" class="block text-xs font-semibold text-slate-300 mb-1.5">Rol / Privilegios</label>
              <select
                id="contact-role"
                formControlName="role"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
              >
                <option value="Contacto Autorizado">Contacto Autorizado</option>
                <option value="Admin">Admin</option>
                <option value="Usuario Estándar">Usuario Estándar</option>
              </select>
            </div>

            <div>
              <label for="contact-notes" class="block text-xs font-semibold text-slate-300 mb-1.5">Notas / Cargo</label>
              <input
                id="contact-notes"
                type="text"
                formControlName="notes"
                placeholder="Ej. Supervisor de turno vespertino"
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
                Guardar en fichero
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
            Modificando registro en <span class="text-cyan-300 font-mono">data/employees.json</span>.
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
              <label for="edit-role" class="block text-xs font-semibold text-slate-300 mb-1.5">Rol / Privilegios</label>
              <select
                id="edit-role"
                formControlName="role"
                class="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
              >
                <option value="Contacto Autorizado">Contacto Autorizado</option>
                <option value="Admin">Admin</option>
                <option value="Usuario Estándar">Usuario Estándar</option>
              </select>
            </div>

            <div>
              <label for="edit-notes" class="block text-xs font-semibold text-slate-300 mb-1.5">Notas / Cargo</label>
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
                Guardar cambios en disco
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Fluid Glass Delete Confirmation Modal -->
    @if (contactToDelete()) {
      <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6">
        <div class="bg-[#0e1422]/90 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 shadow-[0_0_100px_rgba(244,63,94,0.3)] backdrop-blur-3xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 pb-3 border-b border-white/5 text-rose-400">
            <mat-icon class="text-2xl">warning</mat-icon>
            <h3 class="text-base font-bold text-white">¿Eliminar empleado?</h3>
          </div>

          <p class="text-xs text-slate-300 mt-4 leading-relaxed">
            Se eliminará permanentemente a <strong class="text-white">{{ contactToDelete()?.name }}</strong> ({{ contactToDelete()?.phone }}) del fichero físico <span class="text-rose-300 font-mono">data/employees.json</span>.
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
              Sí, eliminar del fichero
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Fluid Glass Raw JSON File Viewer / Editor Modal -->
    @if (showRawJsonModal()) {
      <div class="fixed inset-0 z-50 bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
        <div class="bg-[#0c1220]/95 border border-cyan-500/30 rounded-3xl max-w-3xl w-full p-6 shadow-[0_0_120px_rgba(6,182,212,0.3)] backdrop-blur-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div class="flex items-center gap-3">
              <mat-icon class="text-cyan-400 text-xl">description</mat-icon>
              <div>
                <h3 class="text-base font-bold text-white">Fichero: data/employees.json</h3>
                <p class="text-[11px] text-slate-400">Contenido persistido en el sistema de archivos del servidor</p>
              </div>
            </div>
            <button type="button" (click)="closeRawJsonModal()" class="w-8 h-8 rounded-xl bg-white/5 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
              <mat-icon class="text-base">close</mat-icon>
            </button>
          </div>

          <div class="py-4 space-y-3 flex-1 flex flex-col min-h-0">
            <div class="flex items-center justify-between text-xs text-slate-400">
              <span>Edición directa de registros JSON:</span>
              <button
                type="button"
                (click)="copyJsonToClipboard()"
                class="hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
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
              {{ botService.employeesFileMeta().sizeBytes }} bytes · {{ botService.employeesFileMeta().employeesCount }} items
            </span>

            <div class="flex items-center gap-3">
              <button
                type="button"
                (click)="closeRawJsonModal()"
                class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                Cerrar
              </button>
              <button
                type="button"
                (click)="submitRawJson()"
                class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
              >
                Guardar fichero en servidor
              </button>
            </div>
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
  readonly showRawJsonModal = signal<boolean>(false);
  readonly contactToDelete = signal<Contact | null>(null);
  readonly toastMessage = signal<string | null>(null);
  readonly isReloading = signal<boolean>(false);
  readonly copied = signal<boolean>(false);
  readonly jsonError = signal<string | null>(null);

  readonly contactForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('+52', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    role: new FormControl<'Admin' | 'Contacto Autorizado' | 'Usuario Estándar'>('Contacto Autorizado', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true })
  });

  readonly editForm = new FormGroup({
    id: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    role: new FormControl<'Admin' | 'Contacto Autorizado' | 'Usuario Estándar'>('Contacto Autorizado', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    authorized: new FormControl(true, { nonNullable: true })
  });

  readonly rawJsonControl = new FormControl('', { nonNullable: true });

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
    this.contactForm.reset({
      name: '',
      phone: '+52',
      role: 'Contacto Autorizado',
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
      role: formVal.role,
      authorized: true,
      notes: formVal.notes
    });

    this.closeAddModal();
    this.showToast(`Empleado "${formVal.name}" guardado en data/employees.json`);
  }

  openEditModal(contact: Contact) {
    this.editForm.setValue({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      role: contact.role,
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

    const existing = this.botService.contacts().find(c => c.id === formVal.id);
    const updated: Contact = {
      id: formVal.id,
      name: formVal.name,
      phone: formVal.phone,
      role: formVal.role,
      authorized: formVal.authorized,
      notes: formVal.notes,
      avatarUrl: existing?.avatarUrl,
      messagesReceived: existing?.messagesReceived || 0,
      imagesReceived: existing?.imagesReceived || 0,
      lastActive: existing?.lastActive || 'Reciente'
    };

    await this.botService.updateContact(updated);
    this.closeEditModal();
    this.showToast(`Cambios de "${updated.name}" guardados en data/employees.json`);
  }

  async toggleAuth(id: string) {
    await this.botService.toggleContactAuthorization(id);
    this.showToast('Permiso de WhatsApp actualizado y guardado en disco.');
  }

  askDeleteConfirm(contact: Contact) {
    this.contactToDelete.set(contact);
  }

  async confirmDelete() {
    const contact = this.contactToDelete();
    if (contact) {
      await this.botService.deleteContact(contact.id);
      this.showToast(`"${contact.name}" eliminado de data/employees.json`);
    }
    this.contactToDelete.set(null);
  }

  async reloadFile() {
    this.isReloading.set(true);
    await this.botService.reloadEmployeesFromFile();
    setTimeout(() => {
      this.isReloading.set(false);
      this.showToast('Fichero data/employees.json recargado con éxito.');
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
    this.rawJsonControl.setValue(JSON.stringify(currentList, null, 2));
    this.jsonError.set(null);
    this.showRawJsonModal.set(true);
  }

  closeRawJsonModal() {
    this.showRawJsonModal.set(false);
  }

  async submitRawJson() {
    const text = this.rawJsonControl.value.trim();
    this.jsonError.set(null);
    try {
      JSON.parse(text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'JSON inválido';
      this.jsonError.set(`Error de sintaxis: ${msg}`);
      return;
    }

    const result = await this.botService.saveRawEmployeesJson(text);
    if (result.success) {
      this.closeRawJsonModal();
      this.showToast('Fichero data/employees.json sobrescrito y sincronizado correctamente.');
    } else {
      this.jsonError.set(result.error || 'Error al guardar en el servidor');
    }
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
