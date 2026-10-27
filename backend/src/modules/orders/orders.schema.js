const { z, futureDate, paging } = require("../../utils/zodHelpers");
const { ORDER_STATUSES } = require("../../constants");

// Public order form (businesses). `website` is a hidden honeypot field: real users leave it empty.
exports.createPublic = z.object({
  businessName: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(200),
  item: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(100000),
  deliveryDate: futureDate,
  email: z.string().trim().email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,15}$/, "Enter a valid phone number").optional().or(z.literal("")),
  website: z.string().max(200).optional(),
    
  idempotencyKey: z.string().uuid().optional(),
});

exports.list = paging.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

exports.updateStatus = z.object({ status: z.enum(ORDER_STATUSES) });
