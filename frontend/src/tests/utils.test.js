import { errorText } from "../api";
import { formatDate, youtubeId } from "../utils";

test("youtubeId understands the common YouTube link shapes", () => {
  expect(youtubeId("https://youtu.be/abc123")).toBe("abc123");
  expect(youtubeId("https://www.youtube.com/watch?v=abc123&t=5s")).toBe("abc123");
  expect(youtubeId("https://youtube.com/shorts/abc123")).toBe("abc123");
  expect(youtubeId("https://example.com/watch?v=abc123")).toBeNull(); // not a YouTube host
  expect(youtubeId("not a url")).toBeNull();
});

test("formatDate does not shift date-only values across timezones", () => {
  expect(formatDate("2027-07-15", "en")).toBe("15 Jul 2027");
  expect(formatDate("2027-07-15T23:30:00.000Z", "en")).toBe("15 Jul 2027");
  expect(formatDate("", "en")).toBe("");
});

test("errorText maps codes, adds server detail for validation errors, and handles no connection", () => {
  const t = (key, opts) => ({ "errors.VALIDATION_ERROR": "Check input", "errors.NETWORK_ERROR": "Offline", "errors.NOT_FOUND": "Not found", "errors.INTERNAL_ERROR": "Oops" })[key] ?? opts?.defaultValue;
  expect(errorText(t, { response: { data: { code: "VALIDATION_ERROR", message: "quantity: too low" } } })).toBe("Check input (quantity: too low)");
  expect(errorText(t, { response: { data: { code: "NOT_FOUND", message: "x" } } })).toBe("Not found");
  expect(errorText(t, {})).toBe("Offline");
  expect(errorText(t, { response: { data: { code: "SOMETHING_NEW" } } })).toBe("Oops");
});
