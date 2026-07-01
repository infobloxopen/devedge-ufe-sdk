/**
 * The Notes landing view rendered at the app's route ('notes-ufe').
 *
 * It lists Notes from the notesd backend and creates new ones through the
 * NotesApiService. Both operations ride HttpClient, so the shell-owned Bearer
 * token is attached automatically by the open-core bearerAuthInterceptor — this
 * component has no auth code. UI is Angular Material (the OSS example design
 * system): a list of notes plus a small create form.
 *
 * A Note's user-facing fields are `displayName` and `description` — the
 * AIP-standard fields the SDK's default Note resource generates.
 */
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

import { NotesApiService, type Note } from './notes.service';

@Component({
  selector: 'notes-ufe-home',
  template: `
    <section class="notes">
      <form class="notes__form" [formGroup]="form" (ngSubmit)="onCreate()">
        <mat-form-field appearance="fill">
          <mat-label>Title</mat-label>
          <input matInput formControlName="displayName" placeholder="A short title" />
        </mat-form-field>
        <mat-form-field appearance="fill">
          <mat-label>Body</mat-label>
          <textarea matInput formControlName="description" placeholder="Note body"></textarea>
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
          {{ saving ? 'Saving…' : 'Add note' }}
        </button>
      </form>

      <p *ngIf="error" class="notes__error">{{ error }}</p>

      <mat-list class="notes__list">
        <mat-list-item *ngFor="let n of notes">
          <span matListItemTitle>{{ n.displayName }}</span>
          <span matListItemLine>{{ n.description }}</span>
        </mat-list-item>
        <p *ngIf="!loading && notes.length === 0" class="notes__empty">No notes yet.</p>
      </mat-list>
    </section>
  `,
})
export class HomeComponent implements OnInit {
  private readonly api = inject(NotesApiService);
  private readonly fb = inject(FormBuilder);

  notes: Note[] = [];
  loading = false;
  saving = false;
  error = '';

  readonly form = this.fb.nonNullable.group({
    displayName: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.api.list().subscribe({
      next: (notes) => {
        this.notes = notes;
        this.loading = false;
      },
      error: (err: unknown) => {
        this.error = `Failed to load notes: ${describe(err)}`;
        this.loading = false;
      },
    });
  }

  onCreate(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = '';
    this.api.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset({ displayName: '', description: '' });
        this.saving = false;
        this.refresh();
      },
      error: (err: unknown) => {
        this.error = `Failed to create note: ${describe(err)}`;
        this.saving = false;
      },
    });
  }
}

function describe(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}
