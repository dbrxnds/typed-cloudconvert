import * as Data from "effect/Data";
import { pipeArguments } from "effect/Pipeable";
import type { Pipeable } from "effect/Pipeable";

/**
 * Unique symbol carried by typed job reference values.
 */
export const RefTypeId = Symbol.for("effect-cloudconvert/Ref");

/**
 * A typed reference to the output of another task in the same job.
 */
export interface OutputRef<Name extends string = string> extends Pipeable {
  readonly [RefTypeId]: typeof RefTypeId;
  readonly _tag: "OutputRef";
  readonly task: Name;
}

/**
 * A placeholder reference that can be satisfied later by a task alias.
 */
export interface PlaceholderRef<Name extends string = string> extends Pipeable {
  readonly [RefTypeId]: typeof RefTypeId;
  readonly _tag: "PlaceholderRef";
  readonly name: Name;
}

export type Any = OutputRef | PlaceholderRef;

export type InputToken = string | Any;

export type InputValue = InputToken | ReadonlyArray<InputToken>;

export type TokenOf<Value> =
  Value extends OutputRef<infer Name>
    ? Name
    : Value extends PlaceholderRef<infer Name>
      ? Name
      : never;

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

function makeRef<T extends Any>(ref: Omit<T, "pipe">): T {
  return {
    ...ref,
    pipe,
  } as T;
}

/**
 * Creates a typed reference to the output of a concrete task.
 */
export function output<const Name extends string>(
  task: Name | { readonly name: Name },
): OutputRef<Name> {
  return makeRef<OutputRef<Name>>({
    [RefTypeId]: RefTypeId,
    _tag: "OutputRef",
    task: typeof task === "string" ? task : task.name,
  });
}

/**
 * Creates a placeholder reference that can be satisfied later by a task alias.
 */
export function placeholder<const Name extends string>(
  name: Name,
): PlaceholderRef<Name> {
  return makeRef<PlaceholderRef<Name>>({
    [RefTypeId]: RefTypeId,
    _tag: "PlaceholderRef",
    name,
  });
}

export function isRef(value: unknown): value is Any {
  return typeof value === "object" && value !== null && RefTypeId in value;
}

export interface ResolveRefOptions {
  readonly bindings: Readonly<Record<string, string>>;
}

/**
 * Error raised when a required placeholder cannot be resolved to a concrete task name.
 */
export class UnresolvedRequiredRefError extends Data.TaggedError(
  "UnresolvedRequiredRefError",
)<{
  readonly name: string;
}> {
  override get message(): string {
    return `Unresolved required ref: ${this.name}`;
  }
}

/**
 * Resolves typed job references into the concrete task names expected by CloudConvert.
 */
export function resolveInput(
  value: InputValue,
  options: ResolveRefOptions,
): string | string[] {
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
    throw new UnresolvedRequiredRefError({
      name: value.name,
    });
  }

  return resolved;
}
