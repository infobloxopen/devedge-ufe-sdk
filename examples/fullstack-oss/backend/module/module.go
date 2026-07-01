// Package module is the importable, composable unit for the notesd service
// (WS-012 composable services). It wraps the GENERATED servicekit.Module —
// notesdv1.NoteServiceModule, whose Descriptor is the proto facts and
// whose Register wires the generated CRUD handler onto a shared server — and adds
// the hand-written extras a host can't derive from the proto (here: the DB
// readiness check).
//
// The SAME module runs two ways with no code change:
//   - standalone: cmd/notesd/main.go opens the DB, builds the repo, and
//     hands this module to servicekit.Run as the only module;
//   - composed: a "suite" host (de compose, later phase) hands several modules —
//     including this one — to servicekit.Run, sharing one server + one process.
//
// "Module owns domain, host owns process": this package owns the service's domain
// wiring (its repository binding, its health check, its descriptor). It does NOT
// open the database, parse flags/env, start listeners, install signal handlers,
// or call os.Exit — those are the HOST's job (cmd/notesd/main.go).
package module

import (
	"context"
	"embed"
	"io/fs"

	sdkhealth "github.com/infobloxopen/devedge-sdk/health"
	"github.com/infobloxopen/devedge-sdk/persistence"
	"github.com/infobloxopen/devedge-sdk/servicekit"

	notesdv1 "github.com/example/notesd/gen/notesdv1"
)

// migrationsFS is the module's embedded migration files (WS-012: a module owns its
// migration FILES; the HOST runs them — host-run, advisory-locked,
// per-module-namespaced). The host's moduleMigrate runner (cmd/notesd/main.go)
// runs them via gormtx.MigrateModule. This embed is the seam that runner reads; the
// placeholder keeps `go:embed` valid until the first migration file lands.
//
//go:embed migrations
var migrationsFS embed.FS

// Migrations returns the module's embedded migrations filesystem (rooted at the
// migrations/ dir), for the later host-run migrator (servicekit.MigrationsFS).
func Migrations() fs.FS {
	sub, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		// The migrations dir is embedded at build time, so this cannot fail; return
		// the whole FS rather than panic in a library.
		return migrationsFS
	}
	return sub
}

// Module returns the importable servicekit.Module for notesd, bound to repo
// (the domain repository) and sqlDB (used for the DB readiness check). A host
// registers the returned module on a shared server — standalone or composed.
//
// Growing past pure CRUD: the generated NoteServiceModuleOptions exposes a
// Handler override seam. When you add a custom or non-CRUD RPC to the proto (say
// a Checkout method), the generated CRUD handler leaves it Unimplemented — so
// implement it IN PLACE by embedding the generated handler and setting Handler
// below, instead of hand-rolling a separate servicekit.Module. See
// newNoteHandler (commented below) and the "custom methods" how-to.
func Module(repo persistence.Repository[*notesdv1.Note, string], sqlDB sdkhealth.Pinger) servicekit.Module {
	return &notesdModule{
		inner: notesdv1.NoteServiceModule(notesdv1.NoteServiceModuleOptions{
			Repo: repo,
			// Custom / non-CRUD methods? Override in place — see the recipe below:
			//   Handler: newNoteHandler(repo),
		}),
		db: sqlDB,
	}
}

// Custom methods — grow in place. When the proto adds an RPC that is NOT an AIP
// standard method, the generated CRUD handler leaves it Unimplemented. Implement
// it by embedding the generated handler (so CRUD keeps working) and overriding
// just the new method, then wire your handler via the Handler option in Module
// above. This keeps everything on the generated module — no forked
// servicekit.Module. Uncomment and fill in when you add your first custom RPC:
//
//	type noteHandler struct {
//		*notesdv1.NoteServiceCRUDHandler // default CRUD stays intact
//	}
//
//	func newNoteHandler(repo persistence.Repository[*notesdv1.Note, string]) *noteHandler {
//		return &noteHandler{ notesdv1.NewNoteServiceHandler(repo) }
//	}
//
//	// func (h *noteHandler) CheckoutNote(ctx context.Context, req *notesdv1.CheckoutNoteRequest) (*notesdv1.Note, error) {
//	// 	// ... custom logic; h.Repo is the embedded CRUD handler's repository ...
//	// }
//
// A second resource with its own service gets its own generated module — compose
// both by handing the host several modules (see the composable-services how-to).

// notesdModule decorates the generated module with the hand-written
// extras: it forwards Descriptor to the generated facts and, in Register, wires
// the generated CRUD handler AND registers the module's DB readiness check.
type notesdModule struct {
	inner servicekit.Module
	db    sdkhealth.Pinger
}

// Descriptor implements servicekit.Module: the generated proto facts, plus the
// module's self-describing Database descriptor (WS-012 P2). The module declares its
// embedded migrations FS and leaves Isolation unset, so a host applies the
// composition default (schema-preferred). A composed host reads Database to allocate
// the module's namespace and run its migrations.
func (m *notesdModule) Descriptor() servicekit.Descriptor {
	d := m.inner.Descriptor()
	d.Database = servicekit.DatabaseDescriptor{
		// Isolation unset => host/composition default (schema-preferred).
		Migrations: Migrations(),
	}
	return d
}

// Register implements servicekit.Module: register the generated CRUD handler on
// the shared server, then register this module's DB readiness check so the host's
// /readyz and gRPC health reflect the database's availability.
func (m *notesdModule) Register(ctx context.Context, app *servicekit.App) error {
	if err := m.inner.Register(ctx, app); err != nil {
		return err
	}
	if m.db != nil {
		// Module-qualified check name so co-resident modules don't collide.
		if err := app.Health.Register("notesd.db", sdkhealth.NewDBCheck("notesd.db", m.db)); err != nil {
			return err
		}
	}
	return nil
}
