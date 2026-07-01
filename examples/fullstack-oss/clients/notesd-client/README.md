# @example/notesd-client

Generated TypeScript/Angular API client.

This package was produced by `apx client generate`, which orchestrates
[`ng-openapi-gen`](https://www.npmjs.com/package/ng-openapi-gen) and wraps the
generated sources in a buildable npm package.

## Build

```sh
npm install
npm run build   # tsc -> dist/ (with .d.ts declarations)
```

## Consume locally

Add a `file:` dependency pointing at this package directory:

```json
{
  "dependencies": {
    "@example/notesd-client": "file:../path/to/this/package"
  }
}
```

The generated services import `@angular/core`, `@angular/common/http`, and
`rxjs` as peer dependencies; provide those in the consuming application.

> Generated code — do not edit by hand. Regenerate with `apx client generate`.
