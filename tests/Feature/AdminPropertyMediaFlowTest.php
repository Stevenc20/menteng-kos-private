<?php

use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

function flowAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function flowProperty(array $overrides = []): Property
{
    return Property::create(array_merge([
        'name' => 'Kios Foo',
        'type' => 'KIOSK',
        'normal_price' => 2000000,
        'status' => 'AVAILABLE',
    ], $overrides));
}

function flowImage(string $name): UploadedFile
{
    // Minimal valid 1x1 PNG so no GD extension is required.
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    $path = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($path, $png);

    return new UploadedFile($path, $name, 'image/png', null, true);
}

function flowMakeMedia(Property $property, int $index): PropertyMedia
{
    return PropertyMedia::create([
        'property_id' => $property->id,
        'type' => 'IMAGE',
        'original_path' => "private/properties/{$property->id}/photo{$index}.png",
        'public_path' => "properties/{$property->id}/photo{$index}.png",
        'is_cover' => $index === 1,
        'sort_order' => $index,
    ]);
}

function flowPage(TestResponse $response): array
{
    $props = null;
    $response->assertInertia(function ($page) use (&$props) {
        $props = $page->toArray()['props'];
    });

    return $props;
}

test('admin properties page loads the full media gallery (13 foto KIOS case)', function () {
    $admin = flowAdmin();
    $property = flowProperty(['name' => 'KIOS']);

    for ($i = 1; $i <= 13; $i++) {
        flowMakeMedia($property, $i);
    }

    $response = $this->actingAs($admin)->get('/admin/properties');

    $response->assertInertia(fn ($page) => $page
        ->component('Admin/Properties')
        ->has('properties', 1)
        ->where('properties.0.name', 'KIOS')
        ->where('properties.0.media', fn (mixed $media) => count($media) === 13)
        ->where('properties.0.media.0.url', fn (mixed $url) => is_string($url) && str_contains($url, '/storage/'))
        ->where('properties.0.media.0.is_cover', true));
});

test('admin media count matches database count for the same property', function () {
    $admin = flowAdmin();
    $property = flowProperty();

    for ($i = 1; $i <= 7; $i++) {
        flowMakeMedia($property, $i);
    }

    $dbCount = PropertyMedia::where('property_id', $property->id)->count();

    $props = flowPage($this->actingAs($admin)->get('/admin/properties'));

    $adminCount = count($props['properties'][0]['media'] ?? []);

    expect($adminCount)->toBe(7)
        ->toEqual($dbCount);
});

test('store property via json returns created property ready for media upload', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();

    $response = $this->actingAs($admin)->postJson('/admin/properties', [
        'name' => 'Properti Baru',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
        'description' => 'Unit baru untuk test.',
        'facilities' => ['AC (Air Conditioner)', 'WiFi Berkecepatan Tinggi'],
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure(['property' => ['id', 'name', 'media']]);

    $created = $response->json('property');

    expect($created['id'])->toBeInt()
        ->and($created['media'])->toBe([])
        ->and(Property::find($created['id']))->not->toBeNull();
});

test('new property can upload media immediately after creation', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();

    $created = $this->actingAs($admin)->postJson('/admin/properties', [
        'name' => 'Properti Baru',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
    ])->json('property');

    $media = $this->actingAs($admin)->postJson("/admin/properties/{$created['id']}/media", [
        'photos' => [flowImage('a.jpg'), flowImage('b.jpg'), flowImage('c.jpg')],
    ])->assertOk()->json('media');

    expect($media)->toHaveCount(3);

    // All rows carry the correct property_id
    expect(PropertyMedia::where('property_id', $created['id'])->count())->toBe(3);

    // Admin list now shows the media
    $props = flowPage($this->actingAs($admin)->get('/admin/properties'));
    $prop = collect($props['properties'])->firstWhere('id', $created['id']);
    expect(count($prop['media']))->toBe(3);
});

test('create property with multiple photos via multipart stores photos, first becomes cover', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();

    $response = $this->actingAs($admin)->post('/admin/properties', [
        'name' => 'Kios Baru',
        'type' => 'KIOSK',
        'normal_price' => 2500000,
        'status' => 'AVAILABLE',
        'description' => 'Kios dengan foto.',
        'facilities' => ['Rolling Door', 'AC (Air Conditioner)'],
        'photos' => [flowImage('a.jpg'), flowImage('b.jpg'), flowImage('c.jpg')],
    ], ['Accept' => 'application/json']);

    $response->assertStatus(201)
        ->assertJsonStructure(['property' => ['id', 'name', 'type', 'media']]);

    $created = $response->json('property');

    expect(collect($created['media']))->toHaveCount(3);

    // First uploaded photo is the automatic cover, no duplicates
    expect(collect($created['media'])->where('is_cover', true)->count())->toBe(1)
        ->and($created['media'][0]['is_cover'])->toBeTrue();

    // Files physically stored on both disks
    Storage::disk('public')->assertExists($created['media'][0]['public_path']);
    Storage::disk('local')->assertExists($created['media'][0]['original_path']);

    // Database rows carry the correct property_id
    expect(PropertyMedia::where('property_id', $created['id'])->count())->toBe(3);

    // Admin list immediately shows the count
    $props = flowPage($this->actingAs($admin)->get('/admin/properties'));
    $prop = collect($props['properties'])->firstWhere('id', $created['id']);
    expect(count($prop['media']))->toBe(3)
        ->and($prop['media_count'])->toBe(3);
});

test('create property with a single photo sets it as cover', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();

    $created = $this->actingAs($admin)->post('/admin/properties', [
        'name' => 'Kamar Satu Foto',
        'type' => 'ROOM',
        'normal_price' => 1200000,
        'status' => 'AVAILABLE',
        'photos' => [flowImage('single.jpg')],
    ], ['Accept' => 'application/json'])->json('property');

    expect(collect($created['media']))->toHaveCount(1)
        ->and($created['media'][0]['is_cover'])->toBeTrue();
});

test('only one cover is maintained per property', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();
    $property = flowProperty();

    $media = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [flowImage('a.jpg'), flowImage('b.jpg'), flowImage('c.jpg')],
    ])->json('media');

    // Uploading more photos must NOT create a second cover
    $more = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [flowImage('d.jpg')],
    ])->json('media');

    expect($more)->toHaveCount(4)
        ->and(collect($more)->where('is_cover', true)->count())->toBe(1);

    // Switching cover keeps exactly one
    $switched = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media/{$media[2]['id']}/cover")->json('media');
    expect(collect($switched)->where('is_cover', true)->count())->toBe(1)
        ->and(collect($switched)->firstWhere('is_cover', true)['id'])->toBe($media[2]['id']);
});

test('deleting the cover promotes the next media automatically', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();
    $property = flowProperty();

    $media = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [flowImage('a.jpg'), flowImage('b.jpg')],
    ])->json('media');

    // Delete the cover
    $coverId = collect($media)->firstWhere('is_cover', true)['id'];
    $deleteResponse = $this->actingAs($admin)->deleteJson("/admin/properties/{$property->id}/media/{$coverId}");
    $deleteResponse->assertOk()->assertJson(['success' => true]);
    $remaining = $deleteResponse->json('media');

    expect($remaining)->toHaveCount(1)
        ->and($remaining[0]['is_cover'])->toBeTrue();
});

test('deleting all media leaves no cover and property still listed', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = flowAdmin();
    $property = flowProperty();

    $media = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [flowImage('a.jpg'), flowImage('b.jpg')],
    ])->json('media');

    foreach ($media as $m) {
        $this->actingAs($admin)->deleteJson("/admin/properties/{$property->id}/media/{$m['id']}")->assertOk();
    }

    expect(PropertyMedia::where('property_id', $property->id)->count())->toBe(0);

    $props = flowPage($this->actingAs($admin)->get('/admin/properties'));
    $prop = collect($props['properties'])->firstWhere('id', $property->id);
    expect($prop['media'])->toBe([]);
});
