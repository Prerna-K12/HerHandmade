// One Axios instance for the whole app. The login cookie is sent automatically.
import axios from "axios";

const api = axios.create({ baseURL: "http://192.168.1.66:5000", withCredentials: true });
export default api;

// Turns an API error into text in the user's language, using the error `code`.
// For a few codes the English detail from the server (it has numbers or field names) is appended.
const SHOW_DETAIL = ["VALIDATION_ERROR", "QUANTITY_EXCEEDED", "DEADLINE_AFTER_DELIVERY"];

export function errorText(t, err) {
  const response = err && err.response;
  const code = response ? (response.data && response.data.code) || "INTERNAL_ERROR" : "NETWORK_ERROR";
  const text = t(`errors.${code}`, { defaultValue: t("errors.INTERNAL_ERROR") });
  const detail = response && response.data && response.data.message;
  return SHOW_DETAIL.includes(code) && detail ? `${text} (${detail})` : text;
}
