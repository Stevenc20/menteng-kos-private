import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface AdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg';
}

export function AdminModal({ isOpen, onClose, children, maxWidth = 'md' }: AdminModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const maxWidthClasses = {
        sm: 'max-w-[420px]',
        md: 'max-w-[540px]',
        lg: 'max-w-[720px]',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-[#141412]/45 backdrop-blur-[2px]"
                        onClick={onClose}
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={cn(
                            "relative w-full bg-white rounded-[20px] shadow-2xl border border-[#E8E7E3] flex flex-col max-h-[90vh]",
                            maxWidthClasses[maxWidth]
                        )}
                    >
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export function AdminModalHeader({ 
    title, 
    description, 
    onClose 
}: { 
    title: string; 
    description?: string; 
    onClose?: () => void; 
}) {
    return (
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-transparent">
            <div>
                <h2 className="text-[20px] font-bold text-[#1A1A18] leading-tight">{title}</h2>
                {description && (
                    <p className="text-[14px] text-[#6B6B67] mt-1.5 leading-relaxed">{description}</p>
                )}
            </div>
            {onClose && (
                <button 
                    onClick={onClose}
                    className="flex items-center justify-center w-10 h-10 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors shrink-0 -mt-1 -mr-2"
                >
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}

export function AdminModalContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("px-6 py-2 overflow-y-auto flex-1 min-h-0", className)}>
            {children}
        </div>
    );
}

export function AdminModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("px-6 py-4 mt-2 border-t border-neutral-100 flex items-center justify-end gap-3", className)}>
            {children}
        </div>
    );
}
