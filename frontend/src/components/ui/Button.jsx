import React from 'react';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  className = '',
  onClick,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed select-none cursor-pointer';

  const variantClasses = {
    primary:
      'bg-[#0E382C] text-white hover:bg-[#164638] active:bg-[#09261E] focus:ring-[#0E382C]/30 shadow-xs font-semibold',
    mustard:
      'bg-[#E5B229] text-[#0E382C] hover:bg-[#D4A11D] active:bg-[#B8850C] focus:ring-[#E5B229]/40 shadow-xs font-bold',
    secondary:
      'bg-[#EDF7F2] text-[#0E382C] hover:bg-[#E2F0E8] active:bg-[#D6EADB] focus:ring-[#0E382C]/20 border border-[#C6E7D5] font-medium',
    success:
      'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 focus:ring-emerald-500 shadow-xs font-semibold',
    danger:
      'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 shadow-xs font-semibold',
    warning:
      'bg-amber-600 text-white hover:bg-amber-700 active:bg-amber-800 focus:ring-amber-500 shadow-xs font-semibold',
    outline:
      'bg-transparent border border-[#CCD8D1] text-[#0E382C] hover:bg-[#EDF7F2] focus:ring-[#0E382C]/30 font-medium',
    ghost:
      'bg-transparent text-[#526B62] hover:bg-[#EDF7F2] hover:text-[#0E382C] active:bg-[#E2F0E8] focus:ring-[#0E382C]/20',
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="text-current text-base shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
};

export default Button;
