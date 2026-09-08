<?php

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
    expect(str_starts_with($savedPath, 'private/ktp/'))->toBeTrue();

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
