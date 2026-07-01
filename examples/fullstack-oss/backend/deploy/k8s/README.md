# Kubernetes / k3s deploy (Flux GitOps)

This service deploys via a **framework-owned Helm chart you never author**. This
directory carries only the GitOps glue:

| File | Purpose |
|------|---------|
| `oci-repository.yaml` | Flux `OCIRepository` source — where the published chart lives. |
| `helmrelease.yaml` | Flux `HelmRelease` — reconciles the chart with your overlay. |
| `values.yaml` | The **thin overlay** — the only chart input you edit. |

The chart itself (Deployment with liveness `/healthz` + readiness `/readyz`,
the config env, `OTEL_*` export, the DSN Secret, ingress, resource limits, and
`terminationGracePeriodSeconds`) lives in the SDK and is **published by the
framework** to an OCI registry.

## Wire it up

1. Edit `values.yaml`: `image.repository` is prefilled with the image
   `.github/workflows/image.yml` publishes to GHCR on merge to main; set `image.tag`
   to pin a release, plus the OTEL collector endpoint and the DSN.
2. Point `oci-repository.yaml` `spec.url` at your published chart registry
   (default `oci://ghcr.io/infobloxopen/charts/devedge-service`).
3. Apply the overlay as a ConfigMap the HelmRelease references:
   ```sh
   kubectl create configmap notesd-values -n notesd \
     --from-file=values.yaml=deploy/k8s/values.yaml \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
4. Commit `deploy/k8s/` and let Flux reconcile it.

## Dev ↔ prod coherence

The SAME chart backs local dev (`de project up --deploy` renders it via
`helm template`) and prod (Flux reconciles the published chart). One chart, two
reconcilers — they cannot drift.
