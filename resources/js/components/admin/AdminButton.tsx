import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    isLoading?: boolean;
}

export function AdminButton({
    className,
    variant = 'primary',
    isLoading,
    children,
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = "inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-medium rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
        primary: "bg-[#1E1E1C] text-white hover:bg-black",
        secondary: "bg-transparent text-neutral-600 hover:bg-neutral-100",
        danger: "bg-red-50 text-red-600 hover:bg-red-100",
    };

    return (
        <button 
            className={cn(baseStyles, variants[variant], className)} 
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
}
