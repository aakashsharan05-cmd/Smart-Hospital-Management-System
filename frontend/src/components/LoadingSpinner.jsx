import React from 'react';

const LoadingSpinner = ({ size = 'md', text = 'Loading...', fullScreen = false }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-blue-200 border-t-blue-600 rounded-full animate-spin`}
      />
      {text && <span className="text-sm font-medium text-slate-500">{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl shadow-xl flex items-center gap-3">
          {spinner}
        </div>
      </div>
    );
  }

  return <div className="py-8 flex items-center justify-center">{spinner}</div>;
};

export default LoadingSpinner;
