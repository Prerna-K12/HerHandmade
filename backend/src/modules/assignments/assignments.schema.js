const { z, id, notPastDate } = require("../../utils/zodHelpers");

exports.create = z.object({
  groupId: id,
  quantity: z.coerce.number().int().min(1).max(100000),
  deadline: notPastDate,
});

exports.list = z.object({
  orderId: id.optional(),
  status: z.enum(["assigned", "accepted", "declined", "done"]).optional(),
});

exports.respond = z.object({
  action: z.enum(["accept", "decline"]),
  reason: z.string().trim().max(300).optional(),
});

exports.approve = z.object({ approved: z.boolean() });

exports.done = z.object({ producedQty: z.coerce.number().int().min(0).max(100000) });

exports.mediaParams = z.object({ id, mediaId: id });
