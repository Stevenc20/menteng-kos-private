<?php

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makePublicProperty(array $overrides = []): Property
{
    return Property::create(array_merge([
        'name' => 'Kamar Uji',
        'type' => 'ROOM',
        'normal_price' => 1700000,
        'status' => 'AVAILABLE',
    ], $overrides));
}

function propertyProps($response): array
{
    $props = null;
    $response->assertInertia(function ($page) use (&$props) {
        $props = $page->toArray()['props'];
    });
    return $props;
}

test('home page shows the price for an AVAILABLE property', function () {
    makePublicProperty(['name' => 'Unit Tersedia', 'normal_price' => 1750000, 'status' => 'AVAILABLE']);

    $props = propertyProps($this->get('/')->assertOk());
    $found = collect($props['properties'])->first(fn ($p) => $p['name'] === 'Unit Tersedia');
    expect($found)->not->toBeNull();
    expect((float) $found['normal_price'])->toBe(1750000.0);
});

test('home page keeps showing the price for an OCCUPIED property', function () {
    makePublicProperty(['name' => 'Unit Terisi', 'normal_price' => 2000000, 'status' => 'OCCUPIED']);

    $props = propertyProps($this->get('/')->assertOk());
    $found = collect($props['properties'])->first(fn ($p) => $p['name'] === 'Unit Terisi');
    expect($found)->not->toBeNull();
    expect($found['status'])->toBe('OCCUPIED');
    expect((float) $found['normal_price'])->toBe(2000000.0);
});

test('property detail page loads for an OCCUPIED property and keeps the price', function () {
    $property = makePublicProperty(['name' => 'Unit Terisi Detail', 'normal_price' => 1700000, 'status' => 'OCCUPIED']);

    $props = propertyProps($this->get("/kamar/{$property->id}")->assertOk());
    expect($props['property']['status'])->toBe('OCCUPIED');
    expect((float) $props['property']['normal_price'])->toBe(1700000.0);
});

test('an OCCUPIED property detail page remains reachable (200) so the survey flow is not blocked server-side', function () {
    $property = makePublicProperty(['name' => 'Unit X', 'normal_price' => 2200000, 'status' => 'OCCUPIED']);

    $this->get("/kamar/{$property->id}")->assertOk();
});
