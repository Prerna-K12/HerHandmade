const service = require("./skills.service");

exports.list = async (req, res) => res.json({ skills: await service.list() });
exports.create = async (req, res) => res.status(201).json({ skill: await service.create(req.body) });
