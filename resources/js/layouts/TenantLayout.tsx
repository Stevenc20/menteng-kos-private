import { Head, Link } from '@inertiajs/react';

interface TenantLayoutProps {
    title: string;
    children: React.ReactNode;
}

export default function TenantLayout({ title, children }: TenantLayoutProps) {
    return (
        <div className="min-h-screen bg-neutral-50 font-sans">
            <Head title={`${title} | Menteng Kos Private`} />
            
            {/* Topbar */}
            <nav className="bg-white border-b border-neutral-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/tenant/dashboard" className="text-xl font-bold tracking-tight uppercase">Menteng Kos</Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <form method="POST" action="/logout">
                                <input type="hidden" name="_token" value={(window as any).csrf_token} />
                                <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-800">Logout</button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
