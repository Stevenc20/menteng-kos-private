import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface TenantLayoutProps {
    title: string;
    children: React.ReactNode;
}

const NAV_LINKS = [
    { href: '/tenant/dashboard', label: 'Dashboard' },
    { href: '/tenant/payments', label: 'Pembayaran' },
    { href: '/tenant/water-usage', label: 'Air (PAM)' },
    { href: '/tenant/agreement', label: 'Surat Pernyataan' },
];

export default function TenantLayout({ title, children }: TenantLayoutProps) {
    const { url } = usePage();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) => url === href || url.startsWith(`${href}/`);

    const navItems = NAV_LINKS.map((link) => (
        <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                isActive(link.href)
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
        >
            {link.label}
        </Link>
    ));

    const logoutButton = (
        <Link
            href="/logout"
            method="post"
            as="button"
            className="text-sm font-medium text-red-600 hover:text-red-800"
        >
            Keluar
        </Link>
    );

    return (
        <div className="min-h-screen bg-neutral-50 font-sans">
            <Head title={`${title} | Menteng Kos Private`} />

            {/* Topbar */}
            <nav className="bg-white border-b border-neutral-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center min-w-0">
                            <Link href="/tenant/dashboard" className="text-lg sm:text-xl font-bold tracking-tight uppercase whitespace-nowrap">
                                Menteng Kos
                            </Link>
                        </div>

                        {/* Desktop nav */}
                        <div className="hidden md:flex items-center gap-1">
                            {navItems}
                            <div className="ml-3 border-l border-neutral-200 pl-3">{logoutButton}</div>
                        </div>

                        {/* Mobile: hamburger */}
                        <button
                            type="button"
                            aria-label="Menu"
                            onClick={() => setMobileOpen((v) => !v)}
                            className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-neutral-600 hover:bg-neutral-100"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {mobileOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                                )}
                            </svg>
                        </button>
                    </div>

                    {/* Mobile dropdown panel */}
                    {mobileOpen && (
                        <div className="md:hidden border-t border-neutral-100 py-3 space-y-1">
                            <div className="flex flex-col gap-1">{navItems}</div>
                            <div className="pt-2 border-t border-neutral-100">{logoutButton}</div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {children}
            </main>
        </div>
    );
}