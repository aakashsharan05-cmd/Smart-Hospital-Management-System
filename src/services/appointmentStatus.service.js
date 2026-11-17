/**
 * Centralized Appointment Status Transition Engine
 *
 * Enforces legal state machine transitions:
 *   pending         -> confirmed, rejected, cancelled
 *   confirmed       -> in-queue (check-in), missed, cancelled
 *   in-queue        -> in-consultation (start consultation), missed, cancelled
 *   in-consultation -> completed (end consultation)
 *   completed       -> (terminal)
 *   cancelled       -> (terminal)
 *   rejected        -> (terminal)
 *   missed          -> (terminal)
 */

const LEGAL_TRANSITIONS = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["in-queue", "missed", "cancelled"],
  "in-queue": ["in-consultation", "missed", "cancelled"],
  "in-consultation": ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
  missed: [],
};

/**
 * Validate whether a transition from currentStatus to targetStatus is allowed.
 *
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ allowed: boolean, message?: string }}
 */
const validateStatusTransition = (currentStatus, targetStatus) => {
  if (!LEGAL_TRANSITIONS[currentStatus]) {
    return {
      allowed: false,
      message: `Invalid current status '${currentStatus}'`,
    };
  }

  const allowedTargets = LEGAL_TRANSITIONS[currentStatus];
  if (!allowedTargets.includes(targetStatus)) {
    const validStr =
      allowedTargets.length > 0
        ? `Valid next states: ${allowedTargets.join(", ")}`
        : "This is a terminal state; no further transitions are allowed";

    return {
      allowed: false,
      message: `Cannot transition appointment from '${currentStatus}' to '${targetStatus}'. ${validStr}`,
    };
  }

  return { allowed: true };
};

module.exports = {
  LEGAL_TRANSITIONS,
  validateStatusTransition,
};
