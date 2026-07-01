---
title: The public seam
weight: 10
---

The SDK ships seams, not implementations. A seam is a public interface that
defines a mechanism — how a session is read, how nav is validated, how a
micro-frontend mounts — without deciding any product-specific policy. This page
explains that split, so you know what belongs in the SDK and what binds on top
of it privately.

The split matters when you extend the SDK for a real product. Anything
product-specific — an identity provider, a set of valid nav groups, a design
system — attaches as a separate private package rather than living here.

## Mechanism, not policy

Everything in this repository is a standard mechanism. The SDK defines three
seams and keeps every product decision out of them:

- **The session seam is `SessionProvider`.** The generic OIDC binding
  (authorization code with PKCE) is public because OIDC is a standard. A
  provider-specific binding — one that supplies a particular `authority` and
  `audience` — is a separate private package. No identity provider is named or
  hardwired in the SDK.
- **The nav seam is `NavContribution` and a group registry.** The set of valid
  groups is a product taxonomy. The host supplies it at runtime; the SDK never
  hardcodes it.
- **The lifecycle seam is the micro-frontend module.** The single-spa and Angular
  adapters are thin glue over it. A shell composes them.

Nothing product-specific lives here: no identity-provider names, no design
system, no deployment resources, no nav-taxonomy values.

## A public seam, a private binding

The SDK follows the same governance principle as
[devedge-sdk](https://infobloxopen.github.io/devedge-sdk/): the seam is public,
and any product-specific implementation is a private binding on top of it.

In devedge-sdk the authorization seam is the public `authz.Authorizer`
interface. A concrete decision point — an OPA-backed authorizer, for example —
binds to that interface from a separate private package, and nothing about that
engine leaks into the public seam.

The frontend SDK works the same way. The public OIDC binding supplies the
standard mechanism; a private package supplies the provider-specific
`authority` and `audience`. The public group registry validates against a
taxonomy; a private package supplies the taxonomy. You extend the SDK by adding
a binding, not by forking the seam.

## The shell owns the session; micro-frontends never authenticate

This is the load-bearing rule of the session seam.

The shell instantiates the `SessionProvider` — usually the OIDC one — exactly
once, and threads it into every child micro-frontend as a prop. A child receives
only the read-only view of the provider. It can read the token, read claims,
subscribe to auth events, and request login or logout. It cannot construct a
session or reach the identity provider.

`createShell` enforces the rule by gating registration on `await
session.getToken()` before any micro-frontend mounts. A micro-frontend that
tries to re-implement login has nowhere to get the provider factory from: it
holds a session view, not the constructor.

{{< callout type="info" >}}
**A child micro-frontend never talks to the identity provider directly.** It
reads the token from the session view the shell passed in. This keeps one login,
one token lifecycle, and one place that renews it — the shell — no matter how
many micro-frontends the shell composes.
{{< /callout >}}

## See also

- [Why nav validation is loud](../why-loud-validation/) — the other guarantee
  the SDK makes.
- [Wire the session](../../how-to/wire-the-session/) — the seam applied to a task.
