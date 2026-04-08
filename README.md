# effect-cloudconvert

A typed CloudConvert job builder with compile-time dependency checking.

The main goal of this package is to make CloudConvert jobs feel safe to compose:

- task names are tracked as string literals
- duplicate task names and provided aliases are rejected
- task inputs are validated against tasks or aliases that actually exist
- reusable job fragments can declare placeholders such as `source`
- fetched job results are typed from the original plan

The public API is exposed as modules:

```ts
import { CloudConvertClient, Job, Ref, Task } from "effect-cloudconvert";
```

## Installation

```bash
pnpm add effect-cloudconvert cloudconvert effect
```

`effect` is currently used for the optional runtime client integration and service layer.

## Quick Start

```ts
import { Job, Task } from "effect-cloudconvert";

const job = Job.empty().pipe(
  Job.add(
    Task.importUrl({
      name: "import-file",
      url: "https://example.com/input.mov",
    }),
  ),
  Job.add(
    Task.convert({
      name: "convert-file",
      input: "import-file",
      output_format: "mp4",
    }),
  ),
  Job.add(
    Task.exportUrl({
      name: "export-file",
      input: "convert-file",
    }),
  ),
);

const built = Job.build(job);
```

`built` is now a CloudConvert-compatible payload:

```ts
{
  tasks: {
    "import-file": {
      operation: "import/url",
      url: "https://example.com/input.mov"
    },
    "convert-file": {
      operation: "convert",
      input: "import-file",
      output_format: "mp4"
    },
    "export-file": {
      operation: "export/url",
      input: "convert-file"
    }
  }
}
```

## Reusable Fragments

Reusable fragments can depend on aliases that are satisfied later.

```ts
import { Job, Ref, Task } from "effect-cloudconvert";

const convertMp4 = Job.empty().pipe(
  Job.add(
    Task.convert({
      name: "convert-mp4",
      input: Ref.required("source"),
      output_format: "mp4",
    }),
  ),
);

const completeJob = Job.empty().pipe(
  Job.add(
    Task.importUrl({
      name: "import-file",
      provides: "source",
      url: "https://example.com/input.mov",
    }),
  ),
  Job.merge(convertMp4),
);
```

In this example:

- the fragment says it needs `source`
- the import task says it provides `source`
- the merged job is complete and can be built or submitted

## `Ref.required(...)`

For ordinary jobs, you usually do not need `Ref.output(...)`. If the dependency already knows the exact task name, just use the task name directly:

```ts
Task.convert({
  name: "convert-file",
  input: "import-file",
  output_format: "pdf",
});
```

Use `Ref.required("alias")` when a reusable fragment should be satisfied later:

```ts
Task.convert({
  name: "convert-file",
  input: Ref.required("source"),
  output_format: "pdf",
});
```

In most cases, the satisfying task should declare `provides` directly:

```ts
Task.importUrl({
  name: "import-file",
  provides: "source",
  url: "https://example.com/file.pdf",
});
```

`Job.provide(...)` still exists, but it is mainly an advanced escape hatch for manual aliasing.

## Better Type Errors

When a job is incomplete, the type system produces interpolated error strings rather than only exposing a raw union of missing names.

For example, this job is invalid:

```ts
const invalidJob = Job.empty().pipe(
  Job.add(
    Task.convert({
      name: "convert-missing",
      input: "missing-import",
      output_format: "pdf",
    }),
  ),
);
```

The type-level error message is:

```ts
"effect-cloudconvert: convert-missing references missing-import via input, but it does not exist";
```

## Effect Integration

The builder is mostly a typed TypeScript DSL. The optional runtime integration uses Effect for:

- the `CloudConvertClient` service tag
- `Effect` return values from the client service
- tagged runtime errors

You can provide a client through the Effect environment and then use the service directly:

```ts
import CloudConvert from "cloudconvert";
import * as Effect from "effect/Effect";
import { CloudConvertClient, Job } from "effect-cloudconvert";

const client = new CloudConvert(process.env.CLOUDCONVERT_API_KEY!);

const program = Effect.gen(function* () {
  const cloudConvert = yield* CloudConvertClient.CloudConvertClient;
  return yield* cloudConvert.createJob(Job.build(job));
}).pipe(
  Effect.provideService(CloudConvertClient.CloudConvertClient, CloudConvertClient.make(client)),
);
```

## Main Modules

### `Task`

Operation-specific constructors such as:

- `Task.importUrl(...)`
- `Task.importS3(...)`
- `Task.convert(...)`
- `Task.metadata(...)`
- `Task.exportUrl(...)`

There is also a generic `Task.make(...)` for explicit operation-based construction.

### `Ref`

Reference helpers for task dependencies:

- `Ref.output("task-name")`
- `Ref.required("alias")`

### `Job`

Job composition and execution helpers:

- `Job.empty()`
- `Job.make(...)`
- `Job.add(...)`
- `Job.merge(...)`
- `Job.build(...)`

## Development

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm exec vp check --fix
```

Run tests:

```bash
pnpm test
```

Build the package:

```bash
pnpm run build
```

## Credit

This package is heavily inspired by [`effect-qb`](https://github.com/relsunkaev/effect-qb), especially its staged type-state approach, branded compile-time errors, and enforcement-at-the-boundary design.
