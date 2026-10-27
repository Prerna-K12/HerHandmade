const { z, phone, password } = require("../../utils/zodHelpers");

exports.create = z.object({
  name: z.string().trim().min(1).max(80),
  phone,
  password,
  group: z.object({
    name: z.string().trim().min(1).max(100),
    village: z.string().trim().min(1).max(100),
    district: z.string().trim().min(1).max(100),
  }),
});

exports.resetPassword = z.object({ password });
