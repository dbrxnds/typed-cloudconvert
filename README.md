# effect-cloudconvert

A typed CloudConvert job builder with compile-time dependency checking.

The main goal of this package is to make CloudConvert jobs feel safe to compose:

- task names are tracked as string literals
- duplicate task names and provided aliases are rejected
- task inputs are validated against tasks or aliases that actually exist
- reusable job fragments can declare placeholders such as `source`
- the Effect service can fetch and interpret job results using the original plan

The public API is exposed as modules:

```ts
import { CloudConvertClient, Job, Ref, Task } from "effect-cloudconvert";
```

## Installation

```bash
pnpm add effect-cloudconvert cloudconvert effect
```

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

## How The Type System Helps

For ordinary jobs, you usually just use plain task names in `input`.

### Valid Job

```ts
const validJob = Job.empty().pipe(
  Job.add(
    Task.importUrl({
      name: "import-file",
      url: "https://example.com/input.pdf",
    }),
  ),
  Job.add(
    Task.convert({
      name: "convert-file",
      input: "import-file",
      output_format: "png",
    }),
  ),
);
```

This works because `"import-file"` already exists in the job when the `convert` task is added.

### Invalid Job

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
"'convert-missing' references 'missing-import' via 'input', but it does not exist";
```

That is the core idea: tasks can only reference names or aliases that the plan knows about.

## Effect Integration

The builder is mostly a typed TypeScript DSL. The optional runtime integration uses Effect for:

- the `CloudConvertClient` service tag
- `Layer` provisioning
- tagged runtime errors
- plan-aware helpers that interpret raw CloudConvert job responses

`CloudConvertClient.layer(...)` is the main integration entrypoint:

```ts
import CloudConvert from "cloudconvert";
import * as Effect from "effect/Effect";
import { CloudConvertClient, Job } from "effect-cloudconvert";

const client = new CloudConvert(process.env.CLOUDCONVERT_API_KEY!);

const program = Effect.gen(function* () {
  const cloudConvert = yield* CloudConvertClient.CloudConvertClient;
  return yield* cloudConvert.createJobResult(job);
}).pipe(Effect.provide(CloudConvertClient.layer(client)));
```

The service exposes two kinds of methods:

- raw CloudConvert calls
  - `createJob(...)`
  - `getJob(...)`
  - `waitJob(...)`
- plan-aware helpers
  - `interpretJob(plan, rawJob)`
  - `createJobResult(plan)`
  - `getJobResult(plan, id)`
  - `waitJobResult(plan, id)`

## Advanced

### Reusable Fragments

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
- the merged job is complete and can be built

### When `Ref.required(...)` Makes Sense

If you already know the exact task name, just use the task name directly:

```ts
Task.convert({
  name: "convert-file",
  input: "import-file",
  output_format: "pdf",
});
```

Use `Ref.required("alias")` only when the fragment author does not know the final task name yet:

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

### `CloudConvertClient`

Effect service and layer for CloudConvert runtime integration:

- `CloudConvertClient.CloudConvertClient`
- `CloudConvertClient.make(...)`
- `CloudConvertClient.layer(...)`
- `cloudConvert.createJob(...)`
- `cloudConvert.createJobResult(...)`
- `cloudConvert.getJobResult(...)`
- `cloudConvert.waitJobResult(...)`

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
