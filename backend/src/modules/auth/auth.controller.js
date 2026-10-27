const env = require("../../config/env");
const service = require("./auth.service");

const cookieOptions = {
  httpOnly: true, // JavaScript cannot read it (protects against theft via XSS)
  sameSite: "lax",
  secure: env.cookieSecure,
};

exports.login = async (req, res) => {
  const { token, user } = await service.login(req.body.phone, req.body.password);
  res.cookie("token", token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ user });
};

exports.logout = (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.status(204).end();
};

exports.me = async (req, res) => {
  res.json({ user: await service.profile(req.user.id) });
};
