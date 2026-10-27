// Turns snake_case database columns into camelCase JSON keys.
const isPlain = (v) => v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype;

function camel(value) {
  if (Array.isArray(value)) return value.map(camel);
  if (isPlain(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), camel(v)])
    );
  }
  return value;
}

module.exports = camel;
