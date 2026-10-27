const service = require("./assignments.service");

exports.create = async (req, res) =>
  res.status(201).json({ assignment: await service.create(req.user, req.params.orderId, req.body) });

exports.list = async (req, res) => res.json({ assignments: await service.list(req.user, req.query) });
exports.get = async (req, res) => res.json({ assignment: await service.get(req.user, req.params.id) });

exports.addReference = async (req, res) =>
  res.status(201).json({ assignment: await service.addReference(req.user, req.params.id, req.files) });

exports.respond = async (req, res) =>
  res.json({ assignment: await service.respond(req.user, req.params.id, req.body) });

exports.addEvidence = async (req, res) =>
  res.status(201).json({ assignment: await service.addEvidence(req.user, req.params.id, req.files) });

exports.markDone = async (req, res) =>
  res.json({ assignment: await service.markDone(req.user, req.params.id, req.body.producedQty) });

exports.removeEvidence = async (req, res) => {
  await service.removeEvidence(req.params.id, req.params.mediaId);
  res.status(204).end();
};

exports.setApproval = async (req, res) =>
  res.json({ assignment: await service.setApproval(req.user, req.params.id, req.body.approved) });
