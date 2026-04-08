import * as Effect from "effect/Effect";
import * as EffectVitest from "@effect/vitest";
import type { Job as CloudConvertJob } from "cloudconvert/built/lib/JobsResource.js";
import { describe, expect, it } from "vitest";
import { CloudConvertClient, Job, Ref, Task } from "../src/index.ts";

describe("effect-cloudconvert", () => {
  it("builds a simple job", () => {
    const job = Job.empty().pipe(
      Job.add(
        Task.importUrl({
          name: "import-file",
          url: "https://example.com/input.pdf",
        }),
      ),
      Job.add(
        Task.convert({
          name: "convert-file",
          input: Ref.output("import-file"),
          output_format: "png",
        }),
      ),
    );

    expect(Job.build(job)).toEqual({
      tasks: {
        "import-file": {
          operation: "import/url",
          url: "https://example.com/input.pdf",
        },
        "convert-file": {
          operation: "convert",
          input: "import-file",
          output_format: "png",
        },
      },
    });
  });

  EffectVitest.it.effect("creates a job through the Effect service", () => {
    const job = Job.empty().pipe(
      Job.add(
        Task.importUrl({
          name: "import-file",
          url: "https://example.com/input.pdf",
        }),
      ),
      Job.add(
        Task.metadata({
          name: "inspect-file",
          input: Ref.output("import-file"),
        }),
      ),
    );
    const built = Job.build(job);

    return Effect.gen(function* () {
      const client = yield* CloudConvertClient.CloudConvertClient;
      const result = yield* client.createJob(built);
      const inspectTask = result.tasks[1];

      expect(inspectTask?.operation).toBe("metadata");
      expect(inspectTask && (inspectTask.payload as { input?: string }).input).toBe("import-file");
    }).pipe(
      Effect.provideService(CloudConvertClient.CloudConvertClient, {
        createJob: () =>
          Effect.succeed<CloudConvertJob>({
            id: "job-1",
            tag: null,
            status: "finished",
            created_at: "2026-01-01T00:00:00Z",
            started_at: "2026-01-01T00:00:01Z",
            ended_at: "2026-01-01T00:00:02Z",
            tasks: [
              {
                id: "task-1",
                name: "import-file",
                operation: "import/url",
                status: "finished",
                message: null,
                code: null,
                credits: 1,
                created_at: "2026-01-01T00:00:00Z",
                started_at: "2026-01-01T00:00:01Z",
                ended_at: "2026-01-01T00:00:02Z",
                depends_on_tasks: {},
                engine: "cloudconvert",
                engine_version: "1",
                payload: built.tasks["import-file"],
                result: {
                  files: [
                    {
                      filename: "input.pdf",
                    },
                  ],
                },
              },
              {
                id: "task-2",
                name: "inspect-file",
                operation: "metadata",
                status: "finished",
                message: null,
                code: null,
                credits: 1,
                created_at: "2026-01-01T00:00:00Z",
                started_at: "2026-01-01T00:00:01Z",
                ended_at: "2026-01-01T00:00:02Z",
                depends_on_tasks: {
                  "import-file": "task-1",
                },
                engine: "cloudconvert",
                engine_version: "1",
                payload: built.tasks["inspect-file"],
                result: {
                  metadata: {
                    pages: 1,
                  },
                },
              },
            ],
          }),
        getJob: () => Effect.die("not implemented"),
        waitJob: () => Effect.die("not implemented"),
      }),
    );
  });

  it("throws a tagged error for unresolved required refs", () => {
    expect(() =>
      Ref.resolveInput(Ref.required("missing"), {
        bindings: {},
      }),
    ).toThrowError("Unresolved required ref: missing");
  });
});
