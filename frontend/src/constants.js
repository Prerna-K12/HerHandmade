export const ORDER_STATUSES = [
  "submitted", "accepted", "rejected", "in_production",
  "completed", "dispatched", "delivered", "cancelled",
];

// Mirror of the backend rules, used only to decide which buttons to show.
// The server is the real authority and rejects anything not allowed.
export const TRANSITIONS = {
  submitted: ["accepted", "rejected", "cancelled"],
  accepted: ["in_production", "cancelled"],
  in_production: ["completed"],
  completed: ["dispatched"],
  dispatched: ["delivered"],
};

export const todayStr = () => new Date().toISOString().slice(0, 10);
