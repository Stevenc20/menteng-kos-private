<?php

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function makeKtpUpload(string $name = 'ktp.jpg'): UploadedFile
{
    $path = base_path('tests/fixtures/ktp.jpg');
    return new UploadedFile($path, $name, 'image/jpeg', null, true);
}

test('guests cannot upload a KTP photo', function () {
    $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ])->assertStatus(401);
});

test('a tenant can upload a KTP photo to private storage', function () {
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ]);

    $response->assertOk()->assertJson(['ok' => true]);

    $savedPath = data_get($response->json(), 'ktp_1_photo');
    expect($savedPath)->not->toBeNull();

    Storage::disk('local')->assertExists($savedPath);
    expect(str_starts_with($savedPath, 'ktp/'))->toBeTrue();
    expect(str_contains($savedPath, 'private/private'))->toBeFalse();

    $this->assertDatabaseHas('tenant_profiles', [
        'user_id' => $user->id,
        'ktp_1_photo' => $savedPath,
    ]);
});

test('non-image file is rejected on KTP upload', function () {
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => UploadedFile::fake()->create('ktp.txt', 100),
    ])->assertStatus(422);
});

test('no file sent returns explicit error', function () {
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $this->postJson(route('tenant.onboarding.ktp'), [])
        ->assertStatus(422);
});

test('a tenant can fetch their own KTP photo after upload', function () {
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $posted = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ]);
    $savedPath = data_get($posted->json(), 'ktp_1_photo');

    $this->get(route('tenant.onboarding.ktp.photo', ['kind' => 'ktp_1']))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/jpeg');

    expect(TenantProfile::where('user_id', $user->id)->first()->ktp_1_photo)->toBe($savedPath);
});

test('a tenant cannot fetch another users KTP photo', function () {
    $owner = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($owner);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $posted = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ]);
    expect($posted->json('ok'))->toBeTrue();

    $other = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($other);

    $this->get(route('tenant.onboarding.ktp.photo', ['kind' => 'ktp_1']))->assertNotFound();
});

test('submitting profile info (storeInfo) does not wipe an already-stored KTP path', function () {
    $user = User::factory()->create(['role' => 'TENANT']);
    $property = Property::create([
        'name' => 'KTP Unit',
        'type' => 'ROOM',
        'normal_price' => 1000000,
        'status' => 'AVAILABLE',
    ]);
    Tenancy::create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1000000,
        'move_in_date' => now()->toDateString(),
        'status' => 'INVITED',
    ]);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $posted = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ])->assertOk();
    $savedPath = data_get($posted->json(), 'ktp_1_photo');

    // Later the wizard submits all identity fields (without re-sending the file).
    $this->postJson(route('tenant.onboarding.info'), [
        'whatsapp' => '0812',
        'ktp_1_name' => 'Budi',
        'ktp_1_nik' => '320111',
        'ktp_1_birth_place' => 'Jakarta',
        'ktp_1_birth_date' => '1990-01-01',
        'ktp_1_job' => 'Karyawan',
        'ktp_1_address' => 'Jl. Test',
        'has_second_occupant' => false,
    ]);

    $profile = TenantProfile::where('user_id', $user->id)->first();
    expect($profile->ktp_1_photo)->toBe($savedPath);
    Storage::disk('local')->assertExists($savedPath);
});

test('when the database persist fails, the freshly uploaded KTP file is removed (no orphan)', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    // Force the profile save to fail so the file would otherwise be orphaned.
    \App\Models\TenantProfile::saving(fn () => false);

    try {
        $this->postJson(route('tenant.onboarding.ktp'), [
            'ktp_1_photo' => makeKtpUpload(),
        ])->assertStatus(500);

        expect(Storage::disk('local')->allFiles('ktp'))->toBe([]);
        expect(TenantProfile::count())->toBe(0);
    } finally {
        \App\Models\TenantProfile::flushEventListeners();
    }
});

test('uploading a replacement KTP deletes the old file only after a successful save', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $first = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload('old.jpg'),
    ])->assertOk();
    $oldPath = data_get($first->json(), 'ktp_1_photo');
    Storage::disk('local')->assertExists($oldPath);

    // If the SECOND persist fails, the replacement file must be removed AND the
    // original file must be kept (old cleanup only happens after a successful save).
    \App\Models\TenantProfile::saving(fn () => false);

    try {
        $second = $this->postJson(route('tenant.onboarding.ktp'), [
            'ktp_1_photo' => makeKtpUpload('new.jpg'),
        ]);

        expect($second->status())->toBe(500);
        Storage::disk('local')->assertExists($oldPath);
        expect(Storage::disk('local')->allFiles('ktp'))->toBe([$oldPath]);
    } finally {
        \App\Models\TenantProfile::flushEventListeners();
    }
});

test('uploading a new KTP photo replaces stale stored identity fields', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    // Simulate a profile carrying the previous occupant's data (e.g. "ALDO").
    TenantProfile::create([
        'user_id' => $user->id,
        'ktp_1_name' => 'ALDO ANDREASS',
        'ktp_1_nik' => '3171xxxxxxxxxxxx',
        'ktp_1_birth_place' => 'Jakarta',
        'ktp_1_job' => 'Wiraswasta',
        'ktp_1_address' => 'Jl. Lama No. 1',
    ]);

    // The fixture image is a tiny non-OCR-able placeholder, so OCR yields blank
    // fields — the stale stored identity must NOT survive the new upload.
    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload('baru.jpg'),
    ]);
    $response->assertOk()->assertJson(['ok' => true]);

    $profile = TenantProfile::where('user_id', $user->id)->first();
    expect($profile->ktp_1_name)->toBe('');
    expect($profile->ktp_1_nik)->toBe('');
    expect($profile->ktp_1_birth_place)->toBe('');
    expect($profile->ktp_1_job)->toBe('');
    expect($profile->ktp_1_address)->toBe('');
    expect($profile->ktp_1_photo)->not->toBeNull();
});
