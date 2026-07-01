/**
 * NotesApiService — the Angular client for the notesd backend's REST gateway.
 *
 * It calls the JSON/REST surface the devedge-sdk service exposes (the gRPC
 * gateway). Every request goes through Angular's HttpClient, which is
 * registered in AppModule WITH the open-core `bearerAuthInterceptor`
 * (`@infobloxopen/devedge-ufe-angular`). That interceptor reads the token from
 * the shell-owned SessionProvider and attaches `Authorization: Bearer <token>`
 * — this service therefore contains ZERO auth code. The shell owns the session;
 * this uFE just consumes it.
 *
 * The REST shape is exactly what `devedge-sdk new service notesd --resource
 * Note` generates (see backend/openapi/notesd.openapi.yaml). NOTE: the SDK's
 * default Note carries `displayName` + `description` (AIP-standard fields), not
 * `title`/`body`. The gateway serializes fields as camelCase JSON.
 *   - List:   GET  {base}/v1/notes  -> { notes: Note[], nextPageToken }
 *   - Create: POST {base}/v1/notes  (body: the Note)
 * A Note's `name` is the server-assigned resource name (e.g. "notes/abc123").
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, type Observable } from 'rxjs';

import { environment } from '../environments/environment';

/** A Note resource as returned by the notesd REST gateway (camelCase JSON). */
export interface Note {
  /** AIP-122 resource name, server-assigned (e.g. "notes/abc123"). */
  name?: string;
  id?: string;
  displayName: string;
  description: string;
  /** Concurrency token; server-assigned. */
  etag?: string;
}

/** The List response envelope (AIP-158 pagination). */
interface ListNotesResponse {
  notes?: Note[];
  nextPageToken?: string;
}

@Injectable({ providedIn: 'root' })
export class NotesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.notesApiBaseUrl}/v1/notes`;

  /** Lists the caller's tenant-scoped Notes. */
  list(): Observable<Note[]> {
    return this.http
      .get<ListNotesResponse>(this.base)
      .pipe(map((res) => res.notes ?? []));
  }

  /** Creates a Note. The Bearer token is attached by the interceptor. */
  create(note: Pick<Note, 'displayName' | 'description'>): Observable<Note> {
    return this.http.post<Note>(this.base, note);
  }
}
