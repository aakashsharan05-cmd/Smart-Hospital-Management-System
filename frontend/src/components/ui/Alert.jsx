import React from 'react';
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoInformationCircleOutline,
  IoClose,
} from 'react-icons/io5';

const Alert = ({
  type = 'info',
  message,
  title,
  children,
  onClose,
  className = '',
}) => {
  if (!message && !children) return null;

  const typeConfig = {
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: IoAlertCircleOutline,
      iconColor: 'text-red-600',
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: IoCheckmarkCircleOutline,
      iconColor: 'text-emerald-600',
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: IoWarningOutline,
      iconColor: 'text-amber-600',
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: IoInformationCircleOutline,
      iconColor: 'text-blue-600',
    },
  };

  const config = typeConfig[type] || typeConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all duration-200 ${config.container} ${className}`}
    >
      <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 text-left">
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        <div className="leading-relaxed">{message || children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 p-1 rounded-md transition-opacity cursor-pointer"
          aria-label="Dismiss alert"
        >
          <IoClose className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
