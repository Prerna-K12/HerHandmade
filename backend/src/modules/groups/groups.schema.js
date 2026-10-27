const { z, id } = require("../../utils/zodHelpers");

exports.match = z.object({
  q: z.string().trim().min(1).max(60),
  mode: z.enum(["best_rated", "fastest"]).default("best_rated"),
});

exports.setSkills = z.object({
  skills: z
    .array(
      z.object({
        skillId: id,
        rating: z.coerce.number().int().min(1).max(5),
        verified: z.boolean().default(false),
      })
    )
    .max(50)
    .refine((list) => new Set(list.map((s) => s.skillId)).size === list.length, "A skill is listed twice"),
});

exports.addMember = z.object({ name: z.string().trim().min(1).max(80) });
