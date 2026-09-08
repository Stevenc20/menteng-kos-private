import { ReactNode } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';

interface AdminLayoutProps {
    children: ReactNode;
    title?: string;
}

export default function AdminLayout({ children, title = 'Admin Dashboard' }: AdminLayoutProps) {
    const { url } = usePage();

    const navItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { name: 'Properti', href: '/admin/properties', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { name: 'Tenant & Undangan', href: '/admin/tenants', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    ];

    return (
        <div className="min-h-screen bg-[#F7F7F5] flex font-sans text-[#1A1A18]">
            <Head title={title} />
            
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-[#E8E7E3] flex flex-col hidden md:flex shrink-0">
                <div className="h-[80px] flex items-center px-8 border-b border-[#E8E7E3]">
                    <span className="font-bold tracking-tight text-[18px] text-[#1A1A18] uppercase">Menteng Admin</span>
                </div>
                <nav className="flex-1 px-5 py-8 space-y-2">
                    {navItems.map((item) => {
                        const isActive = url.startsWith(item.href);
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-[10px] transition-colors font-medium text-[14px] ${
                                    isActive
                                        ? 'bg-[#1E1E1C] text-white shadow-sm' 
                                        : 'text-[#6B6B67] hover:bg-[#F7F7F5] hover:text-[#1A1A18]'
                                }`}
                            >
                                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                                </svg>
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-5 border-t border-[#E8E7E3]">
                    <form method="POST" action="/logout">
                        <input type="hidden" name="_token" value={(window as any).csrf_token} />
                        <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-[10px] text-[14px] font-medium text-red-600/90 hover:bg-red-50 hover:text-red-700 transition-colors">
                            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 bg-white border-b border-[#E8E7E3] flex items-center px-8 md:hidden">
                    <span className="font-bold text-[#1A1A18]">Menteng Admin</span>
                </header>
                
                <main className="flex-1 overflow-auto p-8 md:p-12">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="max-w-[1000px] mx-auto"
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
}
