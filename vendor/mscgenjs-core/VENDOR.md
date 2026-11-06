# Vendored mscgenjs core

Source: https://github.com/mscgenjs/mscgenjs-core

Baseline: v8.0.0, commit `ec20b6c4145ce4776da852729f2a5c7e205592dd`.
Upstream source, tests, configuration, build tools, types and licenses are retained.
Generated parsers, styles and distribution files are rebuilt locally and ignored.
Publishing and repository-maintenance scripts are omitted from this private workspace.

Local changes add Xu's inheritable `hidden` attribute, preserve layout while hiding
SVG components, stabilize lazy-style strokes, and reject incompatible conversions.
Run `npm run build:core` or `npm run check:core` from the repository root.
