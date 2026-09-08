import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export function FormSection({ title }: { title: string }) {
    return (
        <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1.5 mb-3 mt-6 first:mt-0">
            {title}
        </div>
    );
}

export function FormLabel({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        <label className={cn("block text-[14px] font-medium text-[#2A2A27] mb-1.5", className)} {...props}>
            {children}
        </label>
    );
}

export function FormHelper({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={cn("text-[12px] text-[#6B6B67] mt-1.5", className)}>{children}</p>;
}

export function FormError({ children }: { children?: React.ReactNode }) {
    if (!children) return null;
    return <p className="text-[12px] text-red-500 mt-1.5 font-medium">{children}</p>;
}

const inputBaseStyles = "w-full h-[46px] px-3.5 bg-white border border-[#DCDCD6] rounded-[10px] text-[14px] text-[#1A1A18] placeholder:text-[#A1A19A] transition-colors focus:outline-none focus:border-[#1E1E1C] focus:ring-1 focus:ring-[#1E1E1C] hover:border-neutral-400 disabled:opacity-50 disabled:bg-neutral-50";

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
    return (
        <input ref={ref} className={cn(inputBaseStyles, className)} {...props} />
    );
});
TextInput.displayName = "TextInput";

export const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => {
    return (
        <div className="relative">
            <select 
                ref={ref} 
                className={cn(inputBaseStyles, "appearance-none pr-10", className)} 
                {...props}
            >
                {children}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        </div>
    );
});
SelectInput.displayName = "SelectInput";

export const DateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
    return (
        <input type="date" ref={ref} className={cn(inputBaseStyles, className)} {...props} />
    );
});
DateInput.displayName = "DateInput";

// Currency Input specifically designed to format IDR on the fly but emit raw numbers
interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: string | number;
    onChange: (value: string) => void;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (value) {
            const numericValue = value.toString().replace(/[^0-9]/g, '');
            setDisplayValue(new Intl.NumberFormat('id-ID').format(Number(numericValue)));
        } else {
            setDisplayValue('');
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/[^0-9]/g, '');
        onChange(rawValue);
    };

    return (
        <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-neutral-400 font-medium select-none">
                Rp
            </div>
            <input
                type="text"
                value={displayValue}
                onChange={handleChange}
                className={cn(inputBaseStyles, "pl-10", className)}
                {...props}
            />
        </div>
    );
}
