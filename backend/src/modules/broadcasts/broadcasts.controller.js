const service = require("./broadcasts.service");

exports.create = async (req, res) =>
  res.status(201).json({ broadcast: await service.create(req.user, req.body, req.files && req.files[0]) });

exports.feed = async (req, res) => res.json(await service.feed(req.user, req.query));

exports.remove = async (req, res) => {
  await service.remove(req.user, req.params.id);
  res.status(204).end();
};
