<?php

use App\Models\Billing;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeDashboardTenant(array $overrides = []): User
{
    return User::factory()->create(array_merge(['role' => 'TENANT'], $overrides));
}

function makeDashboardTenancy(array $overrides = []): Tenancy
{
    $user = $overrides['user'] ?? makeDashboardTenant();
    $property = \App\Models\Property::create([
        'name' => 'Kamar Dashboard',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'OCCUPIED',
    ]);
    unset($overrides['user'], $overrides['property']);

    return Tenancy::create(array_merge([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ], $overrides));
}

test('an approved active tenant can open the dashboard', function () {
    $tenant = makeDashboardTenant();
    $tenancy = makeDashboardTenancy(['user' => $tenant]);

    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Tenant/Dashboard'));
});

test('the tenant dashboard renders the next rent billing', function () {
    $tenant = makeDashboardTenant();
    $tenancy = makeDashboardTenancy(['user' => $tenant]);

    Billing::create([
        'tenancy_id' => $tenancy->id,
        'billing_type' => 'RENT',
        'due_date' => now()->addMonth()->format('Y-m-d'),
        'amount' => 1000000,
        'status' => 'PENDING_PAYMENT',
    ]);

    $props = null;
    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertOk()
        ->assertInertia(function ($page) use (&$props) {
            $props = $page->toArray()['props'];
        });

    expect(data_get($props, 'tenancy.id'))->toBe($tenancy->id);
    expect(data_get($props, 'nextBilling.billing_type'))->toBe('RENT');
    expect(data_get($props, 'nextBilling.status'))->toBe('PENDING_PAYMENT');
});

test('a tenant awaiting approval cannot open the dashboard and is sent to onboarding', function () {
    $tenant = makeDashboardTenant();

    makeDashboardTenancy([
        'user' => $tenant,
        'status' => 'PENDING_ADMIN_APPROVAL',
        'approval_status' => 'PENDING',
    ]);

    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertRedirect(route('tenant.onboarding'));
});

test('a tenant without any tenancy is sent to onboarding', function () {
    $tenant = makeDashboardTenant();

    $this->actingAs($tenant)
        ->get(route('tenant.dashboard'))
        ->assertRedirect(route('tenant.onboarding'));
});
