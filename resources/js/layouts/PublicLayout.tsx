import { ReactNode, useState, useEffect } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

interface PublicLayoutProps {
    children: ReactNode;
    title?: string;
    hideFooter?: boolean;
    transparentTop?: boolean; // Set this true for Landing Page
}

export default function PublicLayout({ children, title = 'Menteng Kos Private', hideFooter = false, transparentTop = false }: PublicLayoutProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        // initial check
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [isMobileMenuOpen]);

    const isTransparent = transparentTop && !scrolled;
    
    // Dynamic styles for navbar content based on scroll state
    const textColor = isTransparent ? 'text-white' : 'text-[#1A1A18]';
    const linkHoverColor = isTransparent ? 'hover:text-white/70' : 'hover:text-[#6B6B67]';
    const btnBg = isTransparent ? 'bg-white text-[#1A1A18] hover:bg-neutral-100' : 'bg-[#1A1A18] text-white hover:bg-neutral-800';

    const NavLinks = () => (
        <>
            <a href="/#rooms" onClick={() => setIsMobileMenuOpen(false)} className={`text-sm font-medium transition-colors py-2 ${linkHoverColor}`}>Kamar & Kios</a>
            <a href="/#facilities" onClick={() => setIsMobileMenuOpen(false)} className={`text-sm font-medium transition-colors py-2 ${linkHoverColor}`}>Fasilitas</a>
            <a href="/#gallery" onClick={() => setIsMobileMenuOpen(false)} className={`text-sm font-medium transition-colors py-2 ${linkHoverColor}`}>Galeri</a>
            <a href="/#lokasi" onClick={() => setIsMobileMenuOpen(false)} className={`text-sm font-medium transition-colors py-2 ${linkHoverColor}`}>Lokasi</a>
        </>
    );

    return (
        <div className="min-h-screen bg-[#F8F8F6] text-[#1A1A18] font-sans selection:bg-[#1A1A18] selection:text-white flex flex-col">
            <Head title={title} />
            
            {/* Desktop Navbar */}
            <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${isTransparent ? 'bg-transparent border-transparent' : 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#E8E7E3]'}`}>
                <div className="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 shrink-0">
                        <img
                            src="/images/logo/logo.png"
                            alt="Logo Menteng Kos Private"
                            className="h-10 w-10 object-contain drop-shadow-sm"
                            width="40"
                            height="40"
                        />
                        <span className={`text-xl font-bold tracking-tight uppercase transition-colors ${textColor}`}>
                            Menteng Kos Private
                        </span>
                    </Link>
                    
                    {/* Desktop Navigation */}
                    <nav className={`hidden lg:flex items-center gap-8 ${textColor}`}>
                        <NavLinks />
                    </nav>

                    <div className="hidden lg:flex items-center gap-6">
                        <Link href="/login" className={`text-sm font-medium transition-colors ${textColor} ${linkHoverColor}`}>
                            Tenant Login
                        </Link>
                        <a 
                            href="https://wa.me/6281234567890?text=Halo,%20saya%20ingin%20jadwalkan%20survey%20Menteng%20Kos%20Private."
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all shadow-md active:scale-95 ${btnBg}`}
                        >
                            Ajukan Survey
                        </a>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button 
                        className={`lg:hidden p-2 -mr-2 rounded-full transition-colors ${textColor} hover:bg-black/10`}
                        onClick={() => setIsMobileMenuOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Mobile Drawer Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[60] bg-[#1A1A18]/40 backdrop-blur-sm lg:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        {/* Drawer Content */}
                        <motion.div 
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className="absolute right-0 top-0 bottom-0 w-[300px] bg-white shadow-2xl flex flex-col"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside drawer
                        >
                            <div className="h-20 flex items-center justify-between px-6 border-b border-[#E8E7E3]">
                                <div className="flex items-center gap-2">
                                    <img
                                        src="/images/logo/logo.png"
                                        alt="Logo Menteng Kos"
                                        className="h-7 w-7 object-contain"
                                        width="28"
                                        height="28"
                                    />
                                    <span className="font-bold tracking-tight uppercase text-sm text-[#1A1A18]">Menteng Kos</span>
                                </div>
                                <button 
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 -mr-2 text-[#6B6B67] hover:bg-neutral-100 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="flex flex-col px-6 py-8 gap-4 overflow-y-auto flex-1 text-[#1A1A18]">
                                <a href="/#rooms" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-[#6B6B67] transition-colors py-2">Kamar & Kios</a>
                                <a href="/#facilities" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-[#6B6B67] transition-colors py-2">Fasilitas</a>
                                <a href="/#gallery" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-[#6B6B67] transition-colors py-2">Galeri</a>
                                <a href="/#lokasi" onClick={() => setIsMobileMenuOpen(false)} className="text-sm font-medium hover:text-[#6B6B67] transition-colors py-2">Lokasi</a>
                                
                                <div className="h-px bg-[#E8E7E3] my-4" />
                                
                                <Link 
                                    href="/login" 
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-sm font-medium hover:text-[#6B6B67] transition-colors py-2"
                                >
                                    Tenant Login
                                </Link>
                                
                                <a 
                                    href="https://wa.me/6281234567890?text=Halo,%20saya%20ingin%20jadwalkan%20survey%20Menteng%20Kos%20Private."
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#1A1A18] text-white px-5 py-3 rounded-xl text-center text-sm font-medium mt-4 shadow-md active:scale-95 transition-transform"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Ajukan Survey
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="flex-1 flex flex-col w-full">
                {children}
            </main>

            {/* Footer */}
            {!hideFooter && (
                <footer className="bg-white border-t border-[#E8E7E3] py-8 lg:py-12 mt-auto">
                    <div className="max-w-[1440px] mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-lg font-bold text-[#1A1A18] tracking-tight uppercase">
                            Menteng Kos Private
                        </div>
                        <div className="text-[13px] text-[#8A8A84] font-medium text-center md:text-left">
                            &copy; {new Date().getFullYear()} Menteng Kos Private. All rights reserved.
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
