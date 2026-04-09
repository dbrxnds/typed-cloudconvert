import { pipeArguments, type Pipeable } from "./internal/pipe.js";

/**
 * Unique symbol carried by typed job reference values.
 */
export const RefTypeId = Symbol.for("typed-cloudconvert/Ref");

/**
 * A typed reference to the output of another task in the same job.
 *
 * Use this when a task should explicitly depend on the output of a known task.
 */
export interface OutputRef<Name extends string = string> extends Pipeable {
  readonly [RefTypeId]: typeof RefTypeId;
  readonly _tag: "OutputRef";
  readonly task: Name;
}

/**
 * A placeholder reference that can be satisfied later by a task alias.
 *
 * Placeholder refs are useful when authoring reusable job fragments that do
 * not yet know the concrete upstream task name.
 */
export interface PlaceholderRef<Name extends string = string> extends Pipeable {
  readonly [RefTypeId]: typeof RefTypeId;
  readonly _tag: "PlaceholderRef";
  readonly name: Name;
}

/**
 * Any typed job reference value.
 */
export type Any = OutputRef | PlaceholderRef;

/**
 * A single token accepted by task `input` fields.
 *
 * This can be a literal task name or one of the typed ref values created with
 * `Ref.output(...)` or `Ref.placeholder(...)`.
 */
export type InputToken = string | Any;

/**
 * A value accepted by task `input` fields.
 *
 * CloudConvert operations allow either a single input token or a list of input
 * tokens, so this type mirrors that shape directly.
 */
export type InputValue = InputToken | ReadonlyArray<InputToken>;

/**
 * Extracts the referenced task or placeholder name from a ref value.
 */
export type TokenOf<Value> =
  Value extends OutputRef<infer Name>
    ? Name
    : Value extends PlaceholderRef<infer Name>
      ? Name
      : never;

/**
 * Extracts all task dependencies from an input value.
 *
 * This is used internally to infer which task names or placeholder aliases a
 * task payload depends on.
 */
export type DependenciesOf<Value> = Value extends readonly (infer Item)[]
  ? DependenciesOf<Item>
  : Value extends string
    ? Value
    : Value extends Any
      ? TokenOf<Value>
      : never;

const pipe = function <A>(this: A) {
  return pipeArguments(this, arguments) as A;
};

/**
 * Creates a typed reference to the output of a concrete task.
 *
 * @example
 * ```ts
 * import { Ref } from "typed-cloudconvert";
 *
 * const input = Ref.output("import-file");
 * ```
 */
export function output<const Name extends string>(
  task: Name | { readonly name: Name },
): OutputRef<Name> {
  return {
    [RefTypeId]: RefTypeId,
    _tag: "OutputRef",
    task: typeof task === "string" ? task : task.name,
    pipe,
  };
}

/**
 * Creates a placeholder reference that can be satisfied later by a task alias.
 *
 * @example
 * ```ts
 * import { Ref } from "typed-cloudconvert";
 *
 * const source = Ref.placeholder("source");
 * ```
 */
export function placeholder<const Name extends string>(name: Name): PlaceholderRef<Name> {
  return {
    [RefTypeId]: RefTypeId,
    _tag: "PlaceholderRef",
    name,
    pipe,
  };
}

/**
 * Returns `true` when the provided value is a typed CloudConvert ref.
 */
export function isRef(value: unknown): value is Any {
  return typeof value === "object" && value !== null && RefTypeId in value;
}

/**
 * Options for resolving refs into CloudConvert task names.
 */
export interface ResolveRefOptions {
  readonly bindings: Readonly<Record<string, string>>;
}

/**
 * Error raised when a required placeholder cannot be resolved to a concrete
 * task name.
 */
export class UnresolvedRequiredRefError extends Error {
  readonly _tag = "UnresolvedRequiredRefError";
  readonly name = "UnresolvedRequiredRefError";

  constructor(readonly refName: string) {
    super(`Unresolved placeholder ref: ${refName}`);
  }

  override get message(): string {
    return `Unresolved placeholder ref: ${this.refName}`;
  }
}

/**
 * Resolves typed job references into the concrete task names expected by
 * CloudConvert.
 *
 * This is mostly used internally by `Task.build(...)`, but it can also be
 * helpful when debugging placeholder bindings.
 *
 * @example
 * ```ts
 * import { Ref } from "typed-cloudconvert";
 *
 * const resolved = Ref.resolveInput(
 *   [Ref.output("import-file"), Ref.placeholder("fallback")],
 *   {
 *     bindings: {
 *       fallback: "import-backup",
 *     },
 *   },
 * );
 * ```
 */
export function resolveInput(value: InputValue, options: ResolveRefOptions): string | string[] {
  if (Array.isArray(value)) {
    return value.map((item) => resolveToken(item, options));
  }

  return resolveToken(value as InputToken, options);
}

function resolveToken(value: InputToken, options: ResolveRefOptions): string {
  if (typeof value === "string") {
    return value;
  }

  if (value._tag === "OutputRef") {
    return value.task;
  }

  const resolved = options.bindings[value.name];

  if (resolved === undefined) {
    throw new UnresolvedRequiredRefError(value.name);
  }

  return resolved;
}
