import AdminLayout from '@/layouts/AdminLayout';
import { Building2, Users, CheckCircle2, AlertCircle } from 'lucide-react';

interface DashboardProps {
    stats: {
        total_properties: number;
        available_properties: number;
        occupied_properties: number;
        total_tenants: number;
    }
}

export default function Dashboard({ stats }: DashboardProps) {
    const statCards = [
        { title: 'Total Unit', value: stats.total_properties, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        { title: 'Unit Tersedia', value: stats.available_properties, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        { title: 'Unit Terisi', value: stats.occupied_properties, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        { title: 'Total Tenant Aktif', value: stats.total_tenants, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    ];

    return (
        <AdminLayout title="Dashboard Admin">
            <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1A1A18]">Dashboard Overview</h1>
                <p className="text-sm md:text-base text-[#6B6B67] mt-1.5">Ringkasan status properti dan penghuni saat ini.</p>
            </div>

            {/* Stats Grid: 1 col on mobile, 2 on tablet, 4 on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white p-6 rounded-2xl border border-[#E8E7E3] shadow-sm flex items-start justify-between">
                            <div>
                                <p className="text-[13px] font-semibold text-[#8A8A84] uppercase tracking-wider mb-2">{stat.title}</p>
                                <p className="text-3xl font-bold text-[#1A1A18] leading-none">{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} ${stat.border} border`}>
                                <Icon className="w-6 h-6" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* We can add more sections below later without worrying about gaps because AdminLayout handles the scrolling */}
            <div className="mt-8 bg-white p-8 rounded-2xl border border-[#E8E7E3] shadow-sm flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-[#F7F7F5] rounded-full flex items-center justify-center text-[#8A8A84] mb-4">
                    <Building2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#1A1A18] mb-2">Selamat Datang di Menteng Admin</h3>
                <p className="text-[#6B6B67] text-sm max-w-md">Gunakan menu di sebelah kiri untuk mengelola properti, mengunggah foto galeri, serta mengatur data penghuni kos.</p>
            </div>
        </AdminLayout>
    );
}
