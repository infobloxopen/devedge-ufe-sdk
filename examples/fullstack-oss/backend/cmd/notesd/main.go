// Command notesd is the STANDALONE host for the NoteService module
// (WS-012 composable services). main() is a HOST, not the service: it owns
// process behavior — flags/env/config, the database connection, observability,
// signal handling — and hands the service's importable github.com/example/notesd/module unit to
// servicekit.Run, which builds the ONE shared server, registers the module, and
// serves under the fail-closed boot gate.
//
// The SAME module also composes into a multi-service "suite" binary by handing it
// (plus others) to servicekit.Run from a different host — no change to the module.
//
// This file is hand-owned (NOT generated). It owns the environment wiring (open
// the DB, migrate, construct the repository, choose the authorizer/principal);
// the module's domain wiring (handler + rules + descriptor + health) lives in the
// importable module/ package. To change service logic, edit the proto + the
// module/ package, not this host.
package main

import (
	"context"
	"flag"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/infobloxopen/devedge-sdk/authz"
	"github.com/infobloxopen/devedge-sdk/authz/grpcauthz"
	"github.com/infobloxopen/devedge-sdk/config"
	"github.com/infobloxopen/devedge-sdk/observability/otel"
	"github.com/infobloxopen/devedge-sdk/persistence"
	"github.com/infobloxopen/devedge-sdk/persistence/gormtx"
	"github.com/infobloxopen/devedge-sdk/servicekit"

	svcmodule "github.com/example/notesd/module"

	notesdv1 "github.com/example/notesd/gen/notesdv1"
)

// version is the service version stamped onto every span/metric (OTel resource
// service.version). Override at build time with -ldflags "-X main.version=...".
var version = "0.0.0-dev"

// newRepository opens the database and returns the generated GORM repository plus
// the underlying *gorm.DB. dsn is the connection string; empty defaults to
// in-memory SQLite (pure-Go, no CGo) so the host runs out of the box — swap the
// dialector for postgres/mysql in production. Opening the DB is HOST process
// behavior; the MIGRATION is run separately, host-owned (see moduleMigrate).
func newRepository(dsn string) (persistence.Repository[*notesdv1.Note, string], *gorm.DB, error) {
	if dsn == "" {
		dsn = "file::memory:?cache=shared"
	}
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, nil, err
	}
	return notesdv1.NewNoteRepository(db), db, nil
}

// moduleMigrate is the HOST's per-module migration runner (WS-012 P2): host-run,
// advisory-locked (Postgres), per-module-namespaced. servicekit.Run calls it once
// per module — BEFORE the module registers — with the module's allocated
// DatabaseNamespace. A standalone single-module host shares its DB with no one, so
// its namespace is a zero (bare-table) namespace and the tables are unqualified,
// exactly as before; the SAME runner namespaces the tables per-module when this
// module is composed into a multi-module "suite" host that shares one database.
//
// A module owns its migration FILES (module/migrations); never runs them from
// init(); never assumes it owns the whole DB. The host runs them here.
func moduleMigrate(db *gorm.DB) servicekit.MigrationRunner {
	return func(ctx context.Context, ns servicekit.DatabaseNamespace, _ servicekit.DatabaseDescriptor) error {
		return gormtx.MigrateModule(ctx, db, gormtx.MigrateOptions{
			Namespace:    ns,
			DomainModels: []any{&notesdv1.NoteModel{}},
			// SQLite (the dev default) needs no advisory lock — one process; Postgres
			// keeps the lock so two hosts booting the same composition serialize.
			SkipAdvisoryLock: db.Dialector.Name() != "postgres",
		})
	}
}

// runHost builds the module over a repo (from dsn) and serves it via
// servicekit.Run, which runs the host-owned migration (moduleMigrate) before the
// module registers, then serves under the fail-closed boot gate. It returns an
// error (rather than exiting) so the smoke test can drive it. ctx owns the serve
// lifetime; the smoke test cancels it to stop.
func runHost(ctx context.Context, authorizer authz.Authorizer, grpcAddr, httpAddr, dsn string) error {
	repo, gormDB, err := newRepository(dsn)
	if err != nil {
		return err
	}
	sqlDB, err := gormDB.DB()
	if err != nil {
		return err
	}
	return servicekit.Run(servicekit.HostConfig{
		Modules:  []servicekit.Module{svcmodule.Module(repo, sqlDB)},
		GRPCAddr: grpcAddr,
		HTTPAddr: httpAddr,
		// Standalone host: this module shares its database with no other, so no
		// HostConfig.Database is set and the module's namespace is zero-qualification
		// (bare tables, unchanged). The migration still runs host-owned (Migrate).
		// When this service is composed into a "suite" host (de compose), THAT host
		// declares a shared engine and each module gets its own schema/prefix — the
		// SAME moduleMigrate runner namespaces accordingly, no module change.
		Migrate: moduleMigrate(gormDB),
		// Derive the caller's authz.Principal from request metadata (account-id ->
		// tenant, groups -> group:<name>). Without it the principal is empty and
		// every call is denied. Swap for a verified-token PrincipalFunc in prod.
		Authorizer:    authorizer,
		PrincipalFunc: grpcauthz.DevPrincipalFunc(),
		Logger:        slog.Default(),
		Context:       ctx,
	})
}

func main() {
	// Graceful shutdown: cancel ctx on SIGTERM (k8s pod termination) or Ctrl-C so
	// servicekit.Run -> server.Serve returns and runs its graceful gRPC/HTTP drain,
	// then the deferred OTel flush runs before exit. The HOST owns signals — a
	// module never installs a handler or calls os.Exit.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	// Configuration — load server options from flags, environment, and .env file.
	// Precedence (highest → lowest): flags > env (NOTESD_*) > .env file > defaults.
	//
	// Key env vars:
	//   NOTESD_GRPC_ADDR   — gRPC listen address  (default :9090)
	//   NOTESD_HTTP_ADDR   — HTTP gateway address  (default :8080)
	//   NOTESD_LOG_LEVEL   — log level             (default info)
	//   NOTESD_OTLP_ENDPOINT — OTel collector      (default: $OTEL_EXPORTER_OTLP_ENDPOINT)
	//   NOTESD_DSN          — database DSN          (default: in-memory sqlite)
	fs := flag.NewFlagSet("notesd", flag.ExitOnError)
	// Register the override flags so config.Flags(fs) can see them. The flag names
	// match the config keys; config.Flags reads only flags explicitly set on the
	// command line, so the documented precedence (flag > env > .env > default)
	// holds. Parse BEFORE config.Load — config.Flags inspects which flags were set.
	fs.String("GRPC_ADDR", "", "gRPC listen address (overrides NOTESD_GRPC_ADDR)")
	fs.String("HTTP_ADDR", "", "HTTP gateway address (overrides NOTESD_HTTP_ADDR)")
	fs.String("LOG_LEVEL", "", "log level: debug/info/warn/error")
	fs.String("OTLP_ENDPOINT", "", "OpenTelemetry collector endpoint")
	fs.String("DSN", "", "database connection string")
	if err := fs.Parse(os.Args[1:]); err != nil {
		log.Fatalf("notesd: flags: %v", err)
	}
	var opts config.ServerOptions
	if err := config.Load(&opts,
		config.Flags(fs),
		config.Env("NOTESD_"),
		config.DotEnv(".env"),
	); err != nil {
		log.Fatalf("notesd: config: %v", err)
	}

	// Observability is wired behind the SDK's OTel seam. otel.Setup installs the
	// global tracer/meter providers + a W3C propagator; the server's built-in
	// otelgrpc/otelhttp instrumentation then emits per-RPC spans + RED metrics and
	// one end-to-end trace across the REST gateway hop, with no per-handler code.
	shutdown, err := otel.Setup(ctx, otel.Config{
		ServiceName:    "notesd",
		ServiceVersion: version,
		OTLPEndpoint:   opts.OTLPEndpoint,
	})
	if err != nil {
		log.Fatalf("notesd: observability: %v", err)
	}
	defer func() {
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = shutdown(sctx)
	}()

	// Dev authorizer: grants the "admin" group every verb on every resource in any
	// tenant. Paired with grpcauthz.DevPrincipalFunc (wired in runHost), a caller
	// is authorized when it sends `account-id: <tenant>` and `groups: admin`; anyone
	// else fails closed (PermissionDenied). Replace BOTH the grant and the
	// PrincipalFunc with a real policy + verified-token func in production.
	authorizer := authz.NewDevAuthorizer(authz.Grant{
		Tenant:   "*",
		Subjects: []string{"group:admin"},
		Verbs:    []authz.Verb{"*"},
		Resource: "*",
	})
	log.Printf("notesd: serving gRPC on %s, HTTP on %s", opts.GRPCAddr, opts.HTTPAddr)
	if err := runHost(ctx, authorizer, opts.GRPCAddr, opts.HTTPAddr, opts.DSN); err != nil {
		log.Fatalf("notesd: serve: %v", err)
	}
}
