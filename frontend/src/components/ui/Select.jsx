import React from 'react';

const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const selectId = id || name;

  return (
    <div className={`flex flex-col gap-1.5 text-left w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-slate-400">
            {placeholder}
          </option>
        )}
        {children ||
          options.map((opt) => {
            const optVal = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={optVal} value={optVal}>
                {optLabel}
              </option>
            );
          })}
      </select>
      {error ? (
        <span className="text-xs text-red-600 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-500">{helperText}</span>
      ) : null}
    </div>
  );
};

export default Select;
