describe('Frontend Formatters Unit Tests', () => {
  let formatDoctorName;
  let formatDepartmentOption;

  beforeAll(async () => {
    const formatters = await import('../../frontend/src/utils/formatters.js');
    formatDoctorName = formatters.formatDoctorName;
    formatDepartmentOption = formatters.formatDepartmentOption;
  });

  describe('formatDoctorName()', () => {
    test('handles name already containing Dr. prefix without duplication', () => {
      expect(formatDoctorName('Dr. Vikram Patel')).toBe('Dr. Vikram Patel');
      expect(formatDoctorName('Dr. Rahul Sharma')).toBe('Dr. Rahul Sharma');
      expect(formatDoctorName('Dr. Priya Nair')).toBe('Dr. Priya Nair');
    });

    test('prepends Dr. prefix to names without Dr.', () => {
      expect(formatDoctorName('Vikram Patel')).toBe('Dr. Vikram Patel');
      expect(formatDoctorName('Priya Nair')).toBe('Dr. Priya Nair');
      expect(formatDoctorName('Ananya Sen')).toBe('Dr. Ananya Sen');
    });

    test('collapses repeated Dr. prefixes to a single Dr.', () => {
      expect(formatDoctorName('Dr. Dr. Vikram Patel')).toBe('Dr. Vikram Patel');
      expect(formatDoctorName('Dr. Dr. Dr. Rahul Sharma')).toBe('Dr. Rahul Sharma');
      expect(formatDoctorName('dr. Dr. DR. Priya Nair')).toBe('Dr. Priya Nair');
      expect(formatDoctorName('Dr Dr. Vikram')).toBe('Dr. Vikram');
    });

    test('handles null, undefined, or empty doctor names gracefully', () => {
      expect(formatDoctorName(null)).toBe('Doctor');
      expect(formatDoctorName(undefined)).toBe('Doctor');
      expect(formatDoctorName('')).toBe('Doctor');
      expect(formatDoctorName('   ')).toBe('Doctor');
      expect(formatDoctorName(123)).toBe('Doctor');
    });

    test('handles case-insensitive prefixes and normalizes capitalization if all lowercase', () => {
      expect(formatDoctorName('dr. ananya sen')).toBe('Dr. Ananya Sen');
      expect(formatDoctorName('dr. Dr. rajesh iyer')).toBe('Dr. Rajesh Iyer');
    });
  });

  describe('formatDepartmentOption()', () => {
    test('formats department with a valid location in parentheses', () => {
      const dept = { name: 'Cardiology', location: 'Block A, First Floor' };
      expect(formatDepartmentOption(dept)).toBe('Cardiology (Block A, First Floor)');
    });

    test('formats department with an empty, whitespace, or missing location without stray spaces', () => {
      expect(formatDepartmentOption({ name: 'General Medicine', location: '' })).toBe('General Medicine');
      expect(formatDepartmentOption({ name: 'Pediatrics', location: '   ' })).toBe('Pediatrics');
      expect(formatDepartmentOption({ name: 'Neurology' })).toBe('Neurology');
      expect(formatDepartmentOption({ name: 'Ophthalmology', location: null })).toBe('Ophthalmology');
    });

    test('strips pre-existing outer parentheses from location to avoid double parentheses', () => {
      const dept = { name: 'Cardiology', location: '(Block A, First Floor)' };
      expect(formatDepartmentOption(dept)).toBe('Cardiology (Block A, First Floor)');
    });

    test('handles null or undefined department objects safely', () => {
      expect(formatDepartmentOption(null)).toBe('');
      expect(formatDepartmentOption(undefined)).toBe('');
      expect(formatDepartmentOption({})).toBe('');
    });
  });
});
