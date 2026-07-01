package main

import (
	"context"
	"net"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/infobloxopen/devedge-sdk/authz"

	notesdv1 "github.com/example/notesd/gen/notesdv1"
)

// devGrant is the dev authorization grant the smoke tests boot the host with: the
// "admin" group may do everything in any tenant. It mirrors the grant in main.go
// and, paired with grpcauthz.DevPrincipalFunc (wired in runHost), is satisfied by
// a caller that sends `account-id: <tenant>` + `groups: admin`.
func devGrant() authz.Grant {
	return authz.Grant{Tenant: "*", Subjects: []string{"group:admin"}, Verbs: []authz.Verb{"*"}, Resource: "*"}
}

// startServer boots the STANDALONE host (the same runHost main uses) on a
// kernel-assigned port and returns a connected client. The host is torn down via
// t.Cleanup. This exercises the composable shape end-to-end: runHost builds the
// module/ unit and hands it to servicekit.Run.
func startServer(t *testing.T) notesdv1.NoteServiceClient {
	t.Helper()
	addr := freeLoopbackAddr(t)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	// runHost -> servicekit.Run -> server.Serve runs the fail-closed authz
	// completeness gate before it binds: a registered RPC missing an authz rule
	// makes Serve return the gate error here (and never binds), so surface it
	// instead of letting the client dial a dead addr.
	serveErr := make(chan error, 1)
	go func() { serveErr <- runHost(ctx, authz.NewDevAuthorizer(devGrant()), addr, "", "") }()

	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatalf("dial %q: %v", addr, err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	client := notesdv1.NewNoteServiceClient(conn)

	// Wait until the host is serving (any reply, including a denied/NotFound,
	// proves the listener is up); fail fast if runHost errored at the boot gate.
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case err := <-serveErr:
			t.Fatalf("host failed to start: %v", err)
		default:
		}
		pctx, pcancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		_, perr := client.GetNote(metadata.NewOutgoingContext(pctx, metadata.Pairs("account-id", "probe")), &notesdv1.GetNoteRequest{Id: "probe"})
		pcancel()
		if status.Code(perr) != codes.Unavailable {
			return client
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatal("host did not start serving within 5s")
	return nil
}

// freeLoopbackAddr binds :0 on loopback, reads the assigned port, closes the
// listener, and returns the addr for runHost to bind.
func freeLoopbackAddr(t *testing.T) string {
	t.Helper()
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := lis.Addr().String()
	_ = lis.Close()
	return addr
}

// TestSmoke boots the generated host and runs one tenant-scoped CRUD round-trip
// over gRPC: Create -> Get -> List -> Update -> Delete -> Get(NotFound). It proves
// the scaffold builds, boots, authz-gates, and persists with zero hand-edits.
func TestSmoke(t *testing.T) {
	client := startServer(t)

	// Present the dev identity the grant authorizes: account-id satisfies the
	// TenantID middleware (and scopes the resource), groups:admin satisfies the
	// group:admin grant via grpcauthz.DevPrincipalFunc.
	mdCtx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs("account-id", "tenant1", "groups", "admin"))

	created, err := client.CreateNote(mdCtx, &notesdv1.CreateNoteRequest{
		Note: &notesdv1.Note{Id: "note-1", DisplayName: "first note"},
	})
	if err != nil {
		t.Fatalf("CreateNote: %v", err)
	}
	if created.Id != "note-1" {
		t.Fatalf("CreateNote: got id %q, want %q", created.Id, "note-1")
	}

	got, err := client.GetNote(mdCtx, &notesdv1.GetNoteRequest{Id: "note-1"})
	if err != nil {
		t.Fatalf("GetNote: %v", err)
	}
	if got.DisplayName != "first note" {
		t.Fatalf("GetNote: got display_name %q", got.DisplayName)
	}

	list, err := client.ListNotes(mdCtx, &notesdv1.ListNotesRequest{PageSize: 10})
	if err != nil {
		t.Fatalf("ListNotes: %v", err)
	}
	if len(list.Notes) != 1 {
		t.Fatalf("ListNotes: want 1, got %d", len(list.Notes))
	}

	updated, err := client.UpdateNote(mdCtx, &notesdv1.UpdateNoteRequest{
		Note:  &notesdv1.Note{Id: "note-1", DisplayName: "renamed"},
		UpdateMask: []string{"display_name"},
	})
	if err != nil {
		t.Fatalf("UpdateNote: %v", err)
	}
	if updated.DisplayName != "renamed" {
		t.Fatalf("UpdateNote: got display_name %q, want %q", updated.DisplayName, "renamed")
	}

	if _, err := client.DeleteNote(mdCtx, &notesdv1.DeleteNoteRequest{Id: "note-1"}); err != nil {
		t.Fatalf("DeleteNote: %v", err)
	}

	_, err = client.GetNote(mdCtx, &notesdv1.GetNoteRequest{Id: "note-1"})
	if status.Code(err) != codes.NotFound {
		t.Fatalf("GetNote after delete: want NotFound, got %v (err=%v)", status.Code(err), err)
	}
}

// TestSmoke_DeniedForUnknownPrincipal proves the authz gate fails closed: a caller
// that does NOT present the granted identity (no groups:admin) is denied with
// PermissionDenied, even though the RPC is declared.
func TestSmoke_DeniedForUnknownPrincipal(t *testing.T) {
	client := startServer(t)

	// account-id alone satisfies the TenantID middleware but yields a principal
	// with no groups, so the group:admin grant does NOT match -> default deny.
	mdCtx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs("account-id", "tenant1"))

	_, err := client.GetNote(mdCtx, &notesdv1.GetNoteRequest{Id: "nope"})
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("GetNote without grant: want PermissionDenied, got %v (err=%v)", status.Code(err), err)
	}
}
