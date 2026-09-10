import AdminLayout from '@/layouts/AdminLayout';
import Wizard from '@/pages/Tenant/Onboarding/Wizard';

interface TenantOnboardingProps {
    tenancy: {
        id: number;
    };
    profile: Record<string, unknown>;
}

export default function TenantOnboarding({ tenancy, profile }: TenantOnboardingProps) {
    return (
        <AdminLayout title={`Onboarding Penghuni | Menteng Kos Private`}>
            <Wizard tenancy={tenancy as any} profile={profile as any} adminTenancyId={tenancy.id} />
        </AdminLayout>
    );
}