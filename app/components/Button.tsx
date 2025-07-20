import React from 'react';
import { audioManager, SoundType } from '@/app/lib/audio-manager';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      audioManager.play(SoundType.CLICK);
    }
    onClick?.(e);
  };

  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl disabled:hover:bg-gray-600',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white disabled:hover:bg-gray-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white disabled:hover:bg-gray-600',
    ghost: 'bg-transparent hover:bg-gray-700/50 text-gray-300 hover:text-white disabled:hover:bg-gray-600'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg min-h-[52px]'
  };

  const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={disabled}
      className={combinedClassName}
    >
      {children}
    </button>
  );
}