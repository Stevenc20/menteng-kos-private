import { ReactNode, useState, useEffect } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut } from 'lucide-react';

interface AdminLayoutProps {
    children: ReactNode;
    title?: string;
}

export default function AdminLayout({ children, title = 'Admin Dashboard' }: AdminLayoutProps) {
    const { url } = usePage();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [url]);

    const navItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { name: 'Properti', href: '/admin/properties', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { name: 'Tenant', href: '/admin/tenants', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    ];

    const SidebarContent = () => (
        <>
            <div className="h-20 flex items-center px-8 border-b border-[#E8E7E3] shrink-0">
                <span className="font-bold tracking-tight text-lg text-[#1A1A18] uppercase">Menteng Admin</span>
            </div>
            
            <nav className="flex-1 px-5 py-8 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = url.startsWith(item.href);
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm ${
                                isActive
                                    ? 'bg-[#1A1A18] text-white shadow-sm' 
                                    : 'text-[#6B6B67] hover:bg-[#F7F7F5] hover:text-[#1A1A18]'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                            </svg>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-5 border-t border-[#E8E7E3] shrink-0">
                <form method="POST" action="/logout">
                    <input type="hidden" name="_token" value={(window as any).csrf_token} />
                    <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="w-5 h-5" />
                        Logout
                    </button>
                </form>
            </div>
        </>
    );

    return (
        <div className="admin-print h-screen w-full flex overflow-hidden bg-[#F7F7F5] font-sans text-[#1A1A18]">

            <style>{`
                @media print {
                    .admin-print, .admin-print > div, .admin-print header, .admin-print main, .admin-print aside, .admin-print nav {
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                        background: #fff !important;
                    }
                }
            `}</style>
            <Head title={title} />
            
            {/* DESKTOP SIDEBAR (Fixed) */}
            <aside className="w-[280px] h-full bg-white border-r border-[#E8E7E3] hidden lg:flex flex-col shrink-0">
                <SidebarContent />
            </aside>

            {/* MOBILE DRAWER */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-[#1A1A18]/40 backdrop-blur-sm z-40 lg:hidden"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <motion.aside 
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className="fixed inset-y-0 left-0 w-[280px] bg-white border-r border-[#E8E7E3] z-50 flex flex-col shadow-2xl lg:hidden"
                        >
                            <button 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="absolute top-6 right-6 p-2 text-[#6B6B67] hover:text-[#1A1A18] hover:bg-[#F7F7F5] rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <SidebarContent />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Mobile Header */}
                <header className="h-16 shrink-0 bg-white border-b border-[#E8E7E3] flex items-center justify-between px-6 lg:hidden z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 text-[#6B6B67] hover:text-[#1A1A18] hover:bg-[#F7F7F5] rounded-md transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <span className="font-bold tracking-tight text-[#1A1A18] uppercase">Menteng Admin</span>
                    </div>
                </header>
                
                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8 lg:p-12 relative w-full">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-[1200px] mx-auto pb-12 w-full"
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
