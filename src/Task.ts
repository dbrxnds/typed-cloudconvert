import type { JobTask } from "cloudconvert/built/lib/JobsResource.js";
import type {
  ExportAzureBlobData,
  ExportGoogleCloudStorageData,
  ExportOpenStackData,
  ExportS3Data,
  ExportSFTPData,
  ExportUrlData,
  ImportAzureBlobData,
  ImportBase64Data,
  ImportGoogleCloudStorageData,
  ImportOpenStackData,
  ImportRawData,
  ImportS3Data,
  ImportSFTPData,
  ImportUploadData,
  ImportUrlData,
  TaskArchiveData,
  TaskCaptureData,
  TaskCommandData,
  TaskConvertData,
  TaskMergeData,
  TaskMetadataData,
  TaskMetadataWriteData,
  TaskOptimizeData,
  FileResult,
  Operation,
  TaskThumbnailData,
  TaskWaterMarkData,
} from "cloudconvert/built/lib/TasksResource.js";

import { pipeArguments, type Pipeable } from "./internal/pipe.js";
import * as Ref from "./Ref.js";

/**
 * Unique string identifier carried by typed task definitions.
 */
export const TaskTypeId = "~typed-cloudconvert/Task";

/**
 * Supported CloudConvert task operation names.
 */
export type OperationName = Operation["operation"];

/**
 * Maps each supported CloudConvert operation to its payload shape.
 */
export interface OperationMap {
  readonly "import/url": ImportUrlData;
  readonly "import/upload": ImportUploadData;
  readonly "import/base64": ImportBase64Data;
  readonly "import/raw": ImportRawData;
  readonly "import/s3": ImportS3Data;
  readonly "import/azure/blob": ImportAzureBlobData;
  readonly "import/google-cloud-storage": ImportGoogleCloudStorageData;
  readonly "import/openstack": ImportOpenStackData;
  readonly "import/sftp": ImportSFTPData;
  readonly convert: TaskConvertData;
  readonly optimize: TaskOptimizeData;
  readonly watermark: TaskWaterMarkData;
  readonly "capture-website": TaskCaptureData;
  readonly thumbnail: TaskThumbnailData;
  readonly metadata: TaskMetadataData;
  readonly "metadata/write": TaskMetadataWriteData;
  readonly merge: TaskMergeData;
  readonly archive: TaskArchiveData;
  readonly command: TaskCommandData;
  readonly "export/url": ExportUrlData;
  readonly "export/s3": ExportS3Data;
  readonly "export/azure/blob": ExportAzureBlobData;
  readonly "export/google-cloud-storage": ExportGoogleCloudStorageData;
  readonly "export/openstack": ExportOpenStackData;
  readonly "export/sftp": ExportSFTPData;
}

type TaskInputValue = Ref.InputValue;
type ProvidesInput<Name extends string = string> = Name | ReadonlyArray<Name>;

type WithTaskInputs<Data> = Data extends { readonly input: unknown }
  ? Omit<Data, "input"> & { readonly input: TaskInputValue }
  : Data extends { input: unknown }
    ? Omit<Data, "input"> & { input: TaskInputValue }
    : Data extends { readonly input?: unknown }
      ? Omit<Data, "input"> & { readonly input?: TaskInputValue }
      : Data extends { input?: unknown }
        ? Omit<Data, "input"> & { input?: TaskInputValue }
        : Data;

/**
 * Payload type for a given CloudConvert operation.
 *
 * The `input` field is widened to accept typed refs such as `Ref.output(...)`
 * and `Ref.placeholder(...)`.
 */
export type TaskPayload<Op extends OperationName> = WithTaskInputs<OperationMap[Op]>;

/**
 * Extracts the task or placeholder names referenced by a payload.
 */
export type TaskDependencies<Payload> = Payload extends {
  readonly input: infer Input;
}
  ? Ref.DependenciesOf<Input>
  : Payload extends { input: infer Input }
    ? Ref.DependenciesOf<Input>
    : Payload extends { readonly input?: infer Input }
      ? Ref.DependenciesOf<Exclude<Input, undefined>>
      : Payload extends { input?: infer Input }
        ? Ref.DependenciesOf<Exclude<Input, undefined>>
        : never;

/**
 * Extracts the alias names a task contributes to a job via `provides`.
 */
export type ProvidedAliasesOf<Task extends Any> =
  Task extends TaskDefinition<any, any, any, any, infer Provides> ? Provides : never;

/**
 * Immutable typed description of a CloudConvert task.
 *
 * Task definitions preserve literal task names, the selected CloudConvert
 * operation, the payload shape, inferred dependencies, and any aliases exposed
 * through `provides`.
 *
 * @example
 * ```ts
 * import { Task } from "typed-cloudconvert";
 *
 * const task = Task.convert({
 *   name: "convert-file",
 *   input: "import-file",
 *   output_format: "pdf",
 * });
 * ```
 */
export interface TaskDefinition<
  Name extends string = string,
  Op extends OperationName = OperationName,
  Payload extends TaskPayload<Op> = TaskPayload<Op>,
  Requires extends string = TaskDependencies<Payload>,
  Provides extends string = never,
> extends Pipeable {
  readonly [TaskTypeId]: {
    readonly _TypeId: typeof TaskTypeId;
    readonly _Requires?: Requires;
  };
  readonly name: Name;
  readonly operation: Op;
  readonly payload: Payload;
  readonly ignoreError: boolean;
  readonly provides: ReadonlyArray<Provides>;
}

/**
 * Any typed CloudConvert task definition.
 */
export type Any = TaskDefinition<string, OperationName, any, any, any>;

type OperationResult<Op extends OperationName, Payload> = Op extends "metadata"
  ? {
      readonly metadata?: unknown;
      readonly files?: ReadonlyArray<TypedFileResult<Payload>>;
      readonly [key: string]: unknown;
    }
  : Op extends "command"
    ? {
        readonly output?: string;
        readonly files?: ReadonlyArray<TypedFileResult<Payload>>;
        readonly [key: string]: unknown;
      }
    : {
        readonly files?: ReadonlyArray<TypedFileResult<Payload>>;
        readonly [key: string]: unknown;
      };

/**
 * CloudConvert file result enriched with the payload type that produced it.
 */
export type TypedFileResult<Payload = unknown> = FileResult & {
  readonly inferredFrom?: Payload;
};

/**
 * Runtime task result inferred from a task definition.
 */
export type TaskResultOf<Task extends Any> = TypedTaskResult<
  Task["name"],
  Task["operation"],
  Task["payload"]
>;

/**
 * Runtime task result with explicitly supplied name, operation, and payload
 * types.
 */
export type TypedTaskResult<Name extends string, Op extends OperationName, Payload> = Omit<
  JobTask,
  "name" | "operation" | "payload" | "result"
> & {
  readonly name: Name;
  readonly operation: Op;
  readonly payload: Payload;
  readonly result?: OperationResult<Op, Payload>;
};

/**
 * Serialized CloudConvert task payload produced from a typed task definition.
 */
export type BuiltTask<Task extends Any> = {
  readonly operation: Task["operation"];
  readonly ignore_error?: boolean;
} & BuiltPayload<Task["payload"]>;

type BuiltPayload<Payload> = Payload extends { readonly input: infer Input }
  ? Omit<Payload, "input"> & {
      readonly input: Input extends Ref.InputValue ? string | string[] : Input;
    }
  : Payload extends { input: infer Input }
    ? Omit<Payload, "input"> & {
        input: Input extends Ref.InputValue ? string | string[] : Input;
      }
    : Payload extends { readonly input?: infer Input }
      ? Omit<Payload, "input"> & {
          readonly input?: Input extends Ref.InputValue ? string | string[] : Input;
        }
      : Payload extends { input?: infer Input }
        ? Omit<Payload, "input"> & {
            input?: Input extends Ref.InputValue ? string | string[] : Input;
          }
        : Payload;

const pipe = function <A>(this: A) {
  return pipeArguments(this, arguments) as A;
};

function makeTask<
  const Name extends string,
  const Op extends OperationName,
  const Payload extends TaskPayload<Op>,
  const Provides extends string,
>(
  name: Name,
  operation: Op,
  payload: Payload,
  provides: ReadonlyArray<Provides>,
  ignoreError = false,
): TaskDefinition<Name, Op, Payload, TaskDependencies<Payload>, Provides> {
  return {
    [TaskTypeId]: {
      _TypeId: TaskTypeId,
    },
    name,
    operation,
    payload,
    ignoreError,
    provides,
    pipe,
  };
}

function payloadFromConfig<
  const Name extends string,
  const Op extends OperationName,
  const Payload extends TaskPayload<Op>,
  const Provides extends string,
>(config: MakeConfig<Name, Op, Payload, Provides>): Payload {
  const { name: _, operation: __, ignore_error: ___, provides: ____, ...payload } = config;
  return payload as unknown as Payload;
}

function payloadFromOperationConfig<
  const Name extends string,
  const Op extends OperationName,
  const Payload extends TaskPayload<Op>,
  const Provides extends string,
>(
  config: {
    readonly name: Name;
    readonly ignore_error?: boolean;
    readonly provides?: ProvidesInput<Provides>;
  } & Payload,
): Payload {
  const { name: _, ignore_error: __, provides: ___, ...payload } = config;
  return payload as unknown as Payload;
}

function hasInput(
  payload: object,
): payload is { readonly input?: Ref.InputValue } | { input?: Ref.InputValue } {
  return "input" in payload;
}

/**
 * Returns `true` when the provided value is a typed CloudConvert task
 * definition.
 */
export function isTask(value: unknown): value is Any {
  return typeof value === "object" && value !== null && TaskTypeId in value;
}

/**
 * Builds a CloudConvert task payload from a typed task definition.
 *
 * This resolves typed refs in `input` fields into the plain string task names
 * expected by CloudConvert.
 *
 * @example
 * ```ts
 * import { Ref, Task } from "typed-cloudconvert";
 *
 * const task = Task.convert({
 *   name: "convert-file",
 *   input: Ref.placeholder("source"),
 *   output_format: "pdf",
 * });
 *
 * const built = Task.build(task, {
 *   source: "import-file",
 * });
 * ```
 */
export function build<Task extends Any>(
  task: Task,
  bindings: Readonly<Record<string, string>>,
): BuiltTask<Task> {
  const payload = task.payload;

  const builtPayload = hasInput(payload)
    ? {
        ...payload,
        input:
          payload.input === undefined ? undefined : Ref.resolveInput(payload.input, { bindings }),
      }
    : payload;

  return {
    operation: task.operation,
    ...(task.ignoreError ? { ignore_error: true } : {}),
    ...builtPayload,
  };
}

/**
 * Configuration accepted by `Task.make(...)`.
 */
export type MakeConfig<
  Name extends string,
  Op extends OperationName,
  Payload extends TaskPayload<Op> = TaskPayload<Op>,
  Provides extends string = never,
> = {
  readonly name: Name;
  readonly operation: Op;
  readonly ignore_error?: boolean;
  readonly provides?: ProvidesInput<Provides>;
} & Payload;

/**
 * Creates a task definition from an explicit operation and payload.
 *
 * Prefer the operation-specific helpers such as `Task.importUrl(...)` or
 * `Task.convert(...)` when possible. `Task.make(...)` is useful when you want
 * one generic constructor in your own abstractions.
 *
 * @example
 * ```ts
 * import { Task } from "typed-cloudconvert";
 *
 * const task = Task.make({
 *   name: "export-file",
 *   operation: "export/url",
 *   input: "convert-file",
 * });
 * ```
 */
export function make<
  const Name extends string,
  const Op extends OperationName,
  const Payload extends TaskPayload<Op>,
  const Provides extends string = never,
>(
  config: MakeConfig<Name, Op, Payload, Provides>,
): TaskDefinition<Name, Op, Payload, TaskDependencies<Payload>, Provides> {
  return makeTask(
    config.name,
    config.operation,
    payloadFromConfig(config),
    normalizeProvides(config.provides),
    config.ignore_error ?? false,
  );
}

function makeOperation<Op extends OperationName>(operation: Op) {
  return <
    const Name extends string,
    const Payload extends TaskPayload<Op>,
    const Provides extends string = never,
  >(
    config: {
      readonly name: Name;
      readonly ignore_error?: boolean;
      readonly provides?: ProvidesInput<Provides>;
    } & Payload,
  ): TaskDefinition<Name, Op, Payload, TaskDependencies<Payload>, Provides> => {
    return makeTask(
      config.name,
      operation,
      payloadFromOperationConfig(config),
      normalizeProvides(config.provides),
      config.ignore_error ?? false,
    );
  };
}

/**
 * Constructor type for operation-specific task helpers.
 */
export type TaskConstructor<Op extends OperationName> = <
  const Name extends string,
  const Payload extends TaskPayload<Op>,
  const Provides extends string = never,
>(
  config: {
    readonly name: Name;
    readonly ignore_error?: boolean;

    /**
     * The alias name that will be used to reference this task in other tasks.
     */
    readonly provides?: ProvidesInput<Provides>;
  } & Payload,
) => TaskDefinition<Name, Op, Payload, TaskDependencies<Payload>, Provides>;

function normalizeProvides<Provides extends string>(
  provides: ProvidesInput<Provides> | undefined,
): ReadonlyArray<Provides> {
  if (provides === undefined) {
    return [];
  }

  if (Array.isArray(provides)) {
    return provides;
  }

  return [provides as Provides];
}

/**
 * Creates an `import/url` task.
 *
 * @example
 * ```ts
 * import { Task } from "typed-cloudconvert";
 *
 * const task = Task.importUrl({
 *   name: "import-file",
 *   url: "https://example.com/input.pdf",
 * });
 * ```
 */
export const importUrl: TaskConstructor<"import/url"> = makeOperation("import/url");

/**
 * Creates an `import/upload` task.
 */
export const importUpload: TaskConstructor<"import/upload"> = makeOperation("import/upload");

/**
 * Creates an `import/base64` task.
 */
export const importBase64: TaskConstructor<"import/base64"> = makeOperation("import/base64");

/**
 * Creates an `import/raw` task.
 */
export const importRaw: TaskConstructor<"import/raw"> = makeOperation("import/raw");

/**
 * Creates an `import/s3` task.
 */
export const importS3: TaskConstructor<"import/s3"> = makeOperation("import/s3");

/**
 * Creates an `import/azure/blob` task.
 */
export const importAzureBlob: TaskConstructor<"import/azure/blob"> =
  makeOperation("import/azure/blob");

/**
 * Creates an `import/google-cloud-storage` task.
 */
export const importGoogleCloudStorage: TaskConstructor<"import/google-cloud-storage"> =
  makeOperation("import/google-cloud-storage");

/**
 * Creates an `import/openstack` task.
 */
export const importOpenStack: TaskConstructor<"import/openstack"> =
  makeOperation("import/openstack");

/**
 * Creates an `import/sftp` task.
 */
export const importSftp: TaskConstructor<"import/sftp"> = makeOperation("import/sftp");

/**
 * Creates a `convert` task.
 *
 * @example
 * ```ts
 * import { Task } from "typed-cloudconvert";
 *
 * const task = Task.convert({
 *   name: "convert-file",
 *   input: "import-file",
 *   output_format: "png",
 * });
 * ```
 */
export const convert: TaskConstructor<"convert"> = makeOperation("convert");

/**
 * Creates an `optimize` task.
 */
export const optimize: TaskConstructor<"optimize"> = makeOperation("optimize");

/**
 * Creates a `watermark` task.
 */
export const watermark: TaskConstructor<"watermark"> = makeOperation("watermark");

/**
 * Creates a `capture-website` task.
 */
export const captureWebsite: TaskConstructor<"capture-website"> = makeOperation("capture-website");

/**
 * Creates a `thumbnail` task.
 */
export const thumbnail: TaskConstructor<"thumbnail"> = makeOperation("thumbnail");

/**
 * Creates a `metadata` task.
 */
export const metadata: TaskConstructor<"metadata"> = makeOperation("metadata");

/**
 * Creates a `metadata/write` task.
 */
export const metadataWrite: TaskConstructor<"metadata/write"> = makeOperation("metadata/write");

/**
 * Creates a `merge` task.
 */
export const merge: TaskConstructor<"merge"> = makeOperation("merge");

/**
 * Creates an `archive` task.
 */
export const archive: TaskConstructor<"archive"> = makeOperation("archive");

/**
 * Creates a `command` task.
 */
export const command: TaskConstructor<"command"> = makeOperation("command");

/**
 * Creates an `export/url` task.
 *
 * @example
 * ```ts
 * import { Task } from "typed-cloudconvert";
 *
 * const task = Task.exportUrl({
 *   name: "export-file",
 *   input: "convert-file",
 * });
 * ```
 */
export const exportUrl: TaskConstructor<"export/url"> = makeOperation("export/url");

/**
 * Creates an `export/s3` task.
 */
export const exportS3: TaskConstructor<"export/s3"> = makeOperation("export/s3");

/**
 * Creates an `export/azure/blob` task.
 */
export const exportAzureBlob: TaskConstructor<"export/azure/blob"> =
  makeOperation("export/azure/blob");

/**
 * Creates an `export/google-cloud-storage` task.
 */
export const exportGoogleCloudStorage: TaskConstructor<"export/google-cloud-storage"> =
  makeOperation("export/google-cloud-storage");

/**
 * Creates an `export/openstack` task.
 */
export const exportOpenStack: TaskConstructor<"export/openstack"> =
  makeOperation("export/openstack");

/**
 * Creates an `export/sftp` task.
 */
export const exportSftp: TaskConstructor<"export/sftp"> = makeOperation("export/sftp");
