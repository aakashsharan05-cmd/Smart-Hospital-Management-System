/**
 * Queue Ordering Helper
 *
 * Queue order represents true patient arrival order:
 * 1. 'in-consultation' appointments appear first (currently being seen by the doctor)
 * 2. 'in-queue' appointments sorted by checkInTime ascending (earliest check-in / arrival first)
 * 3. Tie-break by queueNumber ascending
 *
 * NOTE: queueNumber is a token label (printed sequence for calling tickets), NOT queue order.
 * Patients may check in out of numerical sequence; their physical arrival order (checkInTime)
 * determines their position in queue.
 */

/**
 * Comparator function to sort appointments by arrival queue order.
 *
 * @param {object} a First appointment
 * @param {object} b Second appointment
 * @returns {number} Sort comparison value
 */
const compareQueueOrder = (a, b) => {
  // 1. 'in-consultation' appointments take top priority
  const aConsult = a.status === "in-consultation";
  const bConsult = b.status === "in-consultation";
  if (aConsult && !bConsult) return -1;
  if (!aConsult && bConsult) return 1;

  // 2. Arrival order: checkInTime ascending (earliest arrival first)
  const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
  const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // 3. Tie-break: queueNumber ascending (token label)
  const numA = typeof a.queueNumber === "number" ? a.queueNumber : 0;
  const numB = typeof b.queueNumber === "number" ? b.queueNumber : 0;
  return numA - numB;
};

/**
 * Sorts an array of appointment documents or plain objects by queue arrival order.
 *
 * @param {Array<object>} appointments
 * @returns {Array<object>} Sorted array
 */
const sortAppointmentsByQueueOrder = (appointments) => {
  if (!Array.isArray(appointments)) return [];
  return [...appointments].sort(compareQueueOrder);
};

module.exports = {
  compareQueueOrder,
  sortAppointmentsByQueueOrder,
};
