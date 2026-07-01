.PHONY: tools generate bootstrap build test run api-lint api-breaking api-release

# SDK version that supplies the codegen plugins. go.mod is the SINGLE SOURCE OF
# TRUTH: this resolves to the `github.com/infobloxopen/devedge-sdk` require in
# go.mod at make-time, so `make tools` can never install plugins that disagree
# with the project's own SDK dependency. Bump the SDK by editing go.mod (e.g.
# `go get github.com/infobloxopen/devedge-sdk@vX.Y.Z`), then `make tools`.
# The fallback (the version this project was scaffolded with) is used only when
# `go list` can't resolve it yet — e.g. before `go mod download` on a fresh clone.
SDK_VERSION ?= $(shell go list -m -f '{{.Version}}' github.com/infobloxopen/devedge-sdk 2>/dev/null || echo v0.43.0)

# Install the protoc plugins `buf generate` needs onto PATH (GOPATH/bin), and
# provision spectral for `apx lint`:
#   - the SDK plugins, pinned to SDK_VERSION;
#   - the public plugins from their canonical modules;
#   - spectral — a Node tool `apx lint` shells out to for the OpenAPI surface.
#     apx auto-downloads buf/oasdiff but NOT spectral, so `make tools` installs it
#     via npm (best-effort: `make bootstrap` still succeeds without npm, and
#     `make api-lint` prints a hint if it is missing).
tools:
	go install github.com/infobloxopen/devedge-sdk/cmd/protoc-gen-devedge-authz@$(SDK_VERSION)
	go install github.com/infobloxopen/devedge-sdk/cmd/protoc-gen-svc@$(SDK_VERSION)
	go install github.com/infobloxopen/devedge-sdk/cmd/protoc-gen-storage@$(SDK_VERSION)
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest
	go install github.com/infobloxopen/devedge-sdk/cmd/openapiv2to3@$(SDK_VERSION)
	@if command -v spectral >/dev/null 2>&1; then \
		echo "  spectral present: $$(command -v spectral)"; \
	elif command -v npm >/dev/null 2>&1; then \
		echo "  installing spectral (apx lint's OpenAPI linter) via npm…"; \
		npm install -g @stoplight/spectral-cli || echo "  WARN: spectral install failed — run 'npm install -g @stoplight/spectral-cli' before 'make api-lint'"; \
	else \
		echo "  NOTE: spectral not found and npm unavailable. 'make api-lint' lints the generated OpenAPI"; \
		echo "        surface with spectral (apx auto-downloads buf/oasdiff but not spectral). Install"; \
		echo "        Node.js, then 'npm install -g @stoplight/spectral-cli'."; \
	fi

# Generate the consumer-local implementation (models, repository, service
# scaffolding, authz rules, gateway) from the public proto. Output is git-ignored.
# The guarded `buf dep update` locks the googleapis deps (google/api/*) the proto
# imports if no buf.lock exists yet — self-heals a tree scaffolded with
# `--no-generate` (a bare `buf generate` there fails with `import
# "google/api/annotations.proto": file does not exist`). A committed buf.lock is
# left untouched, so reproducibility is preserved.
generate:
	@test -f buf.lock || buf dep update
	buf generate
	openapiv2to3 openapi/notesd.swagger.json openapi
	go mod tidy

# bootstrap is the one-command fresh-clone setup: install the plugins, then
# generate the consumer-local code that gen/ holds (gen/ is git-ignored, so a
# clone has none — `go build` would fail with "no required module provides
# package .../gen/..." until this runs). README points new clones here.
bootstrap: tools generate

# build/test require the generated code. gen/ is git-ignored, so on a fresh clone
# it is absent and `go build` fails; this order-only prerequisite generates it
# once. After that gen/ exists and the prerequisite is satisfied immediately, so
# the happy path stays fast (no regenerate on every build). Run `make generate`
# explicitly after editing the proto.
gen:
	@test -d gen || $(MAKE) bootstrap

build: | gen
	go build ./...

test: | gen
	go test ./...

# Run the service locally. Observability is on by default behind the OTel seam:
# export the standard OTEL_* env to ship traces + RED metrics to a collector (no
# code change), e.g. `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 make run`.
# With no endpoint set the exporter no-ops, so this runs with zero overhead.
run: | gen
	go run ./cmd/notesd

# apx governs the PUBLIC proto surface. Run these locally BEFORE pushing — CI runs
# the same gates (see .github/workflows/apx-release.yml).
#
#   api-lint     STANDARD lint of the public proto.
#   api-breaking compatibility check vs the last committed proto (HEAD): catches an
#                accidental breaking change before it lands. Requires an initialized
#                git repo with at least one commit; run `git init && git add . &&
#                git commit -m "initial"` first if this is a fresh scaffold. After
#                that, with no prior API tag, it passes. Once released, compare
#                against the released tag instead.
#   api-release  prepare a versioned release of the public API. NOTE: this emits a
#                NON-FATAL go_package mismatch warning ("got .../gen/notesdv1,
#                expected .../proto/notesd/v1"). It is EXPECTED and
#                HARMLESS: the scaffold's generated Go must be a single directory
#                segment under gen/ so the sibling ent/ package compiles, which is
#                not the <module>/<api-id> layout apx derives by default. The
#                command exits 0. Do NOT add --strict, which would turn it fatal.
api-lint:
	@command -v spectral >/dev/null 2>&1 || echo "note: 'apx lint' lints the OpenAPI surface with spectral — 'make tools' provisions it (needs npm), or run 'npm install -g @stoplight/spectral-cli'."
	apx lint

# NOTE: when there ARE violations, apx itself prints the buf violation list twice
# (once raw, once in its summary). That double-print is apx's own output, not this
# single invocation — nothing to fix here.
api-breaking:
	@if ! git rev-parse --git-dir > /dev/null 2>&1 || ! git rev-parse HEAD > /dev/null 2>&1; then \
		echo "api-breaking requires a git repo with at least one commit."; \
		echo "Run: git init && git add . && git commit -m \"initial\""; \
		exit 1; \
	fi
	apx breaking --against HEAD

# The api-id is the proto's path under the module root (module_roots: [proto]).
api-release:
	apx release prepare proto/notesd/v1 --version v1.0.0-alpha.1 --lifecycle experimental

# Build the container image LOCALLY with ko (distroless, static — NO Dockerfile) and
# load it into your Docker daemon. CI publishes the SAME image to GHCR on merge to
# main via .github/workflows/image.yml. DOCKER_HOST is auto-detected from the active
# docker context (Docker Desktop, Rancher Desktop, colima, and plain Linux all use
# different socket paths), so the local ko build finds the daemon with no manual setup.
# Default KO_DOCKER_REPO=ko.local loads the image into the local daemon; override it
# to PUSH instead: KO_DOCKER_REPO=ghcr.io/you/svc make image
.PHONY: image
KO_DEFAULTBASEIMAGE ?= gcr.io/distroless/static-debian12:nonroot
image: | gen
	@command -v ko >/dev/null 2>&1 || go install github.com/google/ko@latest
	DOCKER_HOST="$${DOCKER_HOST:-$$(docker context inspect --format '{{ .Endpoints.docker.Host }}' 2>/dev/null)}" \
	GOFLAGS=-trimpath \
	KO_DEFAULTBASEIMAGE="$(KO_DEFAULTBASEIMAGE)" \
	KO_DOCKER_REPO="$${KO_DOCKER_REPO:-ko.local}" \
	ko build --bare ./cmd/notesd
