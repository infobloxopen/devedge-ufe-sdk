---
title: Why nav validation is loud
weight: 20
---

Nav validation in the SDK throws an error when a nav item names a group that does
not exist. This page explains why the SDK makes noise where a naive
implementation stays silent, so you understand what the guarantee buys you.

The short version: a silent failure in the nav path cost real debugging time, and
the SDK's job is to turn that class of failure into a loud, mechanism-level
guarantee.

## The silent nav-group drop

A hands-on bootstrap of a real micro-frontend surfaced ten friction findings. The
worst was a silent failure.

A nav item carries a `group` field. In the naive implementation that field was
free text, validated against nothing. When a nav item named a group that did not
exist, the item rendered nothing. There was no error in the console, no warning
in the build, and no failed request — the item simply did not appear, and
nothing said why.

A silent failure like this is expensive because there is no thread to pull. You
see a missing menu item and have to guess: is the manifest wrong, the route
wrong, the build stale, the group misspelled? The system gives you no signal, so
you debug by elimination.

## The guarantee: fail loud, and name the cause

The SDK validates the `group` against a host-supplied
[`GroupRegistry`](../../reference/core/#nav-validation).
[`assertNavContributions`](../../reference/core/#nav-validation) throws on the
first contribution whose group is not in the registry, and the error names the
unknown group and lists the valid ones. You run this at import or build time, so
the failure surfaces before the micro-frontend ships, not when a user notices a
missing menu item.

An empty registry is handled explicitly rather than silently passing. In
permissive mode it warns during development; in strict mode it fails. Either way,
an unvalidated nav contribution never slips through unnoticed.

{{< callout type="info" >}}
**The host owns the set of valid groups, not the SDK.** The group taxonomy is a
product decision, so the host supplies it through the registry at runtime. The
SDK supplies the mechanism that checks against it. See
[The public seam](../the-public-seam/).
{{< /callout >}}

## The same principle across the dev loop

Loud validation is a pattern, not a one-off. The
[dev-loop](../../reference/dev-loop/) package applies it to the rest of the load
chain: reachability, TLS, CORS, and the manifest each become an ordered,
named step in the [`diagnose`](../../reference/dev-loop/#the-checklist)
checklist. A local setup that used to fail with a blank screen now reports the
first step that failed and why.

## See also

- [Validate nav contributions](../../how-to/validate-nav-contributions/) — the
  task recipe.
- [Diagnose the dev loop](../../how-to/diagnose-the-dev-loop/) — loud validation
  applied to the whole load chain.
