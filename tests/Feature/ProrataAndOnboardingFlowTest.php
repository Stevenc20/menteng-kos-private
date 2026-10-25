<?php

use App\Models\Agreement;
use App\Models\AgreementRevision;
use App\Models\Billing;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\User;
use App\Services\ProrataBillingService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createProrataAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function createProrataTenancy(array $overrides = []): Tenancy
{
    $user = $overrides['user'] ?? User::factory()->create(['role' => 'TENANT']);
    $property = $overrides['property'] ?? Property::create([
        'name' => 'Kamar 101',
        'type' => 'ROOM',
        'normal_price' => 1500000,
        'status' => 'AVAILABLE',
        'facilities' => ['AC', 'Kasur', 'Lemari', 'Meja', 'Kursi', 'Kamar Mandi Dalam'],
    ]);
    unset($overrides['user'], $overrides['property']);

    return Tenancy::create(array_merge([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1500000,
        'move_in_date' => '2026-11-24',
        'due_day' => 1,
        'status' => 'INVITED',
    ], $overrides));
}

test('prorata calculation for Nov 24 move-in paid until Nov 24 yields 7 days to Dec 1 and due date on the 1st', function () {
    $result = ProrataBillingService::calculateProrata(
        monthlyRent: 1500000,
        moveInDate: '2026-11-24',
        initialPaidUntil: '2026-11-24',
        basisMode: 'ACTUAL',
    );

    expect($result['ready'])->toBeTrue();
    expect($result['prorata_start_date'])->toBe('2026-11-24');
    expect($result['prorata_end_date'])->toBe('2026-12-01');
    expect($result['prorata_days'])->toBe(7);
    expect($result['basis_days'])->toBe(30); // November has 30 days
    expect($result['daily_rate'])->toBe(50000.0); // 1,500,000 / 30
    expect($result['prorata_amount'])->toBe(350000.0); // 7 * 50,000
    expect($result['normal_period_start_date'])->toBe('2026-12-01');
    expect($result['due_day'])->toBe(1);
});

test('prorata calculation across month boundaries and already paid period never double charges', function () {
    // Tenant moved in Oct 25, already paid initial rent until Dec 20.
    // Prorata adjustment period should only be from Dec 20 to Jan 1 (12 days in Dec, 31-day month).
    $result = ProrataBillingService::calculateProrata(
        monthlyRent: 3100000,
        moveInDate: '2026-10-25',
        initialPaidUntil: '2026-12-20',
        basisMode: 'ACTUAL',
    );

    expect($result['ready'])->toBeTrue();
    expect($result['prorata_start_date'])->toBe('2026-12-20');
    expect($result['prorata_end_date'])->toBe('2027-01-01');
    expect($result['prorata_days'])->toBe(12);
    expect($result['basis_days'])->toBe(31); // December has 31 days
    expect($result['daily_rate'])->toBe(100000.0);
    expect($result['prorata_amount'])->toBe(1200000.0);
    expect($result['normal_period_start_date'])->toBe('2027-01-01');
    expect($result['due_day'])->toBe(1);

    // Also test cross-month segment (e.g. Oct 28 paid until Oct 28, custom targetNormalStart Dec 1)
    $crossMonth = ProrataBillingService::calculateProrata(
        monthlyRent: 3100000,
        moveInDate: '2026-10-28',
        initialPaidUntil: '2026-10-28',
        basisMode: '30_DAYS',
        targetNormalStart: '2026-12-01',
    );
    expect($crossMonth['ready'])->toBeTrue();
    expect($crossMonth['prorata_days'])->toBe(34); // 4 days in Oct + 30 days in Nov
});

test('prorata does not auto-generate bills when initial_paid_until is unknown', function () {
    $service = app(ProrataBillingService::class);
    $tenancy = createProrataTenancy();

    $calc = $service->syncTenancyProrata($tenancy, [
        'move_in_date' => '2026-11-24',
        'agreed_price' => 1500000,
        'initial_paid_until' => null,
    ]);

    expect($calc['ready'])->toBeFalse();
    expect(Billing::where('tenancy_id', $tenancy->id)->count())->toBe(0);
});

test('prorata billing synchronization is idempotent and separates lease period from payment status', function () {
    $service = app(ProrataBillingService::class);
    $tenancy = createProrataTenancy();

    $payload = [
        'move_in_date' => '2026-11-24',
        'agreed_price' => 1500000,
        'initial_paid_until' => '2026-11-24',
        'initial_payment_status' => 'PAID',
        'prorata_basis_mode' => 'ACTUAL',
        'prorata_status' => 'PENDING_PAYMENT',
    ];

    // Call sync multiple times (simulating page refresh or repeated save)
    $service->syncTenancyProrata($tenancy, $payload);
    $service->syncTenancyProrata($tenancy, $payload);
    $service->syncTenancyProrata($tenancy, $payload);

    $bills = Billing::where('tenancy_id', $tenancy->id)->where('period_type', 'PRORATA')->get();
    expect($bills)->toHaveCount(1);

    $bill = $bills->first();
    expect((float) $bill->amount)->toBe(350000.0);
    expect($bill->days_count)->toBe(7);
    expect($bill->status)->toBe('PENDING_PAYMENT');
    expect($bill->paid_at)->toBeNull();
});

test('admin prepares statement and saves without signature, then tenant only reads, initials, and signs', function () {
    $admin = createProrataAdmin();
    $tenant = User::factory()->create(['role' => 'TENANT']);
    $tenancy = createProrataTenancy(['user' => $tenant]);

    // 1. Admin fills identity & KTP data
    $this->actingAs($admin)->post("/admin/tenants/{$tenancy->id}/onboarding/info", [
        'whatsapp' => '081234567890',
        'ktp_1_name' => 'Andi Wijaya',
        'ktp_1_nik' => '3171010101900001',
        'ktp_1_birth_place' => 'Jakarta',
        'ktp_1_birth_date' => '1990-01-01',
        'ktp_1_job' => 'Karyawan Swasta',
        'ktp_1_address' => 'Jl. Menteng Raya No. 10',
        'has_second_occupant' => false,
    ])->assertSessionHasNoErrors();

    // 2. Admin saves statement & prorata configuration (Simpan / save_only = true)
    $this->actingAs($admin)->post("/admin/tenants/{$tenancy->id}/onboarding/agreement", [
        'save_only' => true,
        'move_in_date' => '2026-11-24',
        'agreed_price' => 1500000,
        'due_date_day' => 1,
        'denda_per_day' => '50000',
        'meteran_air' => '120',
        'notes' => 'Ketentuan sewa sudah disepakati',
        'facilities' => ['AC', 'Kasur', 'Lemari', 'Meja', 'Kursi', 'Kamar Mandi Dalam'],
        'initial_paid_until' => '2026-11-24',
        'initial_payment_status' => 'PAID',
        'prorata_basis_mode' => 'ACTUAL',
        'prorata_status' => 'PENDING_PAYMENT',
        'document_html' => '<div class="doc-container"><p>Surat Pernyataan Andi Wijaya</p></div>',
    ])->assertRedirect(route('admin.tenants.show', $tenancy->id));

    $tenancy->refresh();
    expect($tenancy->status)->toBe('AGREEMENT_PENDING');
    expect((int) $tenancy->due_day)->toBe(1);
    expect($tenancy->prorata_days)->toBe(7);
    expect((float) $tenancy->prorata_amount)->toBe(350000.0);

    $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
    expect($agreement)->not->toBeNull();
    expect($agreement->status)->toBe('DRAFT');
    expect($agreement->document_html)->toContain('Rincian Ketentuan Pembayaran Awal');

    // 3. Tenant logs in and accesses /tenant/onboarding -> receives SignStatement page
    $this->actingAs($tenant)
        ->get('/tenant/onboarding')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Tenant/Onboarding/SignStatement'));

    // 4. Tenant CANNOT modify identity/KTP data once prepared by admin
    $this->actingAs($tenant)->post('/tenant/onboarding/info', [
        'whatsapp' => '08999999999',
        'ktp_1_name' => 'Hacker Name',
        'ktp_1_nik' => '9999999999999999',
        'ktp_1_birth_place' => 'Bandung',
        'ktp_1_birth_date' => '1999-09-09',
        'ktp_1_job' => 'Other',
        'ktp_1_address' => 'Other Address',
        'has_second_occupant' => false,
    ])->assertForbidden();

    expect(TenantProfile::where('user_id', $tenant->id)->first()->ktp_1_name)->toBe('Andi Wijaya');

    // 5. Tenant submits paraf and digital signature (even if they try to pass a different move_in_date or due_date_day, admin's values remain locked)
    $this->actingAs($tenant)->post('/tenant/onboarding/agreement', [
        'document_html' => '<div class="doc-container"><p>Signed Surat Pernyataan Andi Wijaya</p></div>',
        'signature_1' => 'data:image/png;base64,BBB=',
        'paraf_1' => 'data:image/png;base64,CCC=',
        'move_in_date' => '2026-12-25', // attempted tamper
        'due_date_day' => 15, // attempted tamper
    ])->assertRedirect(route('tenant.onboarding'));

    $tenancy->refresh();
    $agreement->refresh();
    expect($agreement->status)->toBe('SIGNED');
    expect($tenancy->status)->toBe('PENDING_ADMIN_APPROVAL');
    expect($tenancy->move_in_date)->toBe('2026-11-24'); // preserved from admin
    expect((int) $tenancy->due_day)->toBe(1); // preserved from admin
});

test('modifying payment terms on a signed agreement records a trackable revision snapshot', function () {
    $admin = createProrataAdmin();
    $tenancy = createProrataTenancy([
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
        'initial_paid_until' => '2026-11-24',
    ]);

    app(ProrataBillingService::class)->syncTenancyProrata($tenancy, [
        'move_in_date' => '2026-11-24',
        'agreed_price' => 1500000,
        'initial_paid_until' => '2026-11-24',
        'prorata_basis_mode' => 'ACTUAL',
    ]);

    $agreement = Agreement::create([
        'tenancy_id' => $tenancy->id,
        'document_html' => '<div class="doc-container"><p>Dokumen Awal</p></div>',
        'status' => 'SIGNED',
        'signed_at' => now(),
        'version' => 1,
    ]);

    // Admin updates payment/prorata terms via updateTenancyDetails
    $this->actingAs($admin)->put("/admin/tenants/{$tenancy->id}/details", [
        'move_in_date' => '2026-11-24',
        'agreed_price' => 1500000,
        'due_day' => 1,
        'initial_paid_until' => '2026-11-26', // changed from Nov 24 to Nov 26 (now 5 days prorata)
        'initial_payment_status' => 'PAID',
        'prorata_basis_mode' => 'ACTUAL',
        'prorata_status' => 'PENDING_PAYMENT',
        'revision_reason' => 'Koreksi tanggal bukti transfer pembayaran awal',
        'require_resign' => false,
    ])->assertSessionHasNoErrors();

    $agreement->refresh();
    expect($agreement->version)->toBe(2);
    expect($agreement->revision_notes)->toBe('Koreksi tanggal bukti transfer pembayaran awal');

    $revisions = AgreementRevision::where('agreement_id', $agreement->id)->get();
    expect($revisions)->toHaveCount(1);
    expect($revisions->first()->previous_terms_snapshot['prorata_days'])->toBe(7);
    expect($revisions->first()->new_terms_snapshot['prorata_days'])->toBe(5);
});
