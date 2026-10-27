const service = require("./orders.service");

exports.list = async (req, res) => res.json(await service.list(req.query));
exports.get = async (req, res) => res.json(await service.get(req.params.id));
exports.updateStatus = async (req, res) =>
  res.json({ order: await service.updateStatus(req.user, req.params.id, req.body.status) });
