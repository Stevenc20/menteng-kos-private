import AdminLayout from '@/layouts/AdminLayout';
import { motion } from 'framer-motion';
import { Building2, Key, Users, CheckCircle, CalendarClock } from 'lucide-react';

interface DashboardProps {
    stats: {
        total_rooms: number;
        available_rooms: number;
        occupied_rooms: number;
        active_tenants: number;
    };
}

export default function Dashboard({ stats }: DashboardProps) {
    const statCards = [
        { 
            label: 'Total Unit', 
            value: stats.total_rooms, 
            desc: 'Kamar & Kios',
            icon: Building2,
            iconColor: 'text-[#1A1A18]'
        },
        { 
            label: 'Unit Tersedia', 
            value: stats.available_rooms, 
            desc: 'Siap untuk penghuni',
            icon: CheckCircle,
            iconColor: 'text-[#6B6B67]'
        },
        { 
            label: 'Unit Terisi', 
            value: stats.occupied_rooms, 
            desc: `${Math.round((stats.occupied_rooms / (stats.total_rooms || 1)) * 100)}% okupansi`,
            icon: Key,
            iconColor: 'text-[#1A1A18]'
        },
        { 
            label: 'Tenant Aktif', 
            value: stats.active_tenants, 
            desc: 'Akun terhubung',
            icon: Users,
            iconColor: 'text-[#6B6B67]'
        },
    ];

    return (
        <AdminLayout title="Admin Dashboard">
            <div className="mb-10">
                <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#1A1A18]">Dashboard</h1>
                <p className="text-[14px] md:text-[15px] text-[#6B6B67] mt-1.5">Ringkasan kondisi properti dan penghuni saat ini.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {statCards.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div 
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white p-6 rounded-[16px] border border-[#E8E7E3] shadow-sm flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-[13px] md:text-[14px] font-medium text-[#6B6B67]">{stat.label}</div>
                                <div className={`p-2 rounded-full bg-[#F7F7F5] ${stat.iconColor}`}>
                                    <Icon className="w-[18px] h-[18px]" strokeWidth={2.2} />
                                </div>
                            </div>
                            <div className="text-[32px] md:text-[36px] font-semibold text-[#1A1A18] leading-none mb-2">{stat.value}</div>
                            <div className="text-[13px] text-[#8A8A84]">{stat.desc}</div>
                        </motion.div>
                    )
                })}
            </div>

            <div className="mt-8 bg-white rounded-[16px] border border-[#E8E7E3] shadow-sm overflow-hidden">
                <div className="px-7 py-6 border-b border-[#E8E7E3]">
                    <h2 className="text-[18px] md:text-[20px] font-semibold text-[#1A1A18]">Aktivitas Mendatang</h2>
                </div>
                
                <div className="px-7 py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#F7F7F5] flex items-center justify-center mb-4">
                        <CalendarClock className="w-8 h-8 text-[#8A8A84]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-[16px] font-medium text-[#1A1A18] mb-1">Belum ada aktivitas</h3>
                    <p className="text-[14px] text-[#6B6B67] max-w-sm">
                        Saat ini belum ada aktivitas yang membutuhkan perhatian. Modul ini nantinya akan memuat tagihan jatuh tempo dan konfirmasi sewa.
                    </p>
                </div>
            </div>
        </AdminLayout>
    );
}
