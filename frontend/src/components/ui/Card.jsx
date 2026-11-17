import React from 'react';

export const Card = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all text-left ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`p-5 pb-3 border-b border-slate-100 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '' }) => {
  return (
    <h3 className={`text-base font-semibold text-slate-900 tracking-tight ${className}`}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className = '' }) => {
  return <p className={`text-xs text-slate-500 mt-0.5 ${className}`}>{children}</p>;
};

export const CardContent = ({ children, className = '' }) => {
  return <div className={`p-5 ${className}`}>{children}</div>;
};

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  className = '',
}) => {
  const colorStyles = {
    blue: {
      bg: 'bg-blue-50 text-blue-600',
      border: 'border-blue-100',
    },
    emerald: {
      bg: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-100',
    },
    amber: {
      bg: 'bg-amber-50 text-amber-600',
      border: 'border-amber-100',
    },
    red: {
      bg: 'bg-red-50 text-red-600',
      border: 'border-red-100',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-600',
      border: 'border-purple-100',
    },
    slate: {
      bg: 'bg-slate-100 text-slate-600',
      border: 'border-slate-200',
    },
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <Card className={`p-5 hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</p>
          <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${style.bg} shrink-0`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </Card>
  );
};

export default Card;
