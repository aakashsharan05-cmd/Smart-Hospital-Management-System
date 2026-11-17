const { compareQueueOrder, sortAppointmentsByQueueOrder } = require("../src/utils/queueOrder");

describe("Queue Order & Arrival Time Ordering Tests", () => {
  test("in-consultation appointments always precede in-queue appointments", () => {
    const apptWaitingEarlier = {
      _id: "appt-1",
      status: "in-queue",
      checkInTime: new Date("2026-11-17T09:00:00Z"),
      queueNumber: 1,
    };

    const apptInConsultation = {
      _id: "appt-2",
      status: "in-consultation",
      checkInTime: new Date("2026-11-17T09:30:00Z"),
      queueNumber: 5,
    };

    const sorted = sortAppointmentsByQueueOrder([apptWaitingEarlier, apptInConsultation]);
    expect(sorted[0]._id).toBe("appt-2");
    expect(sorted[1]._id).toBe("appt-1");
  });

  test("in-queue appointments sort strictly by arrival order (checkInTime ascending)", () => {
    // Patient A arrived at 09:10 with token #10
    const patientA = {
      _id: "patient-A",
      status: "in-queue",
      checkInTime: new Date("2026-11-17T09:10:00Z"),
      queueNumber: 10,
    };

    // Patient B arrived at 09:25 with token #2
    const patientB = {
      _id: "patient-B",
      status: "in-queue",
      checkInTime: new Date("2026-11-17T09:25:00Z"),
      queueNumber: 2,
    };

    // Patient C arrived at 09:05 with token #20
    const patientC = {
      _id: "patient-C",
      status: "in-queue",
      checkInTime: new Date("2026-11-17T09:05:00Z"),
      queueNumber: 20,
    };

    const sorted = sortAppointmentsByQueueOrder([patientA, patientB, patientC]);

    // Expected order: Patient C (09:05), Patient A (09:10), Patient B (09:25)
    // Demonstrating queueNumber is a token label, NOT queue order!
    expect(sorted.map((a) => a._id)).toEqual(["patient-C", "patient-A", "patient-B"]);
  });

  test("tie in checkInTime is broken by queueNumber ascending", () => {
    const sameTime = new Date("2026-11-17T10:00:00Z");

    const apptToken5 = {
      _id: "appt-token-5",
      status: "in-queue",
      checkInTime: sameTime,
      queueNumber: 5,
    };

    const apptToken2 = {
      _id: "appt-token-2",
      status: "in-queue",
      checkInTime: sameTime,
      queueNumber: 2,
    };

    const sorted = sortAppointmentsByQueueOrder([apptToken5, apptToken2]);
    expect(sorted[0]._id).toBe("appt-token-2");
    expect(sorted[1]._id).toBe("appt-token-5");
  });

  test("handles empty or invalid inputs gracefully", () => {
    expect(sortAppointmentsByQueueOrder([])).toEqual([]);
    expect(sortAppointmentsByQueueOrder(null)).toEqual([]);
    expect(sortAppointmentsByQueueOrder(undefined)).toEqual([]);
  });
});
