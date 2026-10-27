const { z, id } = require("../../utils/zodHelpers");

exports.tokenParams = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/, "Invalid link") });
exports.photoParams = exports.tokenParams.extend({ mediaId: id });

const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,12}$/, "Invalid code");
exports.codeParams = z.object({ code });
exports.codeMediaParams = z.object({ code, fileName: z.string().max(60) });
