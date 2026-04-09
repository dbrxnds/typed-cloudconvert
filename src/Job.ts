import type { Job as CloudConvertJob } from "cloudconvert/built/lib/JobsResource.js";

import { dual, pipeArguments, type Pipeable } from "./internal/pipe.js";
import type * as Ref from "./Ref.js";
import * as Task from "./Task.js";

/**
 * Unique string identifier carried by typed job plans.
 */
export const JobTypeId = "~typed-cloudconvert/Job";

interface DuplicateProvidedNameIssue<Name extends string = string> {
  readonly _tag: "DuplicateProvidedNameIssue";
  readonly name: Name;
}

/**
 * Internal dependency fact carried by a `JobPlan`.
 */
export interface DependencyRequirement<
  ByTask extends string = string,
  RefName extends string = string,
  Field extends string = "input",
> {
  readonly _tag: "DependencyRequirement";
  readonly byTask: ByTask;
  readonly ref: RefName;
  readonly field: Field;
}

type JobIssue = DuplicateProvidedNameIssue;

/**
 * Immutable typed description of a CloudConvert job under construction.
 *
 * A `JobPlan` tracks the ordered task list together with compile-time facts
 * about what task names and aliases are already available, which refs are still
 * unresolved, and which duplicate names have been introduced.
 *
 * @example
 * ```ts
 * import { Job, Task } from "typed-cloudconvert";
 *
 * const plan = Job.empty().pipe(
 *   Job.add(
 *     Task.importUrl({
 *       name: "import-file",
 *       url: "https://example.com/input.pdf",
 *     }),
 *   ),
 *   Job.add(
 *     Task.convert({
 *       name: "convert-file",
 *       input: "import-file",
 *       output_format: "png",
 *     }),
 *   ),
 * );
 * ```
 */
export interface JobPlan<
  Tasks extends readonly Task.Any[] = readonly [],
  Provided extends string = never,
  Required extends DependencyRequirement<any, any, any> = never,
  TaskIndex extends Record<string, Task.Any> = {},
  Bindings extends Readonly<Record<string, string>> = {},
  Issues extends JobIssue = never,
> extends Pipeable {
  readonly [JobTypeId]: {
    readonly _TypeId: typeof JobTypeId;
    readonly _Provided?: Provided;
    readonly _Required?: Required;
    readonly _TaskIndex?: TaskIndex;
    readonly _Issues?: Issues;
  };
  readonly tasks: Tasks;
  readonly bindings: Bindings;
}

/**
 * Any typed CloudConvert job plan.
 */
export type Any = JobPlan<any, any, any, any, any, any>;

/**
 * Extracts the ordered task tuple from a job plan.
 */
export type TasksOf<Job extends Any> = Job["tasks"];

/**
 * Extracts the union of provided task names and aliases known by a job plan.
 */
export type ProvidedOf<Job extends Any> =
  Job extends JobPlan<any, infer Provided, any, any, any, any> ? Provided : never;

/**
 * Extracts the full dependency requirement records tracked by a job plan.
 */
export type RequirementDetailsOf<Job extends Any> =
  Job extends JobPlan<any, any, infer Required, any, any, any> ? Required : never;

type RequirementRef<Requirement> =
  Requirement extends DependencyRequirement<any, infer Ref, any> ? Ref : never;

type RequirementMessage<Requirement> =
  Requirement extends DependencyRequirement<infer ByTask, infer Ref, infer Field>
    ? `'${ByTask}' references '${Ref}' via '${Field}', but it does not exist`
    : never;

type MissingDependencyText<Missing> =
  Missing extends DependencyRequirement<any, any, any> ? RequirementMessage<Missing> : never;

type DuplicateProvidedNameText<Names extends string> =
  `Multiple tasks named '${Names}' exist in the job plan`;

type SatisfyRequirements<Requirements, Provided extends string> = Requirements extends any
  ? RequirementRef<Requirements> extends Provided
    ? never
    : Requirements
  : never;

type TaskRequirements<Definition extends Task.Any> =
  Task.TaskDependencies<Definition["payload"]> extends infer Dependency
    ? Dependency extends string
      ? DependencyRequirement<Definition["name"], Dependency, "input">
      : never
    : never;

type BindingRequirement<
  Name extends string,
  Output extends Ref.OutputRef<string>,
> = DependencyRequirement<Name, Output["task"], "binding">;

/**
 * Extracts the unresolved task names or placeholder aliases still required by a
 * job plan.
 *
 * @example
 * ```ts
 * import { Job, Ref, Task } from "typed-cloudconvert";
 *
 * const fragment = Job.empty().pipe(
 *   Job.add(
 *     Task.convert({
 *       name: "convert-file",
 *       input: Ref.placeholder("source"),
 *       output_format: "pdf",
 *     }),
 *   ),
 * );
 *
 * type Missing = Job.RequiredOf<typeof fragment>;
 * ```
 */
export type RequiredOf<Job extends Any> = RequirementRef<RequirementDetailsOf<Job>>;

/**
 * Extracts the map from task names to task definitions for a job plan.
 */
export type TaskIndexOf<Job extends Any> =
  Job extends JobPlan<any, any, any, infer TaskIndex, any, any> ? TaskIndex : never;

/**
 * Extracts the alias bindings tracked by a job plan.
 */
export type BindingsOf<Job extends Any> =
  Job extends JobPlan<any, any, any, any, infer Bindings, any> ? Bindings : never;

/**
 * Extracts the tracked issue records for a job plan.
 */
export type IssuesOf<Job extends Any> =
  Job extends JobPlan<any, any, any, any, any, infer Issues> ? Issues : never;

type DuplicateNamesOf<Issues> =
  Issues extends DuplicateProvidedNameIssue<infer Name> ? Name : never;

type AddTaskProvidedNames<Definition extends Task.Any> =
  | Definition["name"]
  | Task.ProvidedAliasesOf<Definition>;

type AddTaskBindings<Definition extends Task.Any> = [Task.ProvidedAliasesOf<Definition>] extends [
  never,
]
  ? {}
  : {
      readonly [Name in Task.ProvidedAliasesOf<Definition>]: Definition["name"];
    };

type DuplicateProvidedNames<Job extends Any, Definition extends Task.Any> = Extract<
  AddTaskProvidedNames<Definition>,
  ProvidedOf<Job>
>;

type AddTaskIssue<Job extends Any, Definition extends Task.Any> = [
  DuplicateProvidedNames<Job, Definition>,
] extends [never]
  ? never
  : DuplicateProvidedNameIssue<DuplicateProvidedNames<Job, Definition>>;

type AddTaskIndex<
  Job extends Any,
  Definition extends Task.Any,
> = Definition["name"] extends keyof TaskIndexOf<Job>
  ? TaskIndexOf<Job>
  : TaskIndexOf<Job> & {
      readonly [Name in Definition["name"]]: Definition;
    };

type AddTaskResult<Job extends Any, Definition extends Task.Any> = JobPlan<
  readonly [...TasksOf<Job>, Definition],
  ProvidedOf<Job> | AddTaskProvidedNames<Definition>,
  SatisfyRequirements<
    RequirementDetailsOf<Job> | TaskRequirements<Definition>,
    ProvidedOf<Job> | AddTaskProvidedNames<Definition>
  >,
  AddTaskIndex<Job, Definition>,
  BindingsOf<Job> & AddTaskBindings<Definition>,
  IssuesOf<Job> | AddTaskIssue<Job, Definition>
>;

type MergeTasks<Left extends Any, Right extends readonly Task.Any[]> = Right extends readonly [
  infer Head extends Task.Any,
  ...infer Tail extends readonly Task.Any[],
]
  ? MergeTasks<AddTaskResult<Left, Head>, Tail>
  : Left;

type MergeBindings<Job extends Any, Bindings extends Readonly<Record<string, string>>> = JobPlan<
  TasksOf<Job>,
  ProvidedOf<Job> | Extract<keyof Bindings, string>,
  SatisfyRequirements<
    | RequirementDetailsOf<Job>
    | DependencyRequirement<
        Extract<keyof Bindings, string>,
        Bindings[keyof Bindings & string],
        "binding"
      >,
    ProvidedOf<Job> | Extract<keyof Bindings, string>
  >,
  TaskIndexOf<Job>,
  BindingsOf<Job> & Bindings,
  IssuesOf<Job>
>;

type MergeResult<Left extends Any, Right extends Any> = MergeBindings<
  MergeTasks<Left, TasksOf<Right>>,
  BindingsOf<Right>
>;

type AddBindingResult<
  Job extends Any,
  Name extends string,
  Output extends Ref.OutputRef<string>,
> = JobPlan<
  TasksOf<Job>,
  ProvidedOf<Job> | Name,
  SatisfyRequirements<
    RequirementDetailsOf<Job> | BindingRequirement<Name, Output>,
    ProvidedOf<Job> | Name
  >,
  TaskIndexOf<Job>,
  BindingsOf<Job> & {
    readonly [Key in Name]: Output["task"];
  },
  IssuesOf<Job> | (Name extends ProvidedOf<Job> ? DuplicateProvidedNameIssue<Name> : never)
>;

/**
 * Branded compile-time error produced when a job plan contains duplicate task
 * names or aliases.
 */
export type DuplicateTaskNameError<Job extends Any, Names extends string> = Job & {
  readonly ["~cloudconvert_error"]: DuplicateProvidedNameText<Names>;
  readonly ["~cloudconvert_hint"]: "Each task name and provided alias must be unique within a job";
  readonly ["~cloudconvert_duplicate_task_names"]: Names;
};

/**
 * Branded compile-time error produced when a job plan still has unresolved
 * dependencies.
 */
export type MissingDependencyError<
  Job extends Any,
  Missing extends DependencyRequirement<any, any, any>,
> = Job & {
  readonly ["~cloudconvert_error"]: MissingDependencyText<Missing>;
  readonly ["~cloudconvert_missing_refs"]: RequirementRef<Missing>;
  readonly ["~cloudconvert_missing_dependencies"]: Missing;
  readonly ["~cloudconvert_hint"]: 'Add the missing task, or satisfy the placeholder with a task alias such as provides: "source"';
};

/**
 * Narrows a job plan to those whose dependencies and aliases are fully
 * satisfied.
 *
 * Incomplete plans remain valuable while you are composing reusable fragments,
 * but `CompleteJob` represents the state required by `Job.build(...)`.
 *
 */
export type CompleteJob<Job extends Any> = [DuplicateNamesOf<IssuesOf<Job>>] extends [never]
  ? [RequirementDetailsOf<Job>] extends [never]
    ? Job
    : MissingDependencyError<Job, Extract<RequirementDetailsOf<Job>, DependencyRequirement>>
  : DuplicateTaskNameError<Job, Extract<DuplicateNamesOf<IssuesOf<Job>>, string>>;

/**
 * Extracts the branded error message from a compile-time job error.
 */
export type BrandedErrorOf<Value> = Value extends {
  readonly ["~cloudconvert_error"]: infer Error;
}
  ? Error
  : never;

/**
 * Extracts the branded hint message from a compile-time job error.
 */
export type BrandedHintOf<Value> = Value extends {
  readonly ["~cloudconvert_hint"]: infer Hint;
}
  ? Hint
  : never;

/**
 * Extracts the unresolved ref names from a compile-time missing dependency
 * error.
 */
export type BrandedMissingRefsOf<Value> = Value extends {
  readonly ["~cloudconvert_missing_refs"]: infer MissingRefs;
}
  ? MissingRefs
  : never;

type CompleteInput<Job extends Any> = Job &
  ([Job] extends [CompleteJob<Job>]
    ? unknown
    : {
        readonly ["~cloudconvert_error"]: BrandedErrorOf<CompleteJob<Job>>;
      });

type TaskResultMap<Job extends Any> = {
  readonly [Name in keyof TaskIndexOf<Job> & string]: Task.TaskResultOf<TaskIndexOf<Job>[Name]>;
};

/**
 * Union of typed runtime task results for every task in a job plan.
 */
export type TaskResultUnion<Job extends Any> = TaskResultMap<Job>[keyof TaskResultMap<Job>];

/**
 * Typed runtime view of a CloudConvert job response.
 *
 * The `tasks` array and `tasksByName` index preserve the task-level types from
 * the original plan.
 *
 */
export interface JobResult<Job extends Any> extends Omit<CloudConvertJob, "tasks">, Pipeable {
  readonly tasks: ReadonlyArray<TaskResultUnion<Job>>;
  readonly tasksByName: TaskResultMap<Job>;
}

/**
 * Alias for `JobResult<Job>`.
 *
 */
export type JobResultOf<Job extends Any> = JobResult<Job>;

type BuiltTasks<Job extends Any> = {
  readonly [Name in keyof TaskIndexOf<Job> & string]: Task.BuiltTask<TaskIndexOf<Job>[Name]>;
};

/**
 * Tagged error raised when a fetched CloudConvert job response is missing a
 * task declared in the plan.
 */
export class MissingTaskInResponseError extends Error {
  readonly _tag = "MissingTaskInResponseError";
  readonly name = "MissingTaskInResponseError";

  constructor(readonly taskName: string) {
    super(`Missing task in CloudConvert response: ${taskName}`);
  }
}

/**
 * Tagged error raised when a raw CloudConvert job cannot be interpreted using
 * the plan.
 */
export class JobInterpretationError extends Error {
  readonly _tag = "JobInterpretationError";
  readonly name = "JobInterpretationError";

  constructor(
    readonly cause: unknown,
    message = "Failed to interpret CloudConvert job response",
  ) {
    super(message);
  }
}

function pipe<A>(this: A) {
  return pipeArguments(this, arguments) as A;
}

type Mutable<A> = {
  -readonly [K in keyof A]: A[K];
};

type RawTask = CloudConvertJob["tasks"][number];

function taskBindings(task: Task.Any): Readonly<Record<string, string>> {
  return Object.fromEntries(task.provides.map((name) => [name, task.name]));
}

function appendTask<Tasks extends readonly Task.Any[], Definition extends Task.Any>(
  tasks: Tasks,
  definition: Definition,
): readonly [...Tasks, Definition] {
  return [...tasks, definition] as readonly [...Tasks, Definition];
}

function mergeBindingRecords<
  Left extends Readonly<Record<string, string>>,
  Right extends Readonly<Record<string, string>>,
>(left: Left, right: Right): Left & Right {
  return {
    ...left,
    ...right,
  };
}

function bindingRecord<const Name extends string, const Value extends string>(
  name: Name,
  value: Value,
): { readonly [Key in Name]: Value } {
  return { [name]: value } as { readonly [Key in Name]: Value };
}

function mergeTaskList<Left extends Any, Right extends readonly Task.Any[]>(
  left: Left,
  right: Right,
): MergeTasks<Left, Right> {
  return right.reduce<Any>((job, task) => add(job, task), left) as MergeTasks<Left, Right>;
}

function makeJob<Result extends Any>(tasks: Result["tasks"], bindings: Result["bindings"]): Result;
function makeJob<
  Tasks extends readonly Task.Any[],
  Provided extends string,
  Required extends DependencyRequirement<any, any, any>,
  TaskIndex extends Record<string, Task.Any>,
  Bindings extends Readonly<Record<string, string>>,
  Issues extends JobIssue,
>(
  tasks: Tasks,
  bindings: Bindings,
): JobPlan<Tasks, Provided, Required, TaskIndex, Bindings, Issues>;
function makeJob(tasks: readonly Task.Any[], bindings: Readonly<Record<string, string>>): Any {
  return {
    [JobTypeId]: {
      _TypeId: JobTypeId,
    },
    tasks,
    bindings,
    pipe,
  };
}

function buildTasks<Job extends Any>(job: Job): BuiltTasks<Job> {
  const tasks: Record<string, Task.BuiltTask<Task.Any>> = Object.create(null);

  for (const task of job.tasks) {
    tasks[task.name] = Task.build(task, job.bindings);
  }

  return tasks as BuiltTasks<Job>;
}

function makeTaskResult<Definition extends Task.Any>(
  definition: Definition,
  task: RawTask,
): Task.TaskResultOf<Definition> {
  return {
    ...task,
    name: definition.name,
    operation: definition.operation,
    payload: task.payload as Definition["payload"],
    result: task.result as Task.TaskResultOf<Definition>["result"],
  };
}

/**
 * Returns `true` when the provided value is a typed CloudConvert job plan.
 */
export function isJob(value: unknown): value is Any {
  return typeof value === "object" && value !== null && JobTypeId in value;
}

/**
 * Creates an empty typed job plan.
 *
 * @example
 * ```ts
 * import { Job } from "typed-cloudconvert";
 *
 * const plan = Job.empty();
 * ```
 */
export function empty(): JobPlan {
  return makeJob<readonly [], never, never, {}, {}, never>([], {});
}

/**
 * Creates a job plan from a list of task definitions.
 *
 * This is a convenient shorthand for `Job.empty().pipe(Job.add(...), ...)`.
 *
 * @example
 * ```ts
 * import { Job, Task } from "typed-cloudconvert";
 *
 * const plan = Job.make(
 *   Task.importUrl({
 *     name: "import-file",
 *     url: "https://example.com/input.pdf",
 *   }),
 *   Task.exportUrl({
 *     name: "export-file",
 *     input: "import-file",
 *   }),
 * );
 * ```
 */
export function make<const Tasks extends readonly Task.Any[]>(
  ...tasks: Tasks
): MergeTasks<JobPlan, Tasks> {
  return tasks.reduce<Any>((job, task) => add(job, task), empty()) as MergeTasks<JobPlan, Tasks>;
}

/**
 * Adds a task to a job plan.
 *
 * This preserves task literal types and immediately updates the plan's tracked
 * dependencies, aliases, and duplicate-name checks.
 *
 * @example
 * ```ts
 * import { Job, Task } from "typed-cloudconvert";
 *
 * const plan = Job.empty().pipe(
 *   Job.add(
 *     Task.importUrl({
 *       name: "import-file",
 *       url: "https://example.com/input.pdf",
 *     }),
 *   ),
 * );
 * ```
 */
export const add: {
  <Definition extends Task.Any>(
    definition: Definition,
  ): <Job extends Any>(job: Job) => AddTaskResult<Job, Definition>;
  <Job extends Any, Definition extends Task.Any>(
    job: Job,
    definition: Definition,
  ): AddTaskResult<Job, Definition>;
} = dual(
  2,
  <Job extends Any, Definition extends Task.Any>(
    job: Job,
    definition: Definition,
  ): AddTaskResult<Job, Definition> =>
    makeJob<AddTaskResult<Job, Definition>>(
      appendTask(job.tasks, definition) as AddTaskResult<Job, Definition>["tasks"],
      mergeBindingRecords(job.bindings, taskBindings(definition)),
    ),
);

/**
 * Manually satisfies a placeholder alias with a concrete task output.
 *
 * Most users should prefer task-level `provides` aliases instead.
 *
 * @example
 * ```ts
 * import { Job, Ref, Task } from "typed-cloudconvert";
 *
 * const fragment = Job.empty().pipe(
 *   Job.add(
 *     Task.convert({
 *       name: "convert-file",
 *       input: Ref.placeholder("source"),
 *       output_format: "pdf",
 *     }),
 *   ),
 * );
 *
 * const plan = Job.empty().pipe(
 *   Job.add(
 *     Task.importUrl({
 *       name: "import-file",
 *       url: "https://example.com/input.pdf",
 *     }),
 *   ),
 *   Job.provide("source", Ref.output("import-file")),
 *   Job.merge(fragment),
 * );
 * ```
 */
export const provide: {
  <const Name extends string, const Output extends Ref.OutputRef<string>>(
    name: Name,
    output: Output,
  ): <Job extends Any>(job: Job) => AddBindingResult<Job, Name, Output>;
  <Job extends Any, const Name extends string, const Output extends Ref.OutputRef<string>>(
    job: Job,
    name: Name,
    output: Output,
  ): AddBindingResult<Job, Name, Output>;
} = dual(
  3,
  <Job extends Any, const Name extends string, const Output extends Ref.OutputRef<string>>(
    job: Job,
    name: Name,
    output: Output,
  ): AddBindingResult<Job, Name, Output> =>
    makeJob(job.tasks, mergeBindingRecords(job.bindings, bindingRecord(name, output.task))),
);

/**
 * Merges two job plans, preserving both tasks and alias bindings.
 *
 * This is especially useful for composing reusable fragments that were defined
 * independently.
 *
 * @example
 * ```ts
 * import { Job, Ref, Task } from "typed-cloudconvert";
 *
 * const fragment = Job.empty().pipe(
 *   Job.add(
 *     Task.convert({
 *       name: "convert-file",
 *       input: Ref.placeholder("source"),
 *       output_format: "pdf",
 *     }),
 *   ),
 * );
 *
 * const plan = Job.empty().pipe(
 *   Job.add(
 *     Task.importUrl({
 *       name: "import-file",
 *       provides: "source",
 *       url: "https://example.com/input.pdf",
 *     }),
 *   ),
 *   Job.merge(fragment),
 * );
 * ```
 */
export const merge: {
  <Right extends Any>(right: Right): <Left extends Any>(left: Left) => MergeResult<Left, Right>;
  <Left extends Any, Right extends Any>(left: Left, right: Right): MergeResult<Left, Right>;
} = dual(
  2,
  <Left extends Any, Right extends Any>(left: Left, right: Right): MergeResult<Left, Right> => {
    const mergedTasks = mergeTaskList(left, right.tasks);

    return makeJob(mergedTasks.tasks, mergeBindingRecords(mergedTasks.bindings, right.bindings));
  },
);

/**
 * Builds a CloudConvert job payload from a complete typed job plan.
 *
 * Incomplete plans are rejected at compile time with branded error messages
 * that explain what is still missing.
 *
 * @example
 * ```ts
 * import { Job, Task } from "typed-cloudconvert";
 *
 * const plan = Job.empty().pipe(
 *   Job.add(
 *     Task.importUrl({
 *       name: "import-file",
 *       url: "https://example.com/input.pdf",
 *     }),
 *   ),
 *   Job.add(
 *     Task.exportUrl({
 *       name: "export-file",
 *       input: "import-file",
 *     }),
 *   ),
 * );
 *
 * const built = Job.build(plan);
 * ```
 */
export function build<Job extends Any>(job: CompleteInput<Job>): BuiltTasks<Job> {
  return buildTasks(job);
}

/**
 * Interprets a raw CloudConvert job using a typed job plan.
 *
 * The returned job result keeps the original CloudConvert response shape while
 * restoring typed access to known tasks via `tasksByName`.
 *
 * @example
 * ```ts
 * import { Job, Task } from "typed-cloudconvert";
 *
 * const plan = Job.make(
 *   Task.importUrl({
 *     name: "import-file",
 *     url: "https://example.com/input.pdf",
 *   }),
 * );
 *
 * // Later, after fetching a raw CloudConvert job response:
 * // const typed = Job.interpret(plan, rawJob)
 * ```
 */
export function interpret<Job extends Any>(plan: Job, job: CloudConvertJob): JobResult<Job> {
  const tasksByName = Object.create(null) as Mutable<TaskResultMap<Job>>;

  try {
    for (const definition of plan.tasks) {
      const task = job.tasks.find((item) => item.name === definition.name);

      if (task === undefined) {
        throw new MissingTaskInResponseError(definition.name);
      }

      const name = definition.name as keyof TaskResultMap<Job> & string;
      tasksByName[name] = makeTaskResult(definition, task) as TaskResultMap<Job>[typeof name];
    }

    return {
      ...job,
      tasks: job.tasks.map((task) => {
        const knownTask = tasksByName[task.name];
        return knownTask ?? task;
      }),
      tasksByName,
      pipe,
    };
  } catch (cause) {
    if (cause instanceof MissingTaskInResponseError || cause instanceof JobInterpretationError) {
      throw cause;
    }

    throw new JobInterpretationError(cause);
  }
}
