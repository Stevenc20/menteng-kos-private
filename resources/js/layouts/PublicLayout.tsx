import { ReactNode } from 'react';
import { Head, Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

interface PublicLayoutProps {
    children: ReactNode;
    title?: string;
}

export default function PublicLayout({ children, title = 'Menteng Kos Private' }: PublicLayoutProps) {
    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
            <Head title={title} />
            
            {/* Navbar */}
            <header className="fixed top-0 w-full bg-neutral-50/80 backdrop-blur-md z-50 border-b border-neutral-200">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold tracking-tight uppercase">
                        Menteng Kos Private
                    </Link>
                    
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                        <a href="#rooms" className="hover:text-neutral-500 transition-colors">Kamar & Kios</a>
                        <a href="#facilities" className="hover:text-neutral-500 transition-colors">Fasilitas</a>
                        <a href="#gallery" className="hover:text-neutral-500 transition-colors">Galeri</a>
                    </nav>

                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm font-medium hover:text-neutral-500 transition-colors">
                            Tenant Login
                        </Link>
                        <a 
                            href="https://wa.me/6281234567890?text=Halo,%20saya%20ingin%20jadwalkan%20survey%20Menteng%20Kos%20Private."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-neutral-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-neutral-800 transition-all hover:scale-105"
                        >
                            Ajukan Survey
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-20">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-neutral-900 text-neutral-400 py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="text-lg font-bold text-white tracking-tight uppercase">
                        Menteng Kos Private
                    </div>
                    <div className="text-sm">
                        &copy; {new Date().getFullYear()} Menteng Kos Private. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
