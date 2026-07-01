module github.com/example/notesd

go 1.25.5

require (
	github.com/glebarez/sqlite v1.11.0
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0
	github.com/infobloxopen/apis/proto/infoblox/authz v1.0.0-alpha.4
	github.com/infobloxopen/apis/proto/infoblox/field v1.0.0-alpha.3
	github.com/infobloxopen/devedge-sdk v0.43.0
	github.com/infobloxopen/devedge-sdk/observability/otel v0.43.0
	github.com/infobloxopen/devedge-sdk/persistence/gormtx v0.43.0
	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa
	google.golang.org/grpc v1.81.1
	google.golang.org/protobuf v1.36.11
	gorm.io/gorm v1.31.1
)

require (
	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/glebarez/go-sqlite v1.21.2 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/ncruces/go-strftime v1.0.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.69.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.69.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.44.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.44.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.44.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.44.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.44.0 // indirect
	go.opentelemetry.io/otel/metric v1.44.0 // indirect
	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
	go.opentelemetry.io/otel/sdk/metric v1.44.0 // indirect
	go.opentelemetry.io/otel/trace v1.44.0 // indirect
	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
	golang.org/x/net v0.55.0 // indirect
	golang.org/x/sys v0.45.0 // indirect
	golang.org/x/text v0.37.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
	modernc.org/libc v1.72.3 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
	modernc.org/sqlite v1.52.0 // indirect
)

// Persistence (F027 / WS-011 P2): the gorm-backed transaction runner + outbox
// machinery the generated service wires (gormtx.NewGormTxRunner, the reusable
// outbox) lives in the SDK's persistence/gormtx adapter, which is its OWN module —
// so gorm leaves the SDK root library's graph and arrives here only via this
// require. The direct gorm require above stays (the generated service uses gorm
// types directly); gormtx brings the adapter.

// Observability (F034 / WS-011): the OTel SDK + exporters live in the SDK's
// observability/otel adapter, which is its OWN module — the generated main imports
// it (otel.Setup), so it is a direct require above (and brings the SDK/exporters
// into THIS module's graph, never the SDK root's). The OTel API is pinned here so
// `go mod tidy`'s reconciliation of those indirects is deterministic; configure
// the exporter at runtime via the standard OTEL_* env (see README).
require go.opentelemetry.io/otel v1.44.0 // indirect
