<?php

use App\Models\Property;
use App\Models\RoomDocumentation;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterMeter;
use Illuminate\Foundation\Testing\RefreshDatabase;
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