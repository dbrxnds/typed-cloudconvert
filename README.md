# typed-cloudconvert

A CloudConvert job builder for TypeScript.

This library helps you build CloudConvert jobs with compile-time checks:

- task names stay as string literals
- task dependencies are validated while you build the job
- duplicate task names are rejected
- reusable partial jobs can declare placeholders and be completed later

## Installation

```bash
pnpm add typed-cloudconvert
```

## Quick Start

Most jobs are simple: create a few tasks, reference earlier task names in `input`, and build the final payload.

```ts
import { Job, Task } from "typed-cloudconvert";

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

const tasks = Job.build(job);
```

`built` is a plain CloudConvert job payload:

```ts
{
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
```

### Valid Job

This works because `"import-file"` exists before the convert task uses it.

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

### Invalid Job

This does not work because `"missing-import"` was never added.

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

That is the core idea: tasks can only reference names or aliases that the plan already knows about.

## Common Task Constructors

The `Task` module includes constructors for common CloudConvert operations.

Examples:

- `Task.importUrl(...)`
- `Task.importS3(...)`
- `Task.convert(...)`
- `Task.metadata(...)`
- `Task.exportUrl(...)`

There is also a generic `Task.make(...)` if you want to construct a task by explicit operation name.

## Advanced

### Reusable Fragments

Sometimes you want to define a reusable partial job without knowing the final task name in advance.

That is what placeholders are for.

```ts
import { Job, Ref, Task } from "typed-cloudconvert";

const convertMp4 = Job.empty().pipe(
  Job.add(
    Task.convert({
      name: "convert-mp4",
      input: Ref.placeholder("source"),
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

In that example:

- the fragment says it needs `source`
- the import task says it provides `source`
- merging them produces a complete job

### When To Use `Ref.placeholder(...)`

For ordinary jobs, you usually do **not** need `Ref.placeholder(...)`.

If you already know the real task name, just use the task name directly:

```ts
Task.convert({
  name: "convert-file",
  input: "import-file",
  output_format: "pdf",
});
```

Use `Ref.placeholder("source")` only when you are creating a reusable fragment and the final task name will be chosen later.

## Main Modules

### `Task`

Task constructors and task typing.

### `Job`

Job composition and build helpers.

Main APIs:

- `Job.empty()`
- `Job.make(...)`
- `Job.add(...)`
- `Job.merge(...)`
- `Job.build(...)`
- `Job.interpret(...)`

### `Ref`

Reference helpers for task dependencies.

- `Ref.output("task-name")`
- `Ref.placeholder("alias")`

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
