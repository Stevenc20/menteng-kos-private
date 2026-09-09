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

test('a replacement KTP clears stored identity when OCR reads nothing', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    // OCR engine yang selalu gagal membaca
    $empty = new class {
        public function extract(string $absolutePath): array
        {
            return ['raw' => '', 'name' => '', 'nik' => '', 'birth_place' => '', 'birth_date' => '', 'gender' => '', 'job' => '', 'address' => ''];
        }
    };
    $this->app->instance(\App\Services\KtpOcrService::class, $empty);

    // Data identitas yang sudah tersimpan sebelumnya (mis. "ALDO").
    TenantProfile::create([
        'user_id' => $user->id,
        'ktp_1_name' => 'ALDO ANDREASS',
        'ktp_1_nik' => '3171xxxxxxxxxxxx',
        'ktp_1_birth_place' => 'Jakarta',
        'ktp_1_job' => 'Wiraswasta',
        'ktp_1_address' => 'Jl. Lama No. 1',
    ]);

    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload('baru.jpg'),
    ]);
    $response->assertOk()->assertJson(['ok' => true]);

    // Ganti foto HARUS menghapus data identitas lama KTP, karena ini KTP baru!
    $profile = TenantProfile::where('user_id', $user->id)->first();
    expect($profile->ktp_1_name)->toBeNull();
    expect($profile->ktp_1_nik)->toBeNull();
    expect($profile->ktp_1_birth_place)->toBeNull();
    expect($profile->ktp_1_job)->toBeNull();
    expect($profile->ktp_1_address)->toBeNull();
    expect($profile->ktp_1_photo)->not->toBeNull();

    // Respons membawa snapshot profil terbaru agar Wizard sinkron
    $rProfile = data_get($response->json(), 'profile', []);
    expect($rProfile['ktp_1_name'])->toBeNull();
    expect($rProfile['ktp_1_photo'])->not->toBeNull();
});

test('a replacement KTP with readable OCR updates the read fields and clears the unread fields', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $fakeOcr = new class {
        public function extract(string $absolutePath): array
        {
            return [
                'raw' => 'NIK 3201110203920001 BUDI SETIAWAN JAKARTA 1992-03-02 KARYAWAN',
                'name' => 'BUDI SETIAWAN',
                'nik' => '3201110203920001',
                'birth_place' => 'JAKARTA',
                'birth_date' => '1992-03-02',
                'gender' => 'LAKI-LAKI',
                'job' => 'KARYAWAN',
                'address' => '',
            ];
        }
    };
    $this->app->instance(\App\Services\KtpOcrService::class, $fakeOcr);

    TenantProfile::create([
        'user_id' => $user->id,
        'ktp_1_name' => 'ALDO ANDREASS',
        'ktp_1_nik' => '3171xxxxxxxxxxxx',
        'ktp_1_address' => 'Jl. Lama No. 1',
    ]);

    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload('baru.jpg'),
    ]);
    $response->assertOk();

    // Field yang terbaca dari foto baru menggantikan data lama...
    $profile = TenantProfile::where('user_id', $user->id)->first();
    expect($profile->ktp_1_name)->toBe('BUDI SETIAWAN');
    expect($profile->ktp_1_nik)->toBe('3201110203920001');

    // ...tetapi field yang TIDAK terbaca DIBERSIHKAN (bukan dipertahankan).
    expect($profile->ktp_1_address)->toBeNull();

    // Respons membawa hasil OCR + snapshot profil untuk sinkronisasi frontend.
    expect(data_get($response->json(), 'ocr.ktp_1.name'))->toBe('BUDI SETIAWAN');
    expect(data_get($response->json(), 'profile.ktp_1_nik'))->toBe('3201110203920001');
});

test('upload response returns the latest profile snapshot so the wizard stays in sync', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    TenantProfile::create([
        'user_id' => $user->id,
        'ktp_1_name' => 'CITRA',
        'ktp_1_job' => 'Guru',
    ]);

    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ])->assertOk();

    $json = $response->json();
    // Default mock OCR will fail/return empty, so it clears the old identity
    expect($json['profile']['ktp_1_name'])->toBeNull();
    expect($json['profile']['ktp_1_job'])->toBeNull();
    expect($json['profile']['ktp_1_photo'])->not->toBeNull();
    expect(is_array($json['ocr']['ktp_1']))->toBeTrue();
});

test('a brand-new tenant with readable OCR gets identity persisted and shown in the response', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $this->actingAs($user);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $fakeOcr = new class {
        public function extract(string $absolutePath): array
        {
            return [
                'raw' => 'NIK 3201110203920001 BUDI SETIAWAN JAKARTA 1992-03-02 KARYAWAN',
                'name' => 'BUDI SETIAWAN',
                'nik' => '3201110203920001',
                'birth_place' => 'JAKARTA',
                'birth_date' => '1992-03-02',
                'gender' => 'LAKI-LAKI',
                'job' => 'KARYAWAN',
                'address' => '',
            ];
        }
    };
    $this->app->instance(\App\Services\KtpOcrService::class, $fakeOcr);

    // Tenant baru: belum ada TenantProfile sama sekali.
    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ])->assertOk();

    $profile = TenantProfile::where('user_id', $user->id)->first();
    expect($profile)->not->toBeNull();
    expect($profile->ktp_1_photo)->not->toBeNull();
    expect($profile->ktp_1_name)->toBe('BUDI SETIAWAN');
    expect($profile->ktp_1_nik)->toBe('3201110203920001');
    expect($profile->ktp_1_birth_place)->toBe('JAKARTA');
    expect($profile->ktp_1_birth_date)->toBe('1992-03-02');
    expect($profile->ktp_1_job)->toBe('KARYAWAN');

    // Respons membawa snapshot identitas terbaru agar Step 3 langsung terisi
    // tanpa refresh — sesuai arsitektur database sebagai source of truth.
    expect(data_get($response->json(), 'profile.ktp_1_name'))->toBe('BUDI SETIAWAN');
    expect(data_get($response->json(), 'profile.ktp_1_nik'))->toBe('3201110203920001');
});
test('a tenant can fetch their latest profile to hydrate the wizard', function () {
    $user = User::factory()->create(['role' => 'TENANT']);
    $profile = TenantProfile::create([
        'user_id' => $user->id,
        'ktp_1_name' => 'Budi Santoso',
        'ktp_1_nik' => '1234567890123456',
    ]);
    
    $this->actingAs($user);
    
    $response = $this->getJson(route('tenant.onboarding.profile'));
    
    $response->assertStatus(200)
             ->assertJsonPath('ok', true)
             ->assertJsonPath('profile.ktp_1_name', 'Budi Santoso')
             ->assertJsonPath('profile.ktp_1_nik', '1234567890123456');
});
test('replacing KTP resets all identity fields of the occupant to the new OCR result', function () {
    Storage::fake('local');
    $user = User::factory()->create(['role' => 'TENANT']);
    $profile = TenantProfile::create([
        'user_id' => $user->id,
        'ktp_1_name' => 'OLD NAME',
        'ktp_1_nik' => '1111111111111111',
        'ktp_1_job' => 'KARYAWAN',
        'ktp_1_address' => 'OLD ADDRESS',
    ]);
    
    // Using a fake OCR that simulates reading only Name and NIK, but not job
    $mockOcr = \Mockery::mock(App\Services\KtpOcrService::class);
    $mockOcr->shouldReceive('extract')->andReturn([
        'name' => 'NEW BUDI',
        'nik' => '2222222222222222',
        'birth_place' => '',
        'birth_date' => '',
        'job' => '',
        'address' => 'NEW BANDUNG',
    ]);
    app()->instance(App\Services\KtpOcrService::class, $mockOcr);
    
    $this->actingAs($user);
    
    $response = $this->postJson(route('tenant.onboarding.ktp'), [
        'ktp_1_photo' => makeKtpUpload(),
    ]);
    
    $response->assertStatus(200);
    
    $profile->refresh();
    expect($profile->ktp_1_name)->toBe('NEW BUDI');
    expect($profile->ktp_1_nik)->toBe('2222222222222222');
    expect($profile->ktp_1_address)->toBe('NEW BANDUNG');
    // Important: Job must be cleared, not retained from OLD data!
    expect($profile->ktp_1_job)->toBeNull();
});
