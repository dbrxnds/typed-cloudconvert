import { pipeArguments } from "effect/Pipeable";
import type { Pipeable } from "effect/Pipeable";

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

import * as Ref from "./Ref.js";

/**
 * Unique symbol carried by typed task definitions.
 */
export const TaskTypeId = Symbol.for("effect-cloudconvert/Task");

/**
 * Supported CloudConvert task operation names.
 */
export type OperationName = Operation["operation"];

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

export type TaskPayload<Op extends OperationName> = WithTaskInputs<OperationMap[Op]>;

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

export type ProvidedAliasesOf<Task extends Any> = Task[typeof TaskTypeId]["_Provides"];

/**
 * Immutable typed description of a CloudConvert task.
 *
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
    readonly _Name: Name;
    readonly _Operation: Op;
    readonly _Payload: Payload;
    readonly _Requires: Requires;
    readonly _Provides: Provides;
  };
  readonly name: Name;
  readonly operation: Op;
  readonly payload: Payload;
  readonly ignoreError: boolean;
  readonly provides: ReadonlyArray<Provides>;
}

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

export type TypedTaskResult<Name extends string, Op extends OperationName, Payload> = Omit<
  JobTask,
  "name" | "operation" | "payload" | "result"
> & {
  readonly name: Name;
  readonly operation: Op;
  readonly payload: Payload;
  readonly result?: OperationResult<Op, Payload>;
};

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
      _Name: name,
      _Operation: operation,
      _Payload: payload,
      _Requires: undefined as never,
      _Provides: undefined as never,
    },
    name,
    operation,
    payload,
    ignoreError,
    provides,
    pipe,
  };
}

export function isTask(value: unknown): value is Any {
  return typeof value === "object" && value !== null && TaskTypeId in value;
}

/**
 * Builds a CloudConvert task payload from a typed task definition.
 */
export function build(task: Any, bindings: Readonly<Record<string, string>>): BuiltTask<Any> {
  const payload = task.payload as Record<string, unknown>;

  const builtPayload =
    "input" in payload
      ? {
          ...payload,
          input:
            payload.input === undefined
              ? undefined
              : Ref.resolveInput(payload.input as Ref.InputValue, { bindings }),
        }
      : payload;

  return {
    operation: task.operation,
    ...(task.ignoreError ? { ignore_error: true } : {}),
    ...builtPayload,
  } as BuiltTask<Any>;
}

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
 */
export function make<
  const Name extends string,
  const Op extends OperationName,
  const Payload extends TaskPayload<Op>,
  const Provides extends string = never,
>(
  config: MakeConfig<Name, Op, Payload, Provides>,
): TaskDefinition<Name, Op, Payload, TaskDependencies<Payload>, Provides> {
  const { name, operation, ignore_error, provides, ...payload } = config;
  return makeTask(
    name,
    operation,
    payload as unknown as Payload,
    normalizeProvides(provides),
    ignore_error ?? false,
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
    const { name, ignore_error, provides, ...payload } = config;
    return makeTask(
      name,
      operation,
      payload as unknown as Payload,
      normalizeProvides(provides),
      ignore_error ?? false,
    );
  };
}

/**
 * Constructor type for operation-specific task helpers.
 *
 */
export type TaskConstructor<Op extends OperationName> = <
  const Name extends string,
  const Payload extends TaskPayload<Op>,
  const Provides extends string = never,
>(
  config: {
    readonly name: Name;
    readonly ignore_error?: boolean;
    readonly provides?: ProvidesInput<Provides>;
  } & Payload,
) => TaskDefinition<Name, Op, Payload, TaskDependencies<Payload>, Provides>;

function normalizeProvides<Provides extends string>(
  provides: ProvidesInput<Provides> | undefined,
): ReadonlyArray<Provides> {
  if (provides === undefined) {
    return [];
  }

  return (Array.isArray(provides) ? provides : [provides]) as ReadonlyArray<Provides>;
}

/**
 * Creates an `import/url` task.
 */
export const importUrl: TaskConstructor<"import/url"> = makeOperation("import/url");
export const importUpload: TaskConstructor<"import/upload"> = makeOperation("import/upload");
export const importBase64: TaskConstructor<"import/base64"> = makeOperation("import/base64");
export const importRaw: TaskConstructor<"import/raw"> = makeOperation("import/raw");
export const importS3: TaskConstructor<"import/s3"> = makeOperation("import/s3");
export const importAzureBlob: TaskConstructor<"import/azure/blob"> =
  makeOperation("import/azure/blob");
export const importGoogleCloudStorage: TaskConstructor<"import/google-cloud-storage"> =
  makeOperation("import/google-cloud-storage");
export const importOpenStack: TaskConstructor<"import/openstack"> =
  makeOperation("import/openstack");
export const importSftp: TaskConstructor<"import/sftp"> = makeOperation("import/sftp");
/**
 * Creates a `convert` task.
 */
export const convert: TaskConstructor<"convert"> = makeOperation("convert");
export const optimize: TaskConstructor<"optimize"> = makeOperation("optimize");
export const watermark: TaskConstructor<"watermark"> = makeOperation("watermark");
export const captureWebsite: TaskConstructor<"capture-website"> = makeOperation("capture-website");
export const thumbnail: TaskConstructor<"thumbnail"> = makeOperation("thumbnail");
/**
 * Creates a `metadata` task.
 */
export const metadata: TaskConstructor<"metadata"> = makeOperation("metadata");
export const metadataWrite: TaskConstructor<"metadata/write"> = makeOperation("metadata/write");
export const merge: TaskConstructor<"merge"> = makeOperation("merge");
export const archive: TaskConstructor<"archive"> = makeOperation("archive");
export const command: TaskConstructor<"command"> = makeOperation("command");
/**
 * Creates an `export/url` task.
 */
export const exportUrl: TaskConstructor<"export/url"> = makeOperation("export/url");
export const exportS3: TaskConstructor<"export/s3"> = makeOperation("export/s3");
export const exportAzureBlob: TaskConstructor<"export/azure/blob"> =
  makeOperation("export/azure/blob");
export const exportGoogleCloudStorage: TaskConstructor<"export/google-cloud-storage"> =
  makeOperation("export/google-cloud-storage");
export const exportOpenStack: TaskConstructor<"export/openstack"> =
  makeOperation("export/openstack");
export const exportSftp: TaskConstructor<"export/sftp"> = makeOperation("export/sftp");
