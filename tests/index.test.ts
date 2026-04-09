import type { Job as CloudConvertJob } from "cloudconvert/built/lib/JobsResource.js";
import { describe, expect, it } from "vite-plus/test";

import { Job, Ref, Task } from "../src/index.js";

function makeRawJob(tasks: CloudConvertJob["tasks"]): CloudConvertJob {
  return {
    id: "job-1",
    tag: null,
    status: "finished",
    created_at: "2026-01-01T00:00:00Z",
    started_at: "2026-01-01T00:00:01Z",
    ended_at: "2026-01-01T00:00:02Z",
    tasks,
  };
}

describe("typed-cloudconvert", () => {
  it("builds a simple job payload", () => {
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
          input: "import-file",
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

  it("builds a reusable fragment when a placeholder is satisfied by provides", () => {
    const convertFragment = Job.empty().pipe(
      Job.add(
        Task.convert({
          name: "convert-mp4",
          input: Ref.placeholder("source"),
          output_format: "mp4",
        }),
      ),
    );

    const job = Job.empty().pipe(
      Job.add(
        Task.importUrl({
          name: "import-file",
          provides: "source",
          url: "https://example.com/input.mov",
        }),
      ),
      Job.merge(convertFragment),
    );

    expect(Job.build(job)).toEqual({
      tasks: {
        "import-file": {
          operation: "import/url",
          url: "https://example.com/input.mov",
        },
        "convert-mp4": {
          operation: "convert",
          input: "import-file",
          output_format: "mp4",
        },
      },
    });
  });

  it("interprets a raw CloudConvert job using the typed plan", () => {
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
          input: "import-file",
        }),
      ),
    );

    const tasks = Job.build(job);

    const raw = makeRawJob([
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
        payload: tasks["import-file"],
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
        payload: tasks["inspect-file"],
        result: {
          metadata: {
            pages: 1,
          },
        },
      },
    ]);

    const result = Job.interpret(job, raw);

    expect(result.tasksByName["inspect-file"].operation).toBe("metadata");
    expect(result.tasksByName["inspect-file"].payload.input).toBe("import-file");
    expect(result.tasksByName["import-file"].payload.url).toBe("https://example.com/input.pdf");
    expect(
      (
        result.tasksByName["inspect-file"].result as {
          metadata: { pages: number };
        }
      ).metadata.pages,
    ).toBe(1);
  });

  it("throws a tagged error for unresolved placeholders", () => {
    expect(() =>
      Ref.resolveInput(Ref.placeholder("missing"), {
        bindings: {},
      }),
    ).toThrowError("Unresolved placeholder ref: missing");
  });

  it("throws when the raw job response is missing a planned task", () => {
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
          input: "import-file",
        }),
      ),
    );

    const raw = makeRawJob([
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
        payload: {
          operation: "import/url",
          url: "https://example.com/input.pdf",
        },
        result: {
          files: [
            {
              filename: "input.pdf",
            },
          ],
        },
      },
    ]);

    expect(() => Job.interpret(job, raw)).toThrow(
      "Missing task in CloudConvert response: inspect-file",
    );
  });
});
