import React from 'react';

const Input = ({
  label,
  id,
  name,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) => {
  const inputId = id || name;

  return (
    <div className={`flex flex-col gap-1.5 text-left w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${
            Icon ? 'pl-9' : ''
          } ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-300 hover:border-slate-400'
          }`}
          {...props}
        />
      </div>
      {error ? (
        <span className="text-xs text-red-600 font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-slate-500">{helperText}</span>
      ) : null}
    </div>
  );
};

export default Input;
