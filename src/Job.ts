import * as Data from "effect/Data";
import { dual } from "effect/Function";
import { pipeArguments } from "effect/Pipeable";
import type { Pipeable } from "effect/Pipeable";

import type { Job as CloudConvertJob, JobTemplate } from "cloudconvert/built/lib/JobsResource.js";

import type * as Ref from "./Ref.js";
import * as Task from "./Task.js";

/**
 * Unique symbol carried by typed job plans.
 */
export const JobTypeId = Symbol.for("effect-cloudconvert/Job");

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
    readonly _Tasks: Tasks;
    readonly _Provided: Provided;
    readonly _Required: Required;
    readonly _TaskIndex: TaskIndex;
    readonly _Bindings: Bindings;
    readonly _Issues: Issues;
  };
  readonly tasks: Tasks;
  readonly bindings: Bindings;
}

export type Any = JobPlan<any, any, any, any, any, any>;

export type TasksOf<Job extends Any> = Job["tasks"];

export type ProvidedOf<Job extends Any> =
  Job extends JobPlan<any, infer Provided, any, any, any, any> ? Provided : never;

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

export type RequiredOf<Job extends Any> = RequirementRef<RequirementDetailsOf<Job>>;

export type TaskIndexOf<Job extends Any> =
  Job extends JobPlan<any, any, any, infer TaskIndex, any, any> ? TaskIndex : never;

export type BindingsOf<Job extends Any> =
  Job extends JobPlan<any, any, any, any, infer Bindings, any> ? Bindings : never;

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

export type DuplicateTaskNameError<Job extends Any, Names extends string> = Job & {
  readonly __effect_cloudconvert_error__: DuplicateProvidedNameText<Names>;
  readonly __effect_cloudconvert_duplicate_task_names__: Names;
  readonly __effect_cloudconvert_hint__: "Each task name and provided alias must be unique within a job";
};

export type MissingDependencyError<
  Job extends Any,
  Missing extends DependencyRequirement<any, any, any>,
> = Job & {
  readonly __effect_cloudconvert_error__: MissingDependencyText<Missing>;
  readonly __effect_cloudconvert_missing_refs__: RequirementRef<Missing>;
  readonly __effect_cloudconvert_missing_dependencies__: Missing;
  readonly __effect_cloudconvert_hint__: 'Add the missing task, or satisfy the placeholder with a task alias such as provides: "source"';
};

/**
 * Narrows a job plan to those whose dependencies and aliases are fully satisfied.
 */
export type CompleteJob<Job extends Any> = [DuplicateNamesOf<IssuesOf<Job>>] extends [never]
  ? [RequirementDetailsOf<Job>] extends [never]
    ? Job
    : MissingDependencyError<Job, Extract<RequirementDetailsOf<Job>, DependencyRequirement>>
  : DuplicateTaskNameError<Job, Extract<DuplicateNamesOf<IssuesOf<Job>>, string>>;

export type BrandedErrorOf<Value> = Value extends {
  readonly __effect_cloudconvert_error__: infer Error;
}
  ? Error
  : never;

export type BrandedHintOf<Value> = Value extends {
  readonly __effect_cloudconvert_hint__: infer Hint;
}
  ? Hint
  : never;

export type BrandedMissingRefsOf<Value> = Value extends {
  readonly __effect_cloudconvert_missing_refs__: infer MissingRefs;
}
  ? MissingRefs
  : never;

type CompleteInput<Job extends Any> = Job &
  ([Job] extends [CompleteJob<Job>]
    ? unknown
    : {
        readonly __effect_cloudconvert_error__: BrandedErrorOf<CompleteJob<Job>>;
      });

type TaskResultMap<Job extends Any> = {
  readonly [Name in keyof TaskIndexOf<Job> & string]: Task.TaskResultOf<TaskIndexOf<Job>[Name]>;
};

export type TaskResultUnion<Job extends Any> = TaskResultMap<Job>[keyof TaskResultMap<Job>];

export interface JobResult<Job extends Any> extends Omit<CloudConvertJob, "tasks">, Pipeable {
  readonly tasks: ReadonlyArray<TaskResultUnion<Job>>;
  readonly tasksByName: TaskResultMap<Job>;
  task<Name extends keyof TaskResultMap<Job> & string>(name: Name): TaskResultMap<Job>[Name];
}

export type JobResultOf<Job extends Any> = JobResult<Job>;

type BuiltTasks<Job extends Any> = {
  readonly [Name in keyof TaskIndexOf<Job> & string]: Task.BuiltTask<TaskIndexOf<Job>[Name]>;
};

export type BuiltJob<Job extends Any> = Omit<JobTemplate, "tasks"> & {
  readonly tasks: BuiltTasks<Job>;
};

/**
 * Tagged error raised when a fetched CloudConvert job response is missing a task declared in the plan.
 */
export class MissingTaskInResponseError extends Data.TaggedError("MissingTaskInResponseError")<{
  readonly taskName: string;
}> {
  override get message(): string {
    return `Missing task in CloudConvert response: ${this.taskName}`;
  }
}

/**
 * Tagged error raised when a raw CloudConvert job cannot be interpreted using the plan.
 */
export class JobInterpretationError extends Data.TaggedError("JobInterpretationError")<{
  readonly cause: unknown;
}> {
  override get message(): string {
    return "Failed to interpret CloudConvert job response";
  }
}

const pipe = function <A>(this: A) {
  return pipeArguments(this, arguments) as A;
};

function taskBindings(task: Task.Any): Readonly<Record<string, string>> {
  return Object.fromEntries(task.provides.map((name) => [name, task.name]));
}

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
): JobPlan<Tasks, Provided, Required, TaskIndex, Bindings, Issues> {
  return {
    [JobTypeId]: {
      _TypeId: JobTypeId,
      _Tasks: tasks,
      _Provided: undefined as never,
      _Required: undefined as never,
      _TaskIndex: undefined as never,
      _Bindings: bindings,
      _Issues: undefined as never,
    },
    tasks,
    bindings,
    pipe,
  } as JobPlan<Tasks, Provided, Required, TaskIndex, Bindings, Issues>;
}

export function isJob(value: unknown): value is Any {
  return typeof value === "object" && value !== null && JobTypeId in value;
}

/**
 * Creates an empty typed job plan.
 */
export function empty(): JobPlan {
  return makeJob<readonly [], never, never, {}, {}, never>([], {});
}

/**
 * Creates a job plan from a list of task definitions.
 */
export function make<const Tasks extends readonly Task.Any[]>(
  ...tasks: Tasks
): MergeTasks<JobPlan, Tasks> {
  return tasks.reduce<Any>((job, task) => add(job, task), empty()) as MergeTasks<JobPlan, Tasks>;
}

/**
 * Adds a task to a job plan.
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
    makeJob(
      [...job.tasks, definition] as unknown as AddTaskResult<Job, Definition>["tasks"],
      {
        ...job.bindings,
        ...taskBindings(definition),
      } as AddTaskResult<Job, Definition>["bindings"],
    ),
);

/**
 * Manually satisfies a placeholder alias with a concrete task output.
 *
 * Most users should prefer task-level `provides` aliases instead.
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
    makeJob(job.tasks, {
      ...job.bindings,
      [name]: output.task,
    } as AddBindingResult<Job, Name, Output>["bindings"]),
);

/**
 * Merges two job plans, preserving both tasks and alias bindings.
 */
export const merge: {
  <Right extends Any>(right: Right): <Left extends Any>(left: Left) => MergeResult<Left, Right>;
  <Left extends Any, Right extends Any>(left: Left, right: Right): MergeResult<Left, Right>;
} = dual(
  2,
  <Left extends Any, Right extends Any>(left: Left, right: Right): MergeResult<Left, Right> => {
    const initial = makeJob(left.tasks, left.bindings);
    const mergedTasks = right.tasks.reduce(
      (job: Any, task: Task.Any) => add(job, task),
      initial as Any,
    );

    return makeJob(
      mergedTasks.tasks as MergeResult<Left, Right>["tasks"],
      {
        ...mergedTasks.bindings,
        ...right.bindings,
      } as MergeResult<Left, Right>["bindings"],
    ) as MergeResult<Left, Right>;
  },
);

/**
 * Builds a CloudConvert job payload from a complete typed job plan.
 */
export function build<Job extends Any>(
  job: CompleteInput<Job>,
): [Job] extends [CompleteJob<Job>] ? BuiltJob<Job> : never {
  const tasks = Object.fromEntries(
    job.tasks.map((task: Task.Any) => [task.name, Task.build(task, job.bindings)]),
  ) as BuiltTasks<Job>;

  return {
    tasks,
  } as [Job] extends [CompleteJob<Job>] ? BuiltJob<Job> : never;
}
