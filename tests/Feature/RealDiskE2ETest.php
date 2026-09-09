<?php

use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;

uses(RefreshDatabase::class);

// Real-disk E2E: NO Storage::fake. Files go to the actual storage/app folder.
// Every file created here is tracked and removed so nothing is left behind.

function realImg(string $name): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    $path = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($path, $png);

    return new UploadedFile($path, $name, 'image/png', null, true);
}

test('REAL DISK: create property with photos writes real files and serves URL', function () {
    $admin = User::factory()->create(['role' => 'ADMIN']);

    $response = $this->actingAs($admin)->post('/admin/properties', [
        'name' => 'RealDisk E2E',
        'type' => 'KIOSK',
        'normal_price' => 3000000,
        'status' => 'AVAILABLE',
        'photos' => [realImg('a.png'), realImg('b.png'), realImg('c.png')],
    ], ['Accept' => 'application/json']);

    $response->assertStatus(201);
    $created = $response->json('property');

    $tracked = [];

    try {
        expect(collect($created['media']))->toHaveCount(3);
        expect($created['media'][0]['is_cover'])->toBeTrue();

        foreach ($created['media'] as $m) {
            $tracked[] = ['disk' => 'public', 'path' => $m['public_path']];
            $tracked[] = ['disk' => 'local', 'path' => $m['original_path']];

            // Real file really exists on the real public/private folders
            expect(Storage::disk('public')->exists($m['public_path']))->toBeTrue();
            expect(Storage::disk('local')->exists($m['original_path']))->toBeTrue();

            // URL is a single clean /storage/ path
            expect($m['url'])->toContain('/storage/')
                ->and($m['url'])->not->toContain('/storage/storage/')
                ->and($m['url'])->not->toContain('/storage/public/');
        }

        // Upload one more photo to the real disk through the real endpoint
        $upload = $this->actingAs($admin)->postJson("/admin/properties/{$created['id']}/media", [
            'photos' => [realImg('d.png')],
        ])->assertOk()->json('media');

        foreach ($upload as $m) {
            if ($m['id'] === $created['media'][count($created['media']) - 1]['id']) {
                continue;
            }
            $tracked[] = ['disk' => 'public', 'path' => $m['public_path']];
            $tracked[] = ['disk' => 'local', 'path' => $m['original_path']];
        }
        expect($upload)->toHaveCount(4);
        expect(collect($upload)->where('is_cover', true)->count())->toBe(1);

        // Delete the cover: next becomes cover automatically
        $coverId = collect($upload)->firstWhere('is_cover', true)['id'];
        $afterDelete = $this->actingAs($admin)->deleteJson("/admin/properties/{$created['id']}/media/{$coverId}")
            ->assertOk()->assertJson(['success' => true])->json('media');

        expect($afterDelete)->toHaveCount(3)
            ->and(collect($afterDelete)->where('is_cover', true)->count())->toBe(1);

        // DB is consistent with the API
        expect(PropertyMedia::where('property_id', $created['id'])->count())->toBe(3);
    } finally {
        // Cleanup: remove every file this test wrote, then the rows.
        foreach ($tracked as $f) {
            Storage::disk($f['disk'])->delete($f['path']);
        }
        PropertyMedia::where('property_id', $created['id'])->delete();
        Property::find($created['id'])?->delete();
    }
});

test('REAL DISK: tenant uploads KTP and admin sees the same photo end-to-end', function () {
    $tenant = User::factory()->create(['role' => 'TENANT']);
    $admin = User::factory()->create(['role' => 'ADMIN']);
    $property = Property::create([
        'name' => 'RealKTP Unit',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
    ]);
    $tenancy = Tenancy::create([
        'user_id' => $tenant->id,
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->toDateString(),
        'status' => 'PENDING_ADMIN_APPROVAL',
        'approval_status' => 'PENDING',
    ]);

    $savedPath = null;
    $savedPath2 = null;

    try {
        // 1) Tenant uploads KTP through the real endpoint into the real disk
        $this->actingAs($tenant)->post('/tenant/onboarding/ktp', [
            'ktp_1_photo' => realImg('ktp1.png'),
        ])->assertOk();
        $this->actingAs($tenant)->post('/tenant/onboarding/ktp', [
            'ktp_2_photo' => realImg('ktp2.png'),
        ])->assertOk();

        $profile = TenantProfile::where('user_id', $tenant->id)->first();
        $savedPath = $profile->ktp_1_photo;
        $savedPath2 = $profile->ktp_2_photo;

        expect($savedPath)->not->toBeNull();
        expect($savedPath2)->not->toBeNull();
        // No double-private: relative path is ktp/..., disk root is already app/private.
        expect($savedPath)->toStartWith('ktp/');
        expect($savedPath2)->toStartWith('ktp/');
        expect(str_contains($savedPath, 'private/private'))->toBeFalse();
        expect(Storage::disk('local')->exists($savedPath))->toBeTrue();
        expect(Storage::disk('local')->exists($savedPath2))->toBeTrue();

        // 2) Admin review page passes the stored paths to the frontend
        $props = null;
        $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}")
            ->assertOk()
            ->assertInertia(function ($page) use (&$props) {
                $props = $page->toArray()['props'];
            });

        expect($props['profile']['ktp_1_photo'])->toBe($savedPath);
        expect($props['profile']['ktp_2_photo'])->toBe($savedPath2);

        // 3) Preview and download work for admin
        $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}/ktp/1")->assertOk();
        $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}/ktp/1/download")->assertOk();
        $this->actingAs($admin)->get("/admin/tenants/{$tenancy->id}/ktp/2/download")->assertOk();

        // 4) Non-admin cannot read it
        $this->actingAs($tenant)->get("/admin/tenants/{$tenancy->id}/ktp/1/download")->assertForbidden();
    } finally {
        if ($savedPath) Storage::disk('local')->delete($savedPath);
        if ($savedPath2) Storage::disk('local')->delete($savedPath2);
        TenantProfile::where('user_id', $tenant->id)->delete();
        Tenancy::find($tenancy->id)?->delete();
        Property::find($property->id)?->delete();
        User::find($admin->id)?->delete();
        User::find($tenant->id)?->delete();
    }
});