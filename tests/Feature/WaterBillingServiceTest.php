<?php

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterPeriod;
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

test('KIOSK always bills water separately, even at the standard price', function () {
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 2000000);

    expect(WaterBillingService::chargesWaterSeparately($tenancy))->toBeTrue();
    // No allowance for any KIOSK: the full 10 m3 is billed.
    expect(WaterBillingService::billableUsage($tenancy, 10))->toBe(10);
    expect(WaterBillingService::chargeFor($tenancy, 10))->toBe(10 * 14000);
});

test('KIOSK with negotiated deal below the standard price charges PAM separately (full usage)', function () {
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 1700000);

    expect(WaterBillingService::chargesWaterSeparately($tenancy))->toBeTrue();
    // No allowance: the full 10 m3 is billed.
    expect(WaterBillingService::billableUsage($tenancy, 10))->toBe(10);
    expect(WaterBillingService::chargeFor($tenancy, 10))->toBe(10 * 14000);

    // The rule is type-based, NOT price-based.
    expect(WaterBillingService::allowanceForType('KIOSK'))->toBe(0);
    expect(WaterBillingService::allowanceForType('ROOM'))->toBe(5);
    expect(WaterBillingService::allowanceForType(null))->toBe(5);
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

test('allowanceM3 exposes the included allowance: 5 m3 for room, 0 for every kiosk', function () {
    $room = Property::create(['name' => 'Kamar', 'type' => 'ROOM', 'normal_price' => 1500000, 'status' => 'AVAILABLE']);
    $roomTenancy = makeWaterTenancy($room, 1500000);
    expect(WaterBillingService::allowanceM3($roomTenancy))->toBe(5);

    $kioskStd = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $stdTenancy = makeWaterTenancy($kioskStd, 2000000);
    expect(WaterBillingService::allowanceM3($stdTenancy))->toBe(0);

    $kioskDeal = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $dealTenancy = makeWaterTenancy($kioskDeal, 1700000);
    expect(WaterBillingService::allowanceM3($dealTenancy))->toBe(0);
    expect(WaterBillingService::billableUsage($dealTenancy, 7))->toBe(7);
});

test('allowanceForPeriod honours the per-period override before the type rule', function () {
    $property = Property::create(['name' => 'Kamar', 'type' => 'ROOM', 'normal_price' => 1500000, 'status' => 'AVAILABLE']);
    $tenancy = makeWaterTenancy($property, 1500000);

    $carryOver = WaterPeriod::create([
        'property_id' => $property->id,
        'tenancy_id' => $tenancy->id,
        'tenant_id' => $tenancy->user_id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
        'meter_start' => 100,
        'allowance' => 2,
    ]);

    // The remaining quota (2 m³) wins over the normal 5 m³ for this period.
    expect(WaterBillingService::allowanceForPeriod($carryOver))->toBe(2);
    expect(WaterBillingService::billableUsageForPeriod($carryOver, 3))->toBe(1);
    expect(WaterBillingService::billableUsageForPeriod($carryOver, 2))->toBe(0);

    $normal = WaterPeriod::create([
        'property_id' => $property->id,
        'tenancy_id' => $tenancy->id,
        'tenant_id' => $tenancy->user_id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
        'meter_start' => 106,
    ]);

    // No override -> falls back to the normal room rule (5 m³).
    expect(WaterBillingService::allowanceForPeriod($normal))->toBe(5);

    $kiosk = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'AVAILABLE']);
    $kioskTenancy = makeWaterTenancy($kiosk, 2000000);
    $kioskPeriod = WaterPeriod::create([
        'property_id' => $kiosk->id,
        'tenancy_id' => $kioskTenancy->id,
        'tenant_id' => $kioskTenancy->user_id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
        'meter_start' => 50,
    ]);

    // Without an override a KIOSK stays at 0 allowance.
    expect(WaterBillingService::allowanceForPeriod($kioskPeriod))->toBe(0);
});
