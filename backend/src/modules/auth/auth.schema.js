const { z, phone } = require("../../utils/zodHelpers");

exports.login = z.object({
  phone,
  password: z.string().min(1).max(100),
});
