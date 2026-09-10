<?php

use App\Models\Agreement;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function adminDrivenAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function adminDrivenTenancy(array $overrides = []): Tenancy
{
    $user = $overrides['user'] ?? User::factory()->create(['role' => 'TENANT']);
    $property = $overrides['property'] ?? Property::create([
        'name' => 'Unit Admin Driven',
        'type' => 'ROOM',
        'normal_price' => 1200000,
        'status' => 'AVAILABLE',
    ]);
    unset($overrides['user'], $overrides['property']);

    return Tenancy::create(array_merge([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->addDays(5)->format('Y-m-d'),
        'status' => 'INVITED',
    ], $overrides));
}

test('inviting a tenant continues straight into the admin onboarding wizard', function () {
    $admin = adminDrivenAdmin();
    $property = Property::create([
        'name' => 'Unit Invite',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
    ]);

    $response = $this->actingAs($admin)->post('/admin/tenants/invite', [
        'email' => 'newtenant@example.com',
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->addDays(5)->format('Y-m-d'),
    ]);

    $tenancy = Tenancy::where('property_id', $property->id)->first();
    expect($tenancy)->not->toBeNull();
    expect($tenancy->status)->toBe('INVITED');

    $response->assertRedirect(route('admin.tenants.onboarding', $tenancy));
});

test('admin can open the onboarding wizard for an invited tenant', function () {
    $admin = adminDrivenAdmin();
    $tenancy = adminDrivenTenancy();

    $this->actingAs($admin)
        ->get("/admin/tenants/{$tenancy->id}/onboarding")
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Admin/TenantOnboarding'));
});

test('admin info submission binds owner data to the target tenant, never the admin', function () {
    $admin = adminDrivenAdmin();
    $tenant = User::factory()->create(['role' => 'TENANT']);
    $tenancy = adminDrivenTenancy(['user' => $tenant]);

    $this->actingAs($admin)->post("/admin/tenants/{$tenancy->id}/onboarding/info", [
        'whatsapp' => '0812',
        'ktp_1_name' => 'Budi',
        'ktp_1_nik' => '3201110203920001',
        'ktp_1_birth_place' => 'Jakarta',
        'ktp_1_birth_date' => '1990-01-01',
        'ktp_1_job' => 'Karyawan',
        'ktp_1_address' => 'Jl. Test',
        'has_second_occupant' => false,
    ])->assertSessionHasNoErrors();

    $profile = TenantProfile::where('user_id', $tenant->id)->first();
    expect($profile)->not->toBeNull();
    expect($profile->ktp_1_name)->toBe('Budi');
    expect($profile->ktp_1_nik)->toBe('3201110203920001');

    // The admin itself must never receive owner data.
    expect(TenantProfile::where('user_id', $admin->id)->count())->toBe(0);

    $tenancy->refresh();
    expect($tenancy->status)->toBe('AGREEMENT_PENDING');
});

test('admin signing the agreement activates the tenancy immediately', function () {
    $admin = adminDrivenAdmin();
    $tenant = User::factory()->create(['role' => 'TENANT']);
    $tenancy = adminDrivenTenancy(['user' => $tenant]);

    $this->actingAs($admin)->post("/admin/tenants/{$tenancy->id}/onboarding/agreement", [
        'document_html' => '<p>Surat</p>',
        'signature_1' => 'data:image/png;base64,AAA=',
        'paraf_1' => 'data:image/png;base64,AAA=',
        'move_in_date' => now()->addDays(3)->format('Y-m-d'),
    ])->assertRedirect(route('admin.tenants'));

    $tenancy->refresh();
    expect($tenancy->status)->toBe('ACTIVE');
    expect($tenancy->approval_status)->toBe('APPROVED');
    expect($tenancy->approved_by)->toBe($admin->id);
    expect($tenancy->move_in_date)->toBe(now()->addDays(3)->format('Y-m-d'));

    expect(Property::find($tenancy->property_id)->status)->toBe('OCCUPIED');
    expect(Agreement::where('tenancy_id', $tenancy->id)->count())->toBe(1);
});

test('the invited tenant goes straight to the dashboard once logged in', function () {
    $tenant = User::factory()->create(['role' => 'TENANT']);
    adminDrivenTenancy(['user' => $tenant]);

    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Tenant/Dashboard'));
});

test('the admin onboarding routes reject a tenancy whose owner is not a tenant', function () {
    $admin = adminDrivenAdmin();
    $notTenant = User::factory()->create(['role' => 'ADMIN']);
    $tenancy = adminDrivenTenancy(['user' => $notTenant]);

    $this->actingAs($admin)
        ->get("/admin/tenants/{$tenancy->id}/onboarding/profile")
        ->assertForbidden();
});