const service = require("./groups.service");

exports.match = async (req, res) => res.json(await service.matchGroups(req.query.q, req.query.mode));

exports.setSkills = async (req, res) =>
  res.json({ group: await service.setSkills(req.user, req.params.id, req.body.skills) });

exports.getMine = async (req, res) => res.json({ group: await service.getMine(req.user) });

exports.addMember = async (req, res) =>
  res.status(201).json({ group: await service.addMember(req.user, req.body.name) });

exports.removeMember = async (req, res) => {
  await service.removeMember(req.user, req.params.memberId);
  res.status(204).end();
};

exports.regenerateCode = async (req, res) =>
  res.json({ accessCode: await service.regenerateCode(req.user) });
