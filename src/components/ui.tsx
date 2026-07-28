import React, { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Check } from 'lucide-react';

interface ButtonProps {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50 disabled:pointer-events-none ring-offset-white",
        {
          'bg-amber text-navy hover:bg-amber-hover': variant === 'primary',
          'bg-transparent text-navy hover:bg-gray-100': variant === 'secondary',
          'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          'hover:bg-gray-100 text-navy': variant === 'ghost',
          'h-12 px-6 text-base': size === 'sm',
          'h-14 px-8 text-lg': size === 'md',
          'h-16 px-10 text-xl': size === 'lg',
        },
        className
      )}
      {...props}
    />
  );
}

export interface InputProps {
  className?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  list?: string;
  min?: number;
  max?: number;
  step?: number;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-14 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-lg text-navy placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ children, status }: { children: ReactNode, status: string }) {
  let colorClass = "bg-gray-200 text-gray-700";
  
  switch(status) {
    case 'Booked': colorClass = "bg-yellow-100 text-yellow-900"; break;
    case 'Departed': colorClass = "bg-blue-100 text-blue-900"; break;
    case 'Arrived': colorClass = "bg-green-100 text-green-900"; break;
    case 'Collected': colorClass = "bg-green-100 text-green-900"; break;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-bold", colorClass)}>
      {status === 'Collected' && <Check className="w-4 h-4" />}
      {children}
    </span>
  );
}
