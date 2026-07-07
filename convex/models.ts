import { query } from "./_generated/server";

export const getModelMetadata = query({
  args: {},
  handler: async (ctx) => {
    const metadata = await ctx.db.query("modelMetadata").first();

    if (!metadata) {
      return null;
    }

    return {
      model_version: metadata.modelVersion,
      run_id: metadata.runId,
      metrics: {
        f1: metadata.f1Score,
      },
    };
  },
});
