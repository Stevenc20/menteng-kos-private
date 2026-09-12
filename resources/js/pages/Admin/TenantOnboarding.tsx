import AdminLayout from '@/layouts/AdminLayout';
import Wizard from '@/pages/Tenant/Onboarding/Wizard';

interface TenantOnboardingProps {
    tenancy: {
        id: number;
    };
    profile: Record<string, unknown>;
    agreement?: {
        has_uploaded_document: boolean;
        uploaded_document_type?: string | null;
        has_digital_document?: boolean;
    } | null;
}

export default function TenantOnboarding({ tenancy, profile, agreement }: TenantOnboardingProps) {
    return (
        <AdminLayout title={`Onboarding Penghuni | Menteng Kos Private`}>
            <Wizard tenancy={tenancy as any} profile={profile as any} adminTenancyId={tenancy.id} agreement={agreement as any} />
        </AdminLayout>
    );
}