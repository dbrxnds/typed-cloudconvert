import CloudConvert from "cloudconvert";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";

import type { Job as CloudConvertJob, JobTemplate } from "cloudconvert/built/lib/JobsResource.js";

/**
 * Effect service describing the CloudConvert operations required by this library.
 */
export interface CloudConvertClient {
  readonly unsafeClient?: CloudConvert;
  readonly createJob: (
    job: JobTemplate,
  ) => Effect.Effect<CloudConvertJob, CloudConvertClientRequestError>;
  readonly getJob: (id: string) => Effect.Effect<CloudConvertJob, CloudConvertClientRequestError>;
  readonly waitJob: (id: string) => Effect.Effect<CloudConvertJob, CloudConvertClientRequestError>;
}

/**
 * Service tag for accessing a `CloudConvertClient` from the Effect environment.
 */
export const CloudConvertClient = ServiceMap.Service<CloudConvertClient>(
  "effect-cloudconvert/CloudConvertClient",
);

/**
 * Tagged error raised when a CloudConvert request fails.
 */
export class CloudConvertClientRequestError extends Data.TaggedError(
  "CloudConvertClientRequestError",
)<{
  readonly action: "createJob" | "getJob" | "waitJob";
  readonly cause: unknown;
  readonly jobId?: string;
}> {
  override get message(): string {
    return this.jobId === undefined
      ? `CloudConvert ${this.action} request failed`
      : `CloudConvert ${this.action} request failed for job ${this.jobId}`;
  }
}

function toRequestError(
  action: CloudConvertClientRequestError["action"],
  cause: unknown,
  jobId?: string,
): CloudConvertClientRequestError {
  return new CloudConvertClientRequestError({
    action,
    cause,
    ...(jobId === undefined ? {} : { jobId }),
  });
}

/**
 * Wraps a raw `cloudconvert` SDK client as an Effect service implementation.
 */
export function make(client: CloudConvert): CloudConvertClient {
  return {
    unsafeClient: client,
    createJob(job) {
      return Effect.tryPromise({
        try: () => client.jobs.create(job),
        catch: (cause) => toRequestError("createJob", cause),
      });
    },
    getJob(id) {
      return Effect.tryPromise({
        try: () => client.jobs.get(id, { include: "tasks" }),
        catch: (cause) => toRequestError("getJob", cause, id),
      });
    },
    waitJob(id) {
      return Effect.tryPromise({
        try: () => client.jobs.wait(id),
        catch: (cause) => toRequestError("waitJob", cause, id),
      });
    },
  };
}

/**
 * Alias for `make`.
 */
export const fromCloudConvert = make;

/**
 * Creates a `Layer` that provides a `CloudConvertClient`.
 */
export function layer(client: CloudConvert): Layer.Layer<CloudConvertClient> {
  return Layer.succeed(CloudConvertClient, make(client));
}
