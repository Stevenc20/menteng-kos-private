<?php

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use App\Services\WaterBillingService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeWaterTenancy(Property $property, float $agreed): Tenancy
{
    return Tenancy::create([
        'user_id' => User::factory()->create()->id,
        'property_id' => $property->id,
        'agreed_price' => $agreed,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);
}

test('ROOM billing keeps the included 5m3 allowance', function () {
    $property = Property::create(['name' => 'Kamar', 'type' => 'ROOM', 'normal_price' => 1500000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 1500000);

    expect(WaterBillingService::chargesWaterSeparately($tenancy))->toBeFalse();
    expect(WaterBillingService::billableUsage($tenancy, 10))->toBe(5);
    expect(WaterBillingService::chargeFor($tenancy, 10))->toBe(5 * 14000);
});

test('KIOSK at standard price keeps the included 5m3 allowance', function () {
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 2000000);

    expect(WaterBillingService::chargesWaterSeparately($tenancy))->toBeFalse();
    expect(WaterBillingService::billableUsage($tenancy, 10))->toBe(5);
    expect(WaterBillingService::chargeFor($tenancy, 10))->toBe(5 * 14000);
});

test('KIOSK with negotiated deal below the standard price charges PAM separately (full usage)', function () {
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    // Deal price 1.700.000 < standard 2.000.000 -> water charged separately.
    $tenancy = makeWaterTenancy($property, 1700000);

    expect(WaterBillingService::chargesWaterSeparately($tenancy))->toBeTrue();
    // No allowance: the full 10 m3 is billed.
    expect(WaterBillingService::billableUsage($tenancy, 10))->toBe(10);
    expect(WaterBillingService::chargeFor($tenancy, 10))->toBe(10 * 14000);
});

test('kiosk case 5 m3: deal 1.700.000 + PAM 5m3 => 1.770.000', function () {
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 1700000);

    $rent = (int) $tenancy->agreed_price;
    $water = WaterBillingService::chargeFor($tenancy, 5);
    expect($water)->toBe(5 * 14000); // 70.000
    expect($rent + $water)->toBe(1770000);
});

test('kiosk case 12 m3: deal 1.700.000 + PAM 12m3 => 1.868.000', function () {
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 1700000);

    $rent = (int) $tenancy->agreed_price;
    $water = WaterBillingService::chargeFor($tenancy, 12);
    expect($water)->toBe(12 * 14000); // 168.000
    expect($rent + $water)->toBe(1868000);
});

test('water rate is a single source of truth (14000 per m3)', function () {
    expect(WaterBillingService::WATER_RATE_PER_M3)->toBe(14000);
    expect(WaterBillingService::WATER_ALLOWANCE_M3)->toBe(5);
});

test('negative usage cannot produce a negative charge', function () {
    $property = Property::create(['name' => 'Kamar', 'type' => 'ROOM', 'normal_price' => 1500000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 1500000);

    expect(WaterBillingService::chargeFor($tenancy, -5))->toBe(0);
    expect(WaterBillingService::billableUsage($tenancy, -5))->toBe(0);
});
