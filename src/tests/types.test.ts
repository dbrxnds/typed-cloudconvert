import { describe, expectTypeOf, it } from "vite-plus/test";

import { Job, Ref, Task } from "../index.js";

describe("types", () => {
  it("Ref.output preserves the literal task name", () => {
    expectTypeOf(Ref.output("import-file")).toEqualTypeOf<Ref.OutputRef<"import-file">>();
    expectTypeOf(Ref.output({ name: "other" })).toEqualTypeOf<Ref.OutputRef<"other">>();
  });

  it("Ref.placeholder preserves the literal alias name", () => {
    expectTypeOf(Ref.placeholder("source")).toEqualTypeOf<Ref.PlaceholderRef<"source">>();
  });

  it("RequiredOf surfaces unresolved placeholder names", () => {
    const fragment = Job.empty().pipe(
      Job.add(
        Task.convert({
          name: "convert-mp4",
          input: Ref.placeholder("source"),
          output_format: "mp4",
        }),
      ),
    );
    expectTypeOf<Job.RequiredOf<typeof fragment>>().toEqualTypeOf<"source">();
  });

  it("RequiredOf is never when the plan is complete", () => {
    const job = Job.empty().pipe(
      Job.add(
        Task.importUrl({
          name: "import-file",
          provides: "source",
          url: "https://example.com/input.mov",
        }),
      ),
      Job.add(
        Task.convert({
          name: "convert-mp4",
          input: Ref.placeholder("source"),
          output_format: "mp4",
        }),
      ),
    );
    expectTypeOf<Job.RequiredOf<typeof job>>().toEqualTypeOf<never>();
  });

  it("Job.build keeps task names and operations in the built map", () => {
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
    const built = Job.build(job);
    expectTypeOf(built["import-file"]["operation"]).toEqualTypeOf<"import/url">();
    expectTypeOf(built["convert-file"]["operation"]).toEqualTypeOf<"convert">();
  });

  it("JobResult preserves literal operations in tasksByName", () => {
    const plan = Job.empty().pipe(
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
    type ByName = Job.JobResultOf<typeof plan>["tasksByName"];
    expectTypeOf<ByName["import-file"]["operation"]>().toEqualTypeOf<"import/url">();
    expectTypeOf<ByName["inspect-file"]["operation"]>().toEqualTypeOf<"metadata">();
  });

  it("TaskDependencies extracts input task names from payloads", () => {
    const task = Task.convert({
      name: "convert-file",
      input: "import-file",
      output_format: "png",
    });
    expectTypeOf<Task.TaskDependencies<(typeof task)["payload"]>>().toEqualTypeOf<"import-file">();
  });

  it("does not typecheck Job.build when dependencies are still missing", () => {
    const incomplete = Job.empty().pipe(
      Job.add(
        Task.convert({
          name: "convert-file",
          input: "missing-import",
          output_format: "pdf",
        }),
      ),
    );
    expectTypeOf(incomplete).not.toExtend<Job.CompleteJob<typeof incomplete>>();
  });
});
