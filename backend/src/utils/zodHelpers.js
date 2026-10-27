// Small reusable Zod pieces so every schema file stays short.
const { z } = require("zod");

const id = z.coerce.number({ invalid_type_error: "Must be a whole number" }).int().positive().max(2147483647);
const idParam = (name = "id") => z.object({ [name]: id });

const phone = z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a valid phone number");
const password = z.string().min(8, "At least 8 characters").max(100);

const todayStr = () => new Date().toISOString().slice(0, 10);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, "Not a real date");
const futureDate = isoDate.refine((s) => s > todayStr(), "Date must be in the future");
const notPastDate = isoDate.refine((s) => s >= todayStr(), "Date cannot be in the past");

const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { z, id, idParam, phone, password, isoDate, futureDate, notPastDate, paging };
