<?php

use App\Models\Agreement;
use App\Models\AgreementSignature;
use App\Models\Billing;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterPeriod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function fakeJpegUpload(string $name = 'bukti.jpg'): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'jpeg');
    file_put_contents($path, base64_decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=='));

    return new UploadedFile($path, $name, 'image/jpeg', null, true);
}

function makePortalTenant(array $overrides = []): User
{
    return User::factory()->create(array_merge(['role' => 'TENANT'], $overrides));
}

function makePortalProperty(string $type = 'ROOM', string $name = 'Kamar Portal'): Property
{
    return Property::create([
        'name' => $name,
        'type' => $type,
        'normal_price' => $type === 'KIOSK' ? 3000000 : 1000000,
        'status' => 'OCCUPIED',
    ]);
}

function makePortalTenancy(array $overrides = []): Tenancy
{
    $user = $overrides['user'] ?? makePortalTenant();
    $property = $overrides['property'] ?? makePortalProperty();
    unset($overrides['user'], $overrides['property']);

    return Tenancy::create(array_merge([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => $property->type === 'KIOSK' ? 2500000 : 1000000,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ], $overrides));
}

test('dashboard advertises the kamar water allowance from the shared service', function () {
    $tenant = makePortalTenant();
    makePortalTenancy(['user' => $tenant, 'property' => makePortalProperty('ROOM')]);

    $props = null;
    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertOk()
        ->assertInertia(function ($page) use (&$props) {
            $props = $page->toArray()['props'];
        });

    expect(data_get($props, 'waterRule.allowance_m3'))->toBe(5);
    expect(data_get($props, 'waterRule.charges_separately'))->toBeFalse();
});

test('dashboard bills kiosk PAM separately regardless of the agreed deal price', function () {
    $tenant = makePortalTenant();
    makePortalTenancy(['user' => $tenant, 'property' => makePortalProperty('KIOSK')]);

    $props = null;
    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertOk()
        ->assertInertia(function ($page) use (&$props) {
            $props = $page->toArray()['props'];
        });

    // Old buggy rule derived kioskSeparateWater from deal < normal; now immutable.
    expect(data_get($props, 'waterRule.allowance_m3'))->toBe(0);
    expect(data_get($props, 'waterRule.charges_separately'))->toBeTrue();
});

test('payments page lists only the tenant own rent billings', function () {
    $owner = makePortalTenant();
    $ownerTenancy = makePortalTenancy(['user' => $owner]);

    $sibling = makePortalTenant();
    $siblingTenancy = makePortalTenancy(['user' => $sibling]);

    Billing::create([
        'tenancy_id' => $ownerTenancy->id,
        'billing_type' => 'RENT',
        'amount' => 1000000,
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'status' => 'PENDING_PAYMENT',
    ]);

    Billing::create([
        'tenancy_id' => $siblingTenancy->id,
        'billing_type' => 'RENT',
        'amount' => 999,
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'status' => 'PENDING_PAYMENT',
    ]);

    $this->actingAs($owner)
        ->get(route('tenant.payments'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Tenant/Payments'))
        ->assertInertia(fn ($page) => $page->where('billings.0.amount', 1000000))
        ->assertInertia(fn ($page) => $page->where('billings', fn ($items) => count($items) === 1));
});

test('payments page includes PAM water charges', function () {
    $tenant = makePortalTenant();
    $tenancy = makePortalTenancy(['user' => $tenant]);

    WaterPeriod::create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $tenancy->property_id,
        'period_month' => 9,
        'period_year' => 2026,
        'meter_start' => 100,
        'meter_end' => 108,
        'usage' => 8,
        'billable_usage' => 3,
        'water_rate' => 14000,
        'total_amount' => 42000,
        'status' => 'WAITING_PAYMENT',
        'payment_status' => 'UNPAID',
        'due_date' => now()->addDays(2)->format('Y-m-d'),
    ]);

    $this->actingAs($tenant)
        ->get(route('tenant.payments'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('waterCharges.0.total_amount', 42000));
});

test('tenant without a tenancy is redirected to onboarding on every portal page', function () {
    $tenant = makePortalTenant();

    $this->actingAs($tenant)->get(route('tenant.payments'))->assertRedirect(route('tenant.onboarding'));
    $this->actingAs($tenant)->get(route('tenant.water-usage'))->assertRedirect(route('tenant.onboarding'));
    $this->actingAs($tenant)->get(route('tenant.agreement'))->assertRedirect(route('tenant.onboarding'));
});

test('water usage page uses shared allowance rule for kiosk (zero allowance)', function () {
    $tenant = makePortalTenant();
    $tenancy = makePortalTenancy(['user' => $tenant, 'property' => makePortalProperty('KIOSK')]);

    WaterPeriod::create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $tenancy->property_id,
        'period_month' => 8,
        'period_year' => 2026,
        'meter_start' => 0,
        'meter_end' => 12,
        'usage' => 12,
        'billable_usage' => 12,
        'water_rate' => 14000,
        'total_amount' => 168000,
        'status' => 'WAITING_PAYMENT',
        'payment_status' => 'UNPAID',
        'due_date' => now()->addDays(2)->format('Y-m-d'),
    ]);

    $this->actingAs($tenant)
        ->get(route('tenant.water-usage'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('waterRule.allowance_m3', 0))
        ->assertInertia(fn ($page) => $page->where('periods.0.billable_usage', 12));
});

test('tenant can only download their own uploaded agreement document', function () {
    $owner = makePortalTenant();
    $ownerTenancy = makePortalTenancy(['user' => $owner]);
    $sibling = makePortalTenant();
    $siblingTenancy = makePortalTenancy(['user' => $sibling]);

    Storage::fake('local');
    $path = 'agreements_scans/owner.pdf';
    Storage::disk('local')->put($path, 'dummy');

    Agreement::create([
        'tenancy_id' => $ownerTenancy->id,
        'status' => 'SIGNED',
        'signed_at' => now(),
        'uploaded_document_path' => $path,
        'uploaded_document_type' => 'application/pdf',
    ]);

    $this->actingAs($owner)
        ->get(route('tenant.agreement.download'))
        ->assertOk();

    $this->actingAs($sibling)
        ->get(route('tenant.agreement.download'))
        ->assertNotFound();
});

test('tenant can only view their own water meter photos', function () {
    $owner = makePortalTenant();
    $ownerTenancy = makePortalTenancy(['user' => $owner]);
    $sibling = makePortalTenant();
    $siblingTenancy = makePortalTenancy(['user' => $sibling]);

    Storage::fake('local');
    $path = 'water_periods/1/start.jpg';
    Storage::disk('local')->put($path, 'binary');

    $period = WaterPeriod::create([
        'tenancy_id' => $ownerTenancy->id,
        'property_id' => $ownerTenancy->property_id,
        'period_month' => 7,
        'period_year' => 2026,
        'meter_start' => 5,
        'meter_start_photo' => $path,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
    ]);

    $this->actingAs($owner)
        ->get(route('tenant.water.period.photo', [$period->id, 'start']))
        ->assertOk();

    $this->actingAs($sibling)
        ->get(route('tenant.water.period.photo', [$period->id, 'start']))
        ->assertForbidden();
});

test('agreement page shows the signed statement, signatures and move-in photos', function () {
    $tenant = makePortalTenant();
    $tenancy = makePortalTenancy(['user' => $tenant]);

    $agreement = Agreement::create([
        'tenancy_id' => $tenancy->id,
        'status' => 'SIGNED',
        'signed_at' => now(),
        'document_html' => '<p>Surat Pernyataan Contoh</p>',
    ]);

    AgreementSignature::create([
        'agreement_id' => $agreement->id,
        'occupant_type' => 'OCCUPANT_1',
        'signature_image' => 'data:image/png;base64,abc',
        'paraf_image' => 'data:image/png;base64,def',
    ]);

    $this->actingAs($tenant)
        ->get(route('tenant.agreement'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Tenant/Agreement'))
        ->assertInertia(fn ($page) => $page->where('agreement.status', 'SIGNED'))
        ->assertInertia(fn ($page) => $page->where('signatures.0.occupant_type', 'OCCUPANT_1'));
});

test('tenant can submit a payment proof for their own billing', function () {
    Storage::fake('local');

    $tenant = makePortalTenant();
    $tenancy = makePortalTenancy(['user' => $tenant]);

    $billing = Billing::create([
        'tenancy_id' => $tenancy->id,
        'billing_type' => 'RENT',
        'amount' => 1000000,
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'status' => 'PENDING_PAYMENT',
    ]);

    $this->actingAs($tenant)
        ->post(route('tenant.payments.proof', $billing->id), [
            'amount_claimed' => 1000000,
            'receipt_image' => fakeJpegUpload(),
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('payment_proofs', [
        'billing_id' => $billing->id,
        'uploaded_by' => $tenant->id,
        'status' => 'PENDING',
    ]);

    expect($billing->fresh()->status)->toBe('PENDING_VERIFICATION');
});

test('tenant cannot submit a payment proof for another tenant billing', function () {
    Storage::fake('local');

    $tenant = makePortalTenant();
    $sibling = makePortalTenant();
    $siblingTenancy = makePortalTenancy(['user' => $sibling]);

    $billing = Billing::create([
        'tenancy_id' => $siblingTenancy->id,
        'billing_type' => 'RENT',
        'amount' => 1000000,
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'status' => 'PENDING_PAYMENT',
    ]);

    $this->actingAs($tenant)
        ->post(route('tenant.payments.proof', $billing->id), [
            'amount_claimed' => 1000000,
            'receipt_image' => fakeJpegUpload(),
        ])
        ->assertForbidden();

    $this->assertDatabaseMissing('payment_proofs', [
        'billing_id' => $billing->id,
    ]);
});