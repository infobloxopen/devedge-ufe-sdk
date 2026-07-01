/**
 * NotesApiService — a thin Angular facade over the GENERATED notesd client
 * (`@example/notesd-client`, produced by `apx client generate` from the backend
 * OpenAPI spec). This service NO LONGER hand-writes the REST calls or the
 * `Note`/`ListNotesResponse` types — it delegates to the generated functional
 * operations and re-exports the generated models.
 *
 * Auth is unchanged and still out-of-band: the generated operations take
 * Angular's `HttpClient` (we pass the injected one), and that HttpClient is
 * registered in AppModule WITH the open-core `bearerAuthInterceptor`
 * (`@infobloxopen/devedge-ufe-angular`). Because the generated client rides the
 * SAME HttpClient, the interceptor attaches `Authorization: Bearer <token>` to
 * every generated request automatically — this service still contains ZERO auth
 * code. The shell owns the session; this uFE just consumes it.
 *
 * Base URL: the generated `ApiConfiguration.rootUrl` is set from
 * `environment.notesApiBaseUrl` via the generated `provideApiConfiguration`
 * helper (see AppModule). The generated operation paths (e.g. `/v1/notes`) are
 * appended to it.
 *
 * The generated surface (see clients/notesd-client):
 *   - noteServiceListNotes(http, rootUrl, params?) -> V1ListNotesResponse
 *   - noteServiceCreateNote(http, rootUrl, { body }) -> V1Note
 * A Note's `name` is the server-assigned resource name (e.g. "notes/abc123").
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { map, type Observable } from 'rxjs';

import {
  ApiConfiguration,
  noteServiceListNotes,
  noteServiceCreateNote,
  type V1Note,
  type V1ListNotesResponse,
} from '@example/notesd-client';

/**
 * Re-export the generated models under the names the rest of the uFE already
 * uses. `Note` is the generated `V1Note`; components import `Note` from here so
 * they stay decoupled from the generated symbol names.
 */
export type Note = V1Note;
export type ListNotesResponse = V1ListNotesResponse;

@Injectable({ providedIn: 'root' })
export class NotesApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ApiConfiguration);

  private get rootUrl(): string {
    return this.config.rootUrl;
  }

  /** Lists the caller's tenant-scoped Notes. */
  list(): Observable<Note[]> {
    return noteServiceListNotes(this.http, this.rootUrl).pipe(
      map((res: HttpResponse<V1ListNotesResponse>) => res.body?.notes ?? []),
    );
  }

  /** Creates a Note. The Bearer token is attached by the interceptor. */
  create(note: Pick<Note, 'displayName' | 'description'>): Observable<Note> {
    return noteServiceCreateNote(this.http, this.rootUrl, { body: note }).pipe(
      map((res: HttpResponse<V1Note>) => res.body as V1Note),
    );
  }
}
