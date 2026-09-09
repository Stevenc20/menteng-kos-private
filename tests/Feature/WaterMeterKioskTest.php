<?php

use App\Models\Billing;
use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterMeter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function makeWaterAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function kioskWaterTenancy(Property $property, float $agreed): Tenancy
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

function realPngUpload(string $name): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    $path = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($path, $png);
    return new UploadedFile($path, $name, 'image/png', null, true);
}

test('admin stores a KIOSK separate-water reading that bills the full usage', function () {
    Storage::fake('local');
    $admin = makeWaterAdmin();
    $property = Property::create(['name' => 'Kios', 'type' => 'KIOSK', 'normal_price' => 2000000, 'status' => 'OCCUPIED']);
    $tenancy = kioskWaterTenancy($property, 1700000);

    // Initial meter reading of 100
    WaterMeter::create([
        'tenancy_id' => $tenancy->id,
        'period_month' => 8,
        'period_year' => 2026,
        'previous_meter' => 0,
        'current_meter' => 100,
        'photo' => 'private/water_meters/start.jpg',
        'excess_usage_charge' => 0,
    ]);

    // Next reading 110 -> usage 10 m3, KIOSK separately => 10 x 14000 = 140.000
    $this->actingAs($admin)->post(route('admin.waterMeter.store', $tenancy->id), [
        'period_month' => 9,
        'period_year' => 2026,
        'current_meter' => 110,
        'photo' => realPngUpload('meter.jpg'),
    ])->assertRedirect();

    $meter = WaterMeter::where('tenancy_id', $tenancy->id)->orderBy('id', 'desc')->first();
    expect($meter->previous_meter)->toBe(100);
    expect($meter->current_meter)->toBe(110);
    expect((float) $meter->excess_usage_charge)->toBe(140000.0);

    // It should ride on the next RENT billing as excess_water_charge.
    $billing = Billing::where('tenancy_id', $tenancy->id)->where('billing_type', 'RENT')->first();
    expect($billing)->not->toBeNull();
    expect((float) $billing->excess_water_charge)->toBe(140000.0);
});

test('water meter rejects a current reading lower than the previous reading', function () {
    Storage::fake('local');
    $admin = makeWaterAdmin();
    $property = Property::create(['name' => 'Kamar', 'type' => 'ROOM', 'normal_price' => 1500000, 'status' => 'OCCUPIED']);
    $tenancy = kioskWaterTenancy($property, 1500000);

    WaterMeter::create([
        'tenancy_id' => $tenancy->id,
        'period_month' => 8,
        'period_year' => 2026,
        'previous_meter' => 0,
        'current_meter' => 110,
        'photo' => 'private/water_meters/start.jpg',
        'excess_usage_charge' => 0,
    ]);

    $this->actingAs($admin)->post(route('admin.waterMeter.store', $tenancy->id), [
        'period_month' => 9,
        'period_year' => 2026,
        'current_meter' => 100, // < previous 110 => rejected
        'photo' => realPngUpload('meter.jpg'),
    ])->assertSessionHas('error');

    expect(WaterMeter::where('tenancy_id', $tenancy->id)->count())->toBe(1);
});
