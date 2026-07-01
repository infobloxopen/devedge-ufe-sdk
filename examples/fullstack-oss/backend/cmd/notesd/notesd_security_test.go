package main

import (
	"context"
	"testing"

	"google.golang.org/grpc/metadata"

	"github.com/infobloxopen/devedge-sdk/seccheck"

	notesdv1 "github.com/example/notesd/gen/notesdv1"
)

// asAdmin appends the group the dev grant matches on (see devGrant in the smoke
// test) so a call is authorized. The seccheck helpers supply the account-id
// (tenant); this adds groups:admin on top, so the granted identity is complete.
func asAdmin(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, "groups", "admin")
}

// TestSecurity turns the SDK's security invariants into standard go test
// assertions (see the "Security Check" how-to). seccheck runs entirely
// in-process against the generated host and the in-memory store, so it needs no
// external services and runs as part of `go test ./...` in CI — a change that
// regresses a security property fails the build the moment it merges. The freshly
// scaffolded service already satisfies every assertion; this test is the guard.
func TestSecurity(t *testing.T) {
	client := startServer(t)

	// 1. Static: every method declares a complete authz rule (verb + resource).
	//    This is the compile-time counterpart to the fail-closed boot gate.
	t.Run("RulesComplete", func(t *testing.T) {
		seccheck.RunT(t, seccheck.AssertRulesComplete(notesdv1.NoteServiceAuthzRules))
	})

	// 2. Fail-closed: an unknown principal (no grants) is denied every non-public
	//    method. These CallFns deliberately do NOT present groups:admin, so the
	//    dev grant does not match and each call must return PermissionDenied.
	t.Run("UnknownPrincipalDenied", func(t *testing.T) {
		calls := map[string]seccheck.CallFn{
			notesdv1.NoteService_CreateNote_FullMethodName: func(ctx context.Context) error {
				_, err := client.CreateNote(ctx, &notesdv1.CreateNoteRequest{
					Note: &notesdv1.Note{Id: "denied-probe"},
				})
				return err
			},
			notesdv1.NoteService_GetNote_FullMethodName: func(ctx context.Context) error {
				_, err := client.GetNote(ctx, &notesdv1.GetNoteRequest{Id: "denied-probe"})
				return err
			},
			notesdv1.NoteService_ListNotes_FullMethodName: func(ctx context.Context) error {
				_, err := client.ListNotes(ctx, &notesdv1.ListNotesRequest{PageSize: 10})
				return err
			},
			notesdv1.NoteService_UpdateNote_FullMethodName: func(ctx context.Context) error {
				_, err := client.UpdateNote(ctx, &notesdv1.UpdateNoteRequest{
					Note:  &notesdv1.Note{Id: "denied-probe"},
					UpdateMask: []string{"display_name"},
				})
				return err
			},
			notesdv1.NoteService_DeleteNote_FullMethodName: func(ctx context.Context) error {
				_, err := client.DeleteNote(ctx, &notesdv1.DeleteNoteRequest{Id: "denied-probe"})
				return err
			},
		}
		seccheck.RunT(t, seccheck.AssertUnknownPrincipalDenied(
			context.Background(), notesdv1.NoteServiceAuthzRules, calls))
	})

	// 3. Tenant isolation: a note created by alice is invisible to
	//    bob — read returns NotFound, list returns 0, and both hold after a
	//    soft-delete. This is the headline secure-by-default property.
	t.Run("CrossAccountIsolation", func(t *testing.T) {
		seccheck.RunT(t, seccheck.AssertCrossAccountIsolation(context.Background(), seccheck.IsolationConfig{
			PrincipalA: "alice",
			PrincipalB: "bob",
			CreateFn: func(ctx context.Context) (string, error) {
				created, err := client.CreateNote(asAdmin(ctx), &notesdv1.CreateNoteRequest{
					Note: &notesdv1.Note{Id: "iso-1", DisplayName: "alice's note"},
				})
				if err != nil {
					return "", err
				}
				return created.Id, nil
			},
			ReadFn: func(ctx context.Context, id string) error {
				_, err := client.GetNote(asAdmin(ctx), &notesdv1.GetNoteRequest{Id: id})
				return err
			},
			ListFn: func(ctx context.Context) (int, error) {
				resp, err := client.ListNotes(asAdmin(ctx), &notesdv1.ListNotesRequest{PageSize: 100})
				if err != nil {
					return 0, err
				}
				return len(resp.Notes), nil
			},
			DeleteFn: func(ctx context.Context, id string) error {
				_, err := client.DeleteNote(asAdmin(ctx), &notesdv1.DeleteNoteRequest{Id: id})
				return err
			},
			ListDeletedFn: func(ctx context.Context) (int, error) {
				resp, err := client.ListNotes(asAdmin(ctx), &notesdv1.ListNotesRequest{PageSize: 100, ShowDeleted: true})
				if err != nil {
					return 0, err
				}
				return len(resp.Notes), nil
			},
		}))
	})

	// 4. Clean errors: a NotFound (and any other) error must not leak SQL, file
	//    paths, or internal sentinels to the client. The ErrorMapper maps the raw
	//    persistence error to a clean codes.NotFound with no internals.
	t.Run("ErrorMessagesClean", func(t *testing.T) {
		callCtx := asAdmin(metadata.AppendToOutgoingContext(context.Background(), "account-id", "tenant-sec"))
		seccheck.RunT(t, seccheck.AssertErrorMessagesClean(callCtx, []seccheck.ErrorTrigger{
			{Method: "GetNote/notfound", Fn: func(ctx context.Context) error {
				_, err := client.GetNote(ctx, &notesdv1.GetNoteRequest{Id: "does-not-exist"})
				return err
			}},
		}))
	})

	// 5. No secret leak: any (infoblox.field.v1.opts).secret = true field must read
	//    back as "[REDACTED]". The default scaffold declares no secret field, so
	//    this passes trivially — it stands ready the moment you annotate one (see
	//    the "Protect secret fields" how-to). Add the new field's create/read here.
	t.Run("NoSecretFieldsLeaked", func(t *testing.T) {
		ctx := asAdmin(metadata.AppendToOutgoingContext(context.Background(), "account-id", "tenant-sec"))
		created, err := client.CreateNote(ctx, &notesdv1.CreateNoteRequest{
			Note: &notesdv1.Note{Id: "secret-probe", DisplayName: "probe"},
		})
		if err != nil {
			t.Fatalf("CreateNote: %v", err)
		}
		got, err := client.GetNote(ctx, &notesdv1.GetNoteRequest{Id: created.Id})
		if err != nil {
			t.Fatalf("GetNote: %v", err)
		}
		seccheck.RunT(t, seccheck.AssertNoSecretFieldsLeaked(created, got))
	})
}
