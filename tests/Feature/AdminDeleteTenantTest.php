<?php

use App\Models\Agreement;
use App\Models\Billing;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\User;
use App\Models\WaterMeter;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function admin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function occupiedKioskUser(): User
{
    $user = User::factory()->create(['role' => 'TENANT']);
    TenantProfile::create(['user_id' => $user->id, 'whatsapp' => '081234']);
    $property = Property::create(['name' => 'Kios A', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'OCCUPIED']);
    $tenancy = Tenancy::create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1700000,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);
    Agreement::create(['tenancy_id' => $tenancy->id, 'document_html' => '<p>x</p>', 'status' => 'SIGNED']);
    Billing::create([
        'tenancy_id' => $tenancy->id,
        'billing_type' => 'RENT',
        'amount' => 1700000,
        'due_date' => now()->addDays(5)->format('Y-m-d'),
    ]);
    WaterMeter::create([
        'tenancy_id' => $tenancy->id,
        'period_month' => now()->month,
        'period_year' => now()->year,
        'previous_meter' => 0,
        'current_meter' => 12,
        'photo' => 'x.jpg',
    ]);
    return $user;
}

test('admin can delete a tenant account and property frees up', function () {
    $user = occupiedKioskUser();
    $tenancy = Tenancy::where('user_id', $user->id)->first();
    $property = Property::where('status', 'OCCUPIED')->first();
    $this->actingAs(admin());

    $response = $this->delete(route('admin.tenants.destroy', $tenancy->id));
    $response->assertRedirect(route('admin.tenants'));

    expect(Tenancy::find($tenancy->id))->toBeNull();
    expect(User::find($user->id))->toBeNull();
    expect(TenantProfile::where('user_id', $user->id)->count())->toBe(0);
    expect(Agreement::where('tenancy_id', $tenancy->id)->count())->toBe(0);
    expect(Billing::where('tenancy_id', $tenancy->id)->count())->toBe(0);
    expect(WaterMeter::where('tenancy_id', $tenancy->id)->count())->toBe(0);
    expect($property->fresh()->status)->toBe('AVAILABLE');
});

test('admin delete on missing tenancy returns 404', function () {
    $this->actingAs(admin());
    $this->delete(route('admin.tenants.destroy', 999))->assertNotFound();
});
