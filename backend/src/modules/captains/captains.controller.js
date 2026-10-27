const service = require("./captains.service");

exports.list = async (req, res) => res.json({ captains: await service.list() });
exports.create = async (req, res) => res.status(201).json(await service.create(req.body));

exports.resetPassword = async (req, res) => {
  await service.resetPassword(req.params.id, req.body.password);
  res.status(204).end();
};

exports.deactivate = async (req, res) => {
  await service.deactivate(req.params.id);
  res.status(204).end();
};
