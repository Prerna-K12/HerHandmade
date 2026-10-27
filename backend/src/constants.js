// Roles, statuses and the order status rules live here. No magic strings elsewhere.

const ROLES = { ADMIN: "admin", LEADER: "leader" }; // leader = "Sakhi Captain" in the UI

// Order status is changed only by the admin, one allowed move at a time.
// Anything not listed here is rejected with 409 INVALID_TRANSITION.
const TRANSITIONS = {
  submitted: ["accepted", "rejected", "cancelled"],
  accepted: ["in_production", "cancelled"],
  in_production: ["completed"],
  completed: ["dispatched"],
  dispatched: ["delivered"],
};

const ORDER_STATUSES = [
  "submitted", "accepted", "rejected", "in_production",
  "completed", "dispatched", "delivered", "cancelled",
];

// An assignment is "open" while the group still has to work on it.
const OPEN_ASSIGNMENT = ["assigned", "accepted"];

module.exports = { ROLES, TRANSITIONS, ORDER_STATUSES, OPEN_ASSIGNMENT };
