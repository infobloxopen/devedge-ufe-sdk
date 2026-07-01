---
title: Validate nav contributions
weight: 20
---

This guide validates a micro-frontend's nav contributions against a host-supplied
group registry, so a nav item that names a group that does not exist fails with
a named error instead of rendering nothing. You run the validation at import or
build time, before the micro-frontend ships.

## Goal

- Every nav item's `group` is checked against the set of valid groups.
- An unknown group throws, naming the bad value and the valid ones.

## Prerequisites

- `@infobloxopen/devedge-ufe-core`.
- The set of valid nav groups for your product. The host owns this taxonomy; the
  SDK does not hardcode it.

## Steps

### 1. Build a registry from the valid groups

Use [`staticGroupRegistry`](../../reference/core/#nav-validation) with the groups
your host recognizes.

```ts
import { staticGroupRegistry } from '@infobloxopen/devedge-ufe-core';

const groups = staticGroupRegistry(['manage', 'monitor', 'administration']);
```

### 2. Assert the contributions at import time

Call [`assertNavContributions`](../../reference/core/#nav-validation) where the
manifest is defined, so validation runs when the module is imported.

```ts
import { assertNavContributions, defineManifest } from '@infobloxopen/devedge-ufe-core';

const navItems = [
  { name: 'Widgets', path: '/widgets', group: 'manage', type: 'menuItem' as const },
];

assertNavContributions(navItems, groups); // throws on the first unknown group

export default defineManifest({
  navItems,
  routes: ['/widgets'],
  exports: [{ id: 'widgets', entry: 'main.js', type: 'ufe-application' }],
});
```

## Verify

Change one nav item's `group` to a value that is not in the registry, then
import the module. It throws, and the error names the unknown group and lists the
valid groups. Restore the correct group and the import succeeds.

{{< callout type="info" >}}
**Validate one contribution at a time with `validateNavContribution`.** It
returns a result rather than throwing, which suits a form or a tool that reports
several problems at once. Use `assertNavContributions` for the build-time gate.
{{< /callout >}}

## See also

- [Why nav validation is loud](../../explanation/why-loud-validation/) — the bug
  this prevents.
- [Reference: core](../../reference/core/#nav-validation) — the validation API.
