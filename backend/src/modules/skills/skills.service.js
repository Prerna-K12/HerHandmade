const { query } = require("../../db");
const AppError = require("../../utils/AppError");
const camel = require("../../utils/camel");

async function list() {
  const { rows } = await query("SELECT id, name, aliases FROM skills ORDER BY name");
  return camel(rows);
}

async function create({ name, aliases }) {
  // Aliases are stored lower-case so matching ignores capital letters.
  const lowerName = name.toLowerCase();
  const lowerAliases = [...new Set(aliases.map((a) => a.toLowerCase()))].filter((a) => a !== lowerName);
  const clash = await query("SELECT 1 FROM skills WHERE lower(name) = ANY($1) OR aliases && $1", [
    [lowerName, ...lowerAliases],
  ]);
  if (clash.rowCount > 0) {
    throw new AppError(409, "ALREADY_EXISTS", "A skill with this name or alias already exists");
  }
  const { rows } = await query(
    "INSERT INTO skills (name, aliases) VALUES ($1, $2) RETURNING id, name, aliases",
    [name, lowerAliases]
  );
  return camel(rows[0]);
}

module.exports = { list, create };
