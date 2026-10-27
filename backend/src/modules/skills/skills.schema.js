const { z } = require("../../utils/zodHelpers");

exports.create = z.object({
  name: z.string().trim().min(1).max(60),
  aliases: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});
