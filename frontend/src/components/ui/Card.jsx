import React from 'react';

export const Card = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#E2EAE5] shadow-xs hover:border-[#CCD8D1] transition-all text-left ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`p-5 pb-3 border-b border-[#EEF3F0] flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '' }) => {
  return (
    <h3 className={`text-base font-semibold text-[#11261F] tracking-tight ${className}`}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className = '' }) => {
  return <p className={`text-xs text-[#526B62] mt-0.5 ${className}`}>{children}</p>;
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
      bg: 'bg-[#EDF7F2] text-[#0E382C]',
      border: 'border-[#C6E7D5]',
    },
    green: {
      bg: 'bg-[#EDF7F2] text-[#0E382C]',
      border: 'border-[#C6E7D5]',
    },
    mustard: {
      bg: 'bg-[#FDF8EB] text-[#B8850C]',
      border: 'border-[#F5DE9B]',
    },
    emerald: {
      bg: 'bg-emerald-50 text-emerald-700',
      border: 'border-emerald-200',
    },
    amber: {
      bg: 'bg-[#FDF8EB] text-[#B8850C]',
      border: 'border-[#F5DE9B]',
    },
    red: {
      bg: 'bg-red-50 text-red-700',
      border: 'border-red-200',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-700',
      border: 'border-purple-200',
    },
    slate: {
      bg: 'bg-[#F4F7F5] text-[#526B62]',
      border: 'border-[#E2EAE5]',
    },
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <Card className={`p-5 hover:shadow-md transition-shadow duration-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#526B62]">{title}</p>
          <div className="text-2xl font-bold text-[#11261F] mt-1">{value}</div>
          {subtitle && <p className="text-xs text-[#526B62] mt-1">{subtitle}</p>}
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
