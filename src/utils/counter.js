const Counter = require("../models/counter.model");
const { getKolkataDateString } = require("./timezone");

/**
 * Atomically increment and return the next sequence number for a given key.
 * Uses findOneAndUpdate with $inc and upsert: true.
 *
 * @param {string} key - Unique identifier for the sequence (e.g. queue:docId:YYYY-MM-DD)
 * @param {mongoose.ClientSession|null} session - Optional mongoose transaction session
 * @returns {Promise<number>} - The next sequence number (1, 2, 3...)
 */
const getNextSequence = async (key, session = null) => {
  const options = { new: true, upsert: true, setDefaultsOnInsert: true };
  if (session) {
    options.session = session;
  }

  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    options
  );

  return counter.seq;
};

/**
 * Get the next atomic queue number for a doctor on a specific date (Asia/Kolkata).
 */
const getNextQueueNumber = async (doctorId, date, session = null) => {
  const dateStr = getKolkataDateString(date);
  const key = `queue:${doctorId}:${dateStr}`;
  return await getNextSequence(key, session);
};

/**
 * Get the next collision-safe invoice number for today: INV-YYYYMMDD-XXXX
 */
const getNextInvoiceNumber = async (date = new Date(), session = null) => {
  const dateStr = getKolkataDateString(date); // YYYY-MM-DD
  const compactDate = dateStr.replace(/-/g, ""); // YYYYMMDD
  const key = `invoice:${compactDate}`;
  const seq = await getNextSequence(key, session);
  return `INV-${compactDate}-${String(seq).padStart(4, "0")}`;
};

module.exports = {
  getNextSequence,
  getNextQueueNumber,
  getNextInvoiceNumber,
};
