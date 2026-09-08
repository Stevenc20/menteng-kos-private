import AdminLayout from '@/layouts/AdminLayout';
import { motion } from 'framer-motion';

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
        { label: 'Total Kamar', value: stats.total_rooms, color: 'text-neutral-900' },
        { label: 'Kamar Tersedia', value: stats.available_rooms, color: 'text-green-600' },
        { label: 'Kamar Terisi', value: stats.occupied_rooms, color: 'text-blue-600' },
        { label: 'Tenant Aktif', value: stats.active_tenants, color: 'text-purple-600' },
    ];

    return (
        <AdminLayout title="Admin Dashboard">
            <h1 className="text-3xl font-bold tracking-tight mb-8">Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, idx) => (
                    <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm"
                    >
                        <div className="text-sm font-medium text-neutral-500 mb-2">{stat.label}</div>
                        <div className={`text-4xl font-bold ${stat.color}`}>{stat.value}</div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Aktivitas Mendatang (Draft)</h2>
                <p className="text-neutral-500">Modul ini nantinya akan memuat tagihan jatuh tempo dan konfirmasi kelanjutan tenant.</p>
            </div>
        </AdminLayout>
    );
}
