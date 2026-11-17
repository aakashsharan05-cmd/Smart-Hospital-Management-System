/**
 * Formatting utilities for Smart Hospital Management System
 */

/**
 * Ensures the 'Dr.' prefix appears exactly once on a doctor's display name.
 * Handles cases where 'Dr.' is already present in user.name or omitted,
 * as well as accidental duplications like 'Dr. Dr. Name'.
 *
 * Examples:
 * - "Dr. Vikram Patel"    => "Dr. Vikram Patel"
 * - "Dr. Dr. Vikram Patel"=> "Dr. Vikram Patel"
 * - "Vikram Patel"        => "Dr. Vikram Patel"
 * - "dr. rahul sharma"    => "Dr. Rahul Sharma"
 * - "" / null / undefined => "Doctor"
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
export const formatDoctorName = (name) => {
  if (!name || typeof name !== 'string') return 'Doctor';
  const clean = name.trim();
  if (!clean) return 'Doctor';

  // Strip any leading "Dr." or "Dr" prefixes (single or repeated, case-insensitive)
  const stripped = clean.replace(/^(dr\.?\s*)+/i, '').trim();
  if (!stripped) return 'Doctor';

  // Capitalize the first letter of each word if all lowercase, otherwise preserve
  const formattedStripped =
    stripped === stripped.toLowerCase()
      ? stripped
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : stripped;

  return `Dr. ${formattedStripped}`;
};

/**
 * Formats a department option label with its location cleanly without duplicated words or parentheses.
 *
 * Examples:
 * - { name: "Cardiology", location: "Block A, First Floor" } => "Cardiology (Block A, First Floor)"
 * - { name: "General Medicine", location: "" }              => "General Medicine"
 * - { name: "General Medicine", location: null }            => "General Medicine"
 *
 * @param {{ name?: string, location?: string }|null|undefined} dept
 * @returns {string}
 */
export const formatDepartmentOption = (dept) => {
  if (!dept) return '';
  const name = dept.name?.trim() || '';
  let loc = dept.location?.trim() || '';

  // Remove wrapping parentheses if already present in database
  if (loc.startsWith('(') && loc.endsWith(')')) {
    loc = loc.slice(1, -1).trim();
  }

  return loc ? `${name} (${loc})` : name;
};
