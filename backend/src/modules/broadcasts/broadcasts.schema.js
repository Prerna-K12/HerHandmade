const { z, id, paging } = require("../../utils/zodHelpers");

// Videos are YouTube links (upload the video to YouTube as "Unlisted" first).
const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"];
const youtubeUrl = z
  .string()
  .trim()
  .url()
  .max(300)
  .refine((u) => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "https:" && YOUTUBE_HOSTS.includes(parsed.hostname);
    } catch {
      return false;
    }
  }, "Use a https://youtube.com or https://youtu.be link");

exports.create = z
  .object({
    audience: z.enum(["all_groups", "one_leader", "own_group"]),
    type: z.enum(["text", "image", "video"]),
    text: z.string().trim().max(1000).optional(),
    videoUrl: youtubeUrl.optional(),
    targetGroupId: id.optional(), // admin only, for audience "one_leader"
  })
  .superRefine((b, ctx) => {
    if (b.type === "video" && !b.videoUrl) ctx.addIssue({ code: "custom", path: ["videoUrl"], message: "Video link is required" });
    if (b.type === "text" && !b.text) ctx.addIssue({ code: "custom", path: ["text"], message: "Text is required" });
    if (b.audience === "one_leader" && !b.targetGroupId) {
      ctx.addIssue({ code: "custom", path: ["targetGroupId"], message: "Choose a captain" });
    }
  });

exports.feed = paging;
