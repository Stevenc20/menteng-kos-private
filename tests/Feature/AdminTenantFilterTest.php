<?php

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

function makeTestUser(array $overrides = []): User
{
    return User::factory()->create(array_merge(['role' => 'TENANT'], $overrides));
}

function makeTestProperty(array $overrides = []): Property
{
    return Property::create(array_merge([
        'name' => 'Kamar Test',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
    ], $overrides));
}

function makeTestTenancy(array $overrides = []): Tenancy
{
    $user = $overrides['user'] ?? makeTestUser();
    $property = $overrides['property'] ?? makeTestProperty();

    return Tenancy::create(array_merge([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->addDays(3)->format('Y-m-d'),
        'status' => 'PENDING_ADMIN_APPROVAL',
        'approval_status' => 'PENDING',
    ], $overrides));
}

function mediaPage(TestResponse $response): array
{
    $props = null;
    $response->assertInertia(function ($page) use (&$props) {
        $props = $page->toArray()['props'];
    });

    return $props;
}

test('guests cannot access the admin tenants page', function () {
    $this->get('/admin/tenants')->assertRedirect(route('login'));
});

test('non-admin users get 403 on the admin tenants page', function () {
    $user = makeTestUser();

    $this->actingAs($user)->get('/admin/tenants')->assertForbidden();
});

test('menunggu approval filter returns submitted tenancies still pending review', function () {
    $admin = User::factory()->create(['role' => 'ADMIN']);

    $pendingCurrent = makeTestTenancy(['status' => 'PENDING_ADMIN_APPROVAL']);
    $pendingLegacy = makeTestTenancy(['status' => 'AGREEMENT_SUBMITTED']);
    $rejected = makeTestTenancy([
        'status' => 'PENDING_ADMIN_APPROVAL',
        'approval_status' => 'REJECTED',
    ]);
    makeTestTenancy(['status' => 'ACTIVE', 'approval_status' => 'APPROVED']);

    $props = mediaPage($this->actingAs($admin)->get('/admin/tenants?status=pending')->assertOk());

    $ids = array_column($props['tenancies'], 'id');

    expect($props['activeFilter'])->toBe('pending');
    expect($ids)->toHaveCount(2)
        ->toContain($pendingCurrent->id)
        ->toContain($pendingLegacy->id)
        ->not->toContain($rejected->id);
    expect(array_column($props['tenancies'], 'approval_status'))->each->toBe('PENDING');
    expect($props['counts'])
        ->pending->toBe(2)
        ->rejected->toBe(1)
        ->active->toBe(1);
});

test('aktif filter returns only active tenancies', function () {
    $admin = User::factory()->create(['role' => 'ADMIN']);

    $active = makeTestTenancy(['status' => 'ACTIVE', 'approval_status' => 'APPROVED']);
    makeTestTenancy(['status' => 'PENDING_ADMIN_APPROVAL']);

    $props = mediaPage($this->actingAs($admin)->get('/admin/tenants?status=active')->assertOk());

    $ids = array_column($props['tenancies'], 'id');

    expect($props['activeFilter'])->toBe('active');
    expect($ids)->toContain($active->id);
    expect($props['counts']['active'])->toBe(1);
});

test('perlu perbaikan filter returns only rejected tenancies', function () {
    $admin = User::factory()->create(['role' => 'ADMIN']);

    $rejected = makeTestTenancy([
        'status' => 'PENDING_ADMIN_APPROVAL',
        'approval_status' => 'REJECTED',
    ]);
    makeTestTenancy(['status' => 'PENDING_ADMIN_APPROVAL']);

    $props = mediaPage($this->actingAs($admin)->get('/admin/tenants?status=rejected')->assertOk());

    $ids = array_column($props['tenancies'], 'id');

    expect($props['activeFilter'])->toBe('rejected');
    expect($ids)->toContain($rejected->id);
    expect($props['counts']['rejected'])->toBe(1);
});

test('filter default menampilkan semua tenan', function () {
    $admin = User::factory()->create(['role' => 'ADMIN']);

    makeTestTenancy(['status' => 'PENDING_ADMIN_APPROVAL']);
    makeTestTenancy(['status' => 'ACTIVE', 'approval_status' => 'APPROVED']);
    makeTestTenancy(['status' => 'INVITED']);

    $props = mediaPage($this->actingAs($admin)->get('/admin/tenants')->assertOk());

    expect($props['activeFilter'])->toBe('all');
    expect($props['tenancies'])->toHaveCount(3);
});