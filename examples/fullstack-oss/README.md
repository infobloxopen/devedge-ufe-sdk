# Full-stack example (OSS flavor)

One developer, both halves of a feature: a backend service on
[`devedge-sdk`](https://github.com/infobloxopen/devedge-sdk) and a micro-frontend
on [`devedge-ufe-sdk`](https://github.com/infobloxopen/devedge-ufe-sdk) that
consumes it.

This is the **open-source flavor**: generic OIDC (any issuer — Dex in dev) and
Angular Material, with **zero Infoblox-proprietary dependencies**. The
Infoblox-CTO flavor (PDS design system + Okta) lives in the private
`Infoblox-CTO/devedge-ufe-sdk-internal` repo and binds on top of these same
seams, exactly like `opaauthz` binds to `authz.Authorizer` in the backend SDK.

## What you build

- **`backend/`** — `notesd`, a small CRUD service for a tenant-scoped `Note`
  resource, scaffolded by the devedge-sdk CLI. It serves gRPC plus a REST/JSON
  gateway.
- **`frontend/notes-ufe/`** — an Angular 15 + single-spa micro-frontend
  scaffolded by `de ufe new`. It lists and creates Notes through the backend's
  REST gateway, carrying the shell-owned Bearer token on every request.

The point of the example is the **frontend-to-backend loop** and the
**shell-owns-session** boundary — not custom methods. The resource is pure CRUD.

## The load-bearing rule: the shell owns the session; the uFE never authenticates

The **shell** instantiates the OIDC `SessionProvider` once and threads it into
the uFE as a prop. The uFE receives only the read-only session view — it reads
the token, reads claims, and requests login/logout, but it never constructs a
session or reaches the identity provider. The standalone shell in
`frontend/notes-ufe/src/shell/main.ts` shows exactly where that boundary lives.

---

## 1. Scaffold and build the backend

The backend needs `devedge-sdk`, `apx`, and `buf` on your PATH.

```sh
go install github.com/infobloxopen/devedge-sdk/cmd/devedge-sdk@v0.43.0

cd examples/fullstack-oss
devedge-sdk new service notesd \
  --resource Note --backend gorm --module github.com/example/notesd --dir backend

cd backend
make generate    # buf generate + go mod tidy
make build       # go build ./...
make test        # go test ./...
```

All three gates pass with no hand-edits. The generated `Note` is tenant-scoped,
has an AIP-122 resource `name`, an `etag`, and soft-delete. Its user-facing
fields are `displayName` and `description` — the AIP-standard fields the SDK's
default resource generates (not `title`/`body`).

### The REST surface the frontend calls

The gateway serves JSON on `:8080` (gRPC on `:9090`). Fields are camelCase.

| Operation | Method + path        | Body / response                         |
|-----------|----------------------|-----------------------------------------|
| List      | `GET /v1/notes`      | `{ "notes": [Note], "nextPageToken" }`  |
| Create    | `POST /v1/notes`     | body: `{ "displayName", "description" }` |

A `Note` in JSON: `{ name, id, displayName, description, etag }` (`name`, `id`,
and `etag` are server-assigned).

The dev authorizer is **fail-closed**: REST calls must carry tenant/identity
headers (`account-id`, `groups`) or the service returns `PermissionDenied`. See
the backend's own `README.md` for running it locally with a database.

---

## 2. Scaffold the frontend

Build the `de` binary from the devedge repo, then scaffold the uFE:

```sh
# from a checkout of infobloxopen/devedge
go build -o /tmp/de ./cmd/de

# from examples/fullstack-oss
/tmp/de ufe new notes-ufe --dir frontend
```

The generated uFE is correct on first run: its default nav group validates, its
route matches the manifest, the session is provided into Angular DI, and HTTP
calls carry the Bearer token. See `frontend/notes-ufe/README.md` for the
scaffold's own guarantees.

### Point the SDK deps at the local packages

Until the `@infobloxopen/devedge-ufe-*` packages are published to npm, the
example references them by local path. `frontend/notes-ufe/package.json` already
does this:

```json
"@infobloxopen/devedge-ufe-core": "file:../../../../packages/core",
"@infobloxopen/devedge-ufe-angular": "file:../../../../packages/angular",
"@infobloxopen/devedge-ufe-single-spa": "file:../../../../packages/single-spa",
"@infobloxopen/devedge-ufe-oidc": "file:../../../../packages/oidc",
"@infobloxopen/devedge-ufe-dev-loop": "file:../../../../packages/dev-loop"
```

Build the SDK packages once (they ship `.d.ts`), then install the frontend as
its own project:

```sh
# from the SDK repo root — build the local packages
pnpm install
pnpm -r --filter './packages/*' run build

# from frontend/notes-ufe — install independently of the SDK workspace
cd examples/fullstack-oss/frontend/notes-ufe
pnpm install --ignore-workspace
```

`--ignore-workspace` keeps the frontend out of the SDK's pnpm workspace, so the
SDK's own CI (which builds `./packages/*`) never sees the example. **In
production you install these from npm** once published; the `file:` paths are a
local-development convenience only.

> **Why the `pnpm.overrides` block in `package.json`?** The local SDK packages
> declare their internal dependency on `-core` as `workspace:*`. Outside the
> SDK's own pnpm workspace, that specifier cannot resolve, so the example
> overrides it to the same local path. When you install from npm the override is
> unnecessary — drop it.

---

## 3. Configure OIDC and the backend base URL

Both live in `frontend/notes-ufe/src/environments/environment.ts`:

- **`oidc`** — a generic OIDC client config (`authority`, `clientId`,
  `redirectUri`, `silentRedirectUri`, `scope`). The default `authority` points
  at a local Dex issuer (`http://localhost:5556/dex`). **Point it at any OIDC
  issuer** by changing `authority` and `clientId`. Nothing here is
  provider-specific.
- **`notesApiBaseUrl`** — the base URL of the notesd REST gateway
  (`http://localhost:8080` in dev).

---

## 4. How the shell owns the session, and the uFE consumes it

`frontend/notes-ufe/src/shell/main.ts` is a tiny standalone shell that plays the
host role. It does three things a uFE must never do:

1. **Instantiates the `OidcSessionProvider` once** from the generic `oidc`
   config, and completes the auth-code / silent-renew redirects on `/callback`
   and `/silent-refresh`.
2. **Owns the nav-group taxonomy.** It builds a `GroupRegistry` and runs
   `assertNavContributions(...)` against the uFE's manifest, so a wrong nav
   group fails **loud** at startup instead of silently rendering nothing.
3. **Registers the uFE with `createShell`**, which awaits `session.getToken()`
   before any uFE mounts — proving the shell holds a session — then threads
   `session` into the uFE as a `HostProps` prop.

The uFE side:

- `src/main.ufe.ts` binds the shell-supplied `props.session` to the
  `SESSION_PROVIDER` DI token.
- `src/app/app.module.ts` registers `HttpClient` with the open-core
  `bearerAuthInterceptor`, so every request carries `Authorization: Bearer
  <token>` with no per-app auth code.
- `src/app/notes.service.ts` calls the backend's REST API; `src/app/home.component.ts`
  renders the notes as an Angular Material list plus a create form.
- `src/metadata.ts` contributes a **validated** nav item (its group is checked
  against a dev `GroupRegistry` at import time).

---

## 5. Run the dev loop

```sh
cd examples/fullstack-oss/frontend/notes-ufe
pnpm start                 # ng serve on https://localhost:4200
pnpm run doctor            # loud checklist: reachability → cert → CORS → manifest → nav
```

`doctor` turns the usual chain of silent micro-frontend failures into an ordered
checklist and reports the first failing step with an actionable message.

**The cert-trust gotcha.** A self-signed dev cert makes a shell fail to load the
uFE **silently**. `doctor` isolates it as its own step. Fix it by trusting the
cert (add it to your keychain, or set `NODE_EXTRA_CA_CERTS` to its path), or
serve plain `http` for local dev. This is the single most common silent failure
the dev loop catches.

To point a running shell at your local bundle, use the import-map override:

```ts
import { override } from '@infobloxopen/devedge-ufe-dev-loop';
override('notes-ufe', 'https://localhost:4200/main.js');
```

> **Toolchain note.** The generated uFE targets Angular 15 (TypeScript ~4.9). A
> full `ng build` may not run cleanly under a very new Node; the type surface,
> however, checks against the SDK's shipped `.d.ts`. See "Verifying the example"
> below for what runs standalone.

---

## 6. Run against a real OIDC issuer and a real backend

- **Real OIDC issuer:** set `environment.oidc.authority` to your issuer's URL
  and `clientId` to a client registered there with the redirect URIs
  `…/callback` and `…/silent-refresh`. No code changes — the OIDC binding is
  generic.
- **Real backend:** set `environment.notesApiBaseUrl` to the deployed gateway's
  base URL (or a same-origin `/api` prefix behind your ingress). The
  `bearerAuthInterceptor` already attaches the token from the shell session.
- **Real shell:** replace the example shell with your host. It supplies the
  authoritative `GroupRegistry` and threads its own `SessionProvider` into the
  uFE — the uFE code does not change.

---

## Verifying the example

The example is self-contained and verified apart from the SDK's own CI:

- **Backend:** `make generate && make build && make test` — all green.
- **Frontend:** build the local SDK packages, `pnpm install --ignore-workspace`,
  then `pnpm run typecheck` (`tsc --noEmit`) over `src/`. The API service, the
  shell wiring, and the validated manifest type-check against the SDK's `.d.ts`.

The example is **not** part of the SDK's pnpm workspace (see the root
`pnpm-workspace.yaml`), so it never affects the SDK's package build or CI.
