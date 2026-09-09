<?php

use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function makeAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function makeMediaProperty(): Property
{
    return Property::create([
        'name' => 'Kamar Media',
        'type' => 'ROOM',
        'normal_price' => 1500000,
        'status' => 'AVAILABLE',
    ]);
}

function fakeImageUpload(string $name = 'kamar.jpg'): UploadedFile
{
    // Minimal valid 1x1 PNG so no GD extension is required.
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    $path = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($path, $png);

    return new UploadedFile($path, $name, 'image/png', null, true);
}

test('media upload returns JSON media list when requested as json', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = makeAdmin();
    $property = makeMediaProperty();

    $response = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [fakeImageUpload('kamar.jpg'), fakeImageUpload('kamar2.jpg')],
    ]);

    $response->assertOk()
        ->assertJsonStructure(['media' => [
            '*' => ['id', 'type', 'public_path', 'url'],
        ]]);

    $media = $response->json('media');
    expect(count($media))->toBe(2);

    // First uploaded image automatically becomes the cover
    expect($media[0]['is_cover'])->toBeTrue();

    // Files physically stored on both disks
    Storage::disk('public')->assertExists($media[0]['public_path']);
    Storage::disk('local')->assertExists($media[0]['original_path']);
});

test('media upload without files returns 422 for json requests', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = makeAdmin();
    $property = makeMediaProperty();

    $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [])
        ->assertStatus(422);
});

test('set cover returns full media list with updated cover flag', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = makeAdmin();
    $property = makeMediaProperty();

    $media = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [fakeImageUpload('a.jpg'), fakeImageUpload('b.jpg')],
    ])->json('media');

    $response = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media/{$media[1]['id']}/cover");
    $response->assertOk();

    $updated = collect($response->json('media'));
    $updated->each(fn ($m) => expect($m['is_cover'])->toBe($m['id'] === $media[1]['id']));
});

test('delete media removes row and stored files, and returns remaining list', function () {
    Storage::fake('local');
    Storage::fake('public');
    $admin = makeAdmin();
    $property = makeMediaProperty();

    $media = $this->actingAs($admin)->postJson("/admin/properties/{$property->id}/media", [
        'photos' => [fakeImageUpload('a.jpg'), fakeImageUpload('b.jpg')],
    ])->json('media');

    $target = $media[0];

    $response = $this->actingAs($admin)->deleteJson("/admin/properties/{$property->id}/media/{$target['id']}");
    $response->assertOk()->assertJson(['success' => true]);

    expect($response->json('media'))->toHaveCount(1);

    // Files removed from disk
    Storage::disk('public')->assertMissing($target['public_path']);
    Storage::disk('local')->assertMissing($target['original_path']);

    // DB row gone
    expect(PropertyMedia::find($target['id']))->toBeNull();
});
