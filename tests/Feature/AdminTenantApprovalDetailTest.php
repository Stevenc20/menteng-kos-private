<?php

use App\Models\Property;
use App\Models\RoomDocumentation;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterMeter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

function makeApprovalUser(array $overrides = []): User
{
    return User::factory()->create(array_merge(['role' => 'TENANT'], $overrides));
}

function makeApprovalProperty(array $overrides = []): Property
{
    return Property::create(array_merge([
        'name' => 'Kamar Approval',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
    ], $overrides));
}

function makeApprovalTenancy(array $overrides = []): Tenancy
{
    $user = $overrides['user'] ?? makeApprovalUser();
    $property = $overrides['property'] ?? makeApprovalProperty();
    unset($overrides['user'], $overrides['property']);

    return Tenancy::create(array_merge([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->addDays(3)->format('Y-m-d'),
        'status' => 'PENDING_ADMIN_APPROVAL',
        'approval_status' => 'PENDING',
    ], $overrides));
}

function approvalPage(TestResponse $response): array
{
    $props = null;
    $response->assertInertia(function ($page) use (&$props) {
        $props = $page->toArray()['props'];
    });

    return $props;
}

test('admin can open approval detail even when no profile, documentation or water meter exists', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy();

    $response = $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}");
    $response->assertOk();

    $props = approvalPage($response);
    expect($props['profile'])->toBeNull();
    expect($props['moveInDoc'])->toBeNull();
    expect($props['waterMeter'])->toBeNull();
    expect($props['signatures'])->toBe([]);
});

test('admin can open approval detail with move-in documentation present', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy();

    RoomDocumentation::create([
        'property_id' => $tenancy->property_id,
        'tenancy_id' => $tenancy->id,
        'documentation_type' => 'MOVE_IN',
        'documentation_date' => now()->format('Y-m-d'),
        'notes' => 'Kondisi kamar baik',
        'created_by' => $admin->id,
    ]);

    $response = $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}");
    $response->assertOk();

    $props = approvalPage($response);
    expect($props['moveInDoc'])->not->toBeNull();
    expect($props['moveInDoc']['documentation_type'])->toBe('MOVE_IN');
    expect($props['moveInDoc']['notes'])->toBe('Kondisi kamar baik');
});

test('admin can open approval detail with start water meter present', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy();

    WaterMeter::create([
        'tenancy_id' => $tenancy->id,
        'period_month' => (int) now()->format('m'),
        'period_year' => (int) now()->format('Y'),
        'previous_meter' => 0,
        'current_meter' => 1234,
        'photo' => 'private/water_meters/start.jpg',
        'excess_usage_charge' => 0,
    ]);

    $response = $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}");
    $response->assertOk();

    $props = approvalPage($response);
    expect($props['waterMeter'])->not->toBeNull();
    expect($props['waterMeter']['current_meter'])->toBe(1234);
});

test('guests are redirected to login when opening approval detail', function () {
    $tenancy = makeApprovalTenancy();

    $this->get("/admin/tenants/{$tenancy->id}")
        ->assertRedirect(route('login'));
});

test('non-admin users get 403 on approval detail', function () {
    $tenant = makeApprovalUser();
    $tenancy = makeApprovalTenancy(['user' => $tenant]);

    $this->actingAs($tenant)->get("/admin/tenants/{$tenancy->id}")
        ->assertForbidden();
});

test('admin can open approval detail for inactive legacy tenant without related data', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy(['status' => 'ACTIVE', 'approval_status' => 'APPROVED']);

    $response = $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}");
    $response->assertOk();

    $props = approvalPage($response);
    expect($props['tenancy']['id'])->toBe($tenancy->id);
    expect($props['moveInDoc'])->toBeNull();
});

test('admin review of a stale pending tenant shows effective move-in date and due day', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy([
        'move_in_date' => '2026-08-06',
        'status' => 'PENDING_ADMIN_APPROVAL',
    ]);

    // Tenant signed the agreement today -> that is the source-of-truth submission date.
    \App\Models\Agreement::create([
        'tenancy_id' => $tenancy->id,
        'document_html' => '<p>Surat</p>',
        'status' => 'SIGNED',
        'signed_at' => now(),
    ]);

    $props = approvalPage($this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}")->assertOk());

    expect($props['moveInDateIsStale'])->toBeTrue();
    expect($props['effectiveMoveInDate'])->toBe(now()->toDateString());
    expect($props['dueDayLabel'])->toBe('8');
    expect($props['dueDayNumber'])->toBe(8);
});

test('admin review NEVER corrects an ACTIVE tenancy move-in date even if stale', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy([
        'move_in_date' => '2026-08-06',
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);

    $props = approvalPage($this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}")->assertOk());

    expect($props['moveInDateIsStale'])->toBeFalse();
    expect($props['effectiveMoveInDate'])->toBe('2026-08-06');
});

test('admin review always shows future move-in date as-is', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $future = now()->addMonths(1)->toDateString();
    $tenancy = makeApprovalTenancy([
        'move_in_date' => $future,
        'status' => 'PENDING_ADMIN_APPROVAL',
    ]);

    $props = approvalPage($this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}")->assertOk());

    expect($props['moveInDateIsStale'])->toBeFalse();
    expect($props['effectiveMoveInDate'])->toBe($future);
});

test('approving a tenant with a stale move-in date updates it to today', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy(['move_in_date' => '2026-08-06']);

    $this->actingAs($admin)->post("/admin/tenants/{$tenancy->id}/approve");

    $tenancy->refresh();
    expect($tenancy->status)->toBe('ACTIVE');
    expect($tenancy->move_in_date)->toBe(now()->toDateString());
    expect($tenancy->move_in_date)->not->toBe('2026-08-06');
});

test('approving a tenant keeps a future move-in date', function () {
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $future = now()->addMonths(1)->toDateString();
    $tenancy = makeApprovalTenancy(['move_in_date' => $future]);

    $this->actingAs($admin)->post("/admin/tenants/{$tenancy->id}/approve");

    $tenancy->refresh();
    expect($tenancy->status)->toBe('ACTIVE');
    expect($tenancy->move_in_date)->toBe($future);
});

test('two occupants: both KTP photos reach admin review props', function () {
    Storage::fake('local');
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy();

    Storage::disk('local')->put('ktp/1.jpg', 'a');
    Storage::disk('local')->put('ktp/2.jpg', 'b');

    \App\Models\TenantProfile::create([
        'user_id' => $tenancy->user_id,
        'ktp_1_name' => 'PENGHUNI SATU',
        'ktp_2_name' => 'PENGHUNI DUA',
        'ktp_1_photo' => 'ktp/1.jpg',
        'ktp_2_photo' => 'ktp/2.jpg',
    ]);

    $props = approvalPage($this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}")->assertOk());
    expect($props['profile']['ktp_1_photo'])->toBe('ktp/1.jpg');
    expect($props['profile']['ktp_2_photo'])->toBe('ktp/2.jpg');
});

test('admin can download a tenant KTP photo', function () {
    Storage::fake('local');
    $admin = makeApprovalUser(['role' => 'ADMIN']);
    $tenancy = makeApprovalTenancy();

    Storage::disk('local')->put('private/ktp/ktp1.jpg', 'fakepng');
    \App\Models\TenantProfile::create([
        'user_id' => $tenancy->user_id,
        'ktp_1_photo' => 'private/ktp/ktp1.jpg',
    ]);

    $response = $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}/ktp/1/download");
    $response->assertOk();
    expect($response->headers->get('content-disposition'))->toContain('KTP_Penghuni_1');
});

test('non-admin cannot download tenant KTP photo', function () {
    Storage::fake('local');
    $tenant = makeApprovalUser();
    $tenancy = makeApprovalTenancy(['user' => $tenant]);

    $this->actingAs($tenant)->get("/admin/tenants/{$tenancy->id}/ktp/1/download")
        ->assertForbidden();
});

test('app uses Asia/Jakarta timezone so submission dates do not shift a day', function () {
    expect(config('app.timezone'))->toBe('Asia/Jakarta');

    // 9 Sep 2026 00:30 WIB must stay 9 Sep (never become 8 Sep from a UTC shift).
    $submittedEarlyMorning = \Illuminate\Support\Carbon::parse('2026-09-09 00:30:00', 'Asia/Jakarta');
    expect($submittedEarlyMorning->toDateString())->toBe('2026-09-09');
    expect($submittedEarlyMorning->copy()->utc()->toDateString())->toBe('2026-09-08');
});

test('submitting agreement persists the actual move-in date used by the tenant', function () {
    $tenant = makeApprovalUser();
    $tenancy = makeApprovalTenancy(['user' => $tenant, 'move_in_date' => '2026-07-01']);

    $this->actingAs($tenant)->post('/tenant/onboarding/agreement', [
        'document_html' => '<p>Surat</p>',
        'signature_1' => 'data:image/png;base64,AAA=',
        'paraf_1' => 'data:image/png;base64,AAA=',
        'move_in_date' => '2026-09-09',
    ])->assertRedirect(route('tenant.onboarding'));

    $tenancy->refresh();
    expect($tenancy->status)->toBe('PENDING_ADMIN_APPROVAL');
    expect($tenancy->move_in_date)->toBe('2026-09-09');
});