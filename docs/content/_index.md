---
title: devedge-ufe-sdk
layout: hextra-home
---

{{< hextra/hero-badge >}}
  <div class="hx:w-2 hx:h-2 hx:rounded-full hx:bg-primary-400"></div>
  <span>Early — APIs will change</span>
  {{< icon name="arrow-circle-right" attributes="height=14" >}}
{{< /hextra/hero-badge >}}

<div class="hx:mt-6 hx:mb-6">
{{< hextra/hero-headline >}}
  The micro-frontend SDK&nbsp;<br class="hx:sm:block hx:hidden" />for devedge
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  A small, public, mechanism-only SDK for Angular micro-frontends: a session seam the&nbsp;<br class="hx:sm:block hx:hidden" />shell owns, loud nav validation, and bearer wiring to a devedge-sdk backend.
{{< /hextra/hero-subtitle >}}
</div>

<div class="hx:mb-6">
{{< hextra/hero-button text="Build a micro-frontend" link="docs/tutorial/build-a-micro-frontend/" >}}
</div>

<div class="hx:mt-6"></div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="The shell owns the session"
    subtitle="One SessionProvider is instantiated once in the shell and threaded into every micro-frontend as a read-only view. Child micro-frontends read the token; they never authenticate."
    icon="key"
  >}}
  {{< hextra/feature-card
    title="Nav fails loud, not silent"
    subtitle="A nav item's group is validated against a host-supplied registry. An unknown group throws and names the bad value and the valid ones, instead of rendering nothing with no error."
    icon="shield-check"
  >}}
  {{< hextra/feature-card
    title="Bearer wiring, once"
    subtitle="createAuthedFetch and the Angular bearer interceptor attach the token and handle 401 with a single login-and-retry, so every micro-frontend calls the backend the same way."
    icon="lock-closed"
  >}}
  {{< hextra/feature-card
    title="A public seam, a private binding"
    subtitle="Every seam here is a standard mechanism. Product-specific bindings — a provider's OIDC authority, a nav taxonomy, a design system — live in separate private packages."
    icon="puzzle"
  >}}
  {{< hextra/feature-card
    title="Thin lifecycle adapters"
    subtitle="The single-spa and Angular adapters are thin glue over the same core contract. A shell composes them; the SDK carries no Angular CLI or ng-packagr."
    icon="cog"
  >}}
  {{< hextra/feature-card
    title="A loud dev loop"
    subtitle="devedge-ufe doctor turns the silent cert, CORS, manifest, and nav chain into an ordered checklist, so a broken local setup names its own failure."
    icon="server"
  >}}
{{< /hextra/feature-grid >}}
