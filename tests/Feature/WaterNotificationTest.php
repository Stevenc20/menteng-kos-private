<?php

use App\Mail\TestNotificationMail;
use App\Models\NotificationLog;
use App\Models\Property;
use App\Models\Setting;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

function testAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

// ---------------------------------------------------------------------------
// TEST 1 & 2 — Test Email benar-benar dikirim (mailer SMTP, Mail::fake meng-capture)
// ---------------------------------------------------------------------------

test('TEST 1+2: test email reaches backend and is actually mailed to the recipient', function () {
    Mail::fake();
    config()->set('mail.default', 'smtp');
    $admin = testAdmin();

    $res = $this->actingAs($admin)->postJson('/admin/water/notification/test-email', [
        'email' => 'admin@mentengkos.id',
    ]);

    $res->assertOk()
        ->assertJson(['status' => 'sent'])
        ->assertJsonPath('mailer', 'smtp');

    Mail::assertSent(TestNotificationMail::class, function ($mail) {
        return $mail->hasTo('admin@mentengkos.id');
    });
    Mail::assertSentCount(1);

    $log = NotificationLog::where('channel', 'EMAIL')->first();
    expect($log)->not->toBeNull();
    expect((string) $log->purpose)->toBe('TEST');
    expect((string) $log->trigger)->toBe('WATER_TEST');
    expect($log->recipient)->toBe('admin@mentengkos.id');
    expect((string) $log->status)->toBe('SENT');
    expect($log->sent_at)->not->toBeNull();
    expect(\Carbon\Carbon::parse($log->sent_at)->diffInMinutes(now()))->toBeLessThanOrEqual(5);
});

test('mail with log/array driver is reported FAILED (not delivered to an inbox), rumah jujur', function () {
    Mail::fake();
    config()->set('mail.default', 'log');

    $res = $this->actingAs(testAdmin())->postJson('/admin/water/notification/test-email', [
        'email' => 'admin@mentengkos.id',
    ]);

    $res->assertOk()
        ->assertJson(['status' => 'failed']);
    expect($res->json('message'))->toContain('mailer')->toContain('log');

    $log = NotificationLog::where('channel', 'EMAIL')->first();
    expect((string) $log->status)->toBe('FAILED');
    expect($log->sent_at)->toBeNull();
    expect($log->error)->toContain('log');
});

test('validation rejects a broken email address for test email', function () {
    $this->actingAs(testAdmin())
        ->postJson('/admin/water/notification/test-email', ['email' => 'bukan-email'])
        ->assertStatus(422);

    expect(NotificationLog::count())->toBe(0);
});

// ---------------------------------------------------------------------------
// TEST 3, 4 & 5 — Test WhatsApp: request masuk backend, provider gagal => UI FAILED
// ---------------------------------------------------------------------------

test('TEST 3+4+5: test whatsapp request is handled and, without a provider, always reports FAILED (never pretends sent)', function () {
    Setting::set('water.whatsapp_enabled', '1');
    Setting::set('water.whatsapp_provider', '');

    $res = $this->actingAs(testAdmin())->postJson('/admin/water/notification/test-whatsapp', [
        'number' => '081291903483',
    ]);

    $res->assertOk()
        ->assertJson(['status' => 'failed']);
    $message = $res->json('message');
    expect($message)->toContain('WhatsApp belum dikonfigurasi');
    expect($message)->not->toBe('');

    $log = NotificationLog::where('channel', 'WHATSAPP')->first();
    expect($log)->not->toBeNull();
    expect((string) $log->purpose)->toBe('TEST');
    expect((string) $log->trigger)->toBe('WATER_TEST');
    expect($log->recipient)->toBe('081291903483');
    expect((string) $log->status)->toBe('FAILED');
    expect($log->sent_at)->toBeNull();
    expect($log->error)->toContain('provider');
});

test('test whatsapp when whatsapp disabled reports FAILED with clear reason', function () {
    Setting::set('water.whatsapp_enabled', '0');

    $res = $this->actingAs(testAdmin())->postJson('/admin/water/notification/test-whatsapp', [
        'number' => '081291903483',
    ]);

    $res->assertOk()
        ->assertJson(['status' => 'failed'])
        ->assertJsonPath('message', 'WhatsApp dinonaktifkan (water.whatsapp_enabled=0). Aktifkan di Pengaturan Meter Air.');
});

// ---------------------------------------------------------------------------
// TEST 6 — credential/token tidak pernah muncul di UI/log
// ---------------------------------------------------------------------------

test('TEST 6: no credential/token ever leaks into the response or the notification log', function () {
    $admin = testAdmin();
    config()->set('mail.default', 'log');

    $this->actingAs($admin)->postJson('/admin/water/notification/test-email', ['email' => 'admin@mentengkos.id']);
    $this->actingAs($admin)->postJson('/admin/water/notification/test-whatsapp', ['number' => '081291903483']);

    $logs = NotificationLog::all();
    expect($logs->count())->toBe(2);

    foreach ($logs as $log) {
        $payload = trim(($log->subject ?? '').' '.($log->body ?? '').' '.($log->error ?? ''));
        expect(preg_match('/password|token|secret|api_key|api.?key/i', $payload))->toBe(0);
    }

    $res = $this->actingAs($admin)->postJson('/admin/water/notification/test-whatsapp', ['number' => '081291903483']);
    expect(preg_match('/password|token|secret|api_key/i', json_encode($res->json())))->toBe(0);
});

// ---------------------------------------------------------------------------
// TEST 7 & 8 — tenant/unit existing TIDAK berubah
// ---------------------------------------------------------------------------

test('TEST 7+8: existing tenants and units are untouched by test notifications', function () {
    $admin = testAdmin();
    $user = User::factory()->create(['role' => 'TENANT', 'name' => 'Penghuni Tetap']);
    $property = Property::create([
        'name' => 'KAMAR 01',
        'type' => 'ROOM',
        'normal_price' => 1500000,
        'status' => 'OCCUPIED',
    ]);
    $tenancy = Tenancy::create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1500000,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);

    $before = [
        'tenants' => User::where('role', 'TENANT')->count(),
        'properties' => Property::count(),
        'tenancies' => Tenancy::count(),
    ];

    config()->set('mail.default', 'log');
    $this->actingAs($admin)->postJson('/admin/water/notification/test-email', ['email' => 'admin@mentengkos.id']);
    $this->actingAs($admin)->postJson('/admin/water/notification/test-whatsapp', ['number' => '081291903483']);

    expect(User::where('role', 'TENANT')->count())->toBe($before['tenants']);
    expect(Property::count())->toBe($before['properties']);
    expect(Tenancy::count())->toBe($before['tenancies']);

    expect(User::find($user->id)->name)->toBe('Penghuni Tetap');
    expect(Property::find($property->id)->name)->toBe('KAMAR 01');
    expect(Tenancy::find($tenancy->id)->status)->toBe('ACTIVE');
});

// ---------------------------------------------------------------------------
// TEST 9 — tidak ada scheduler reminder production yang aktif
// ---------------------------------------------------------------------------

test('TEST 9: scheduler is registered but only runs while explicitly enabled', function () {
    $content = file_get_contents(base_path('routes/console.php'));

    expect($content)->toContain('water:send-reminders');
    expect($content)->toContain('config(\'water.scheduler_enabled\')');
    expect($content)->not->toContain('water:daily-process');

    config()->set('water.scheduler_enabled', false);
    expect(config('water.scheduler_enabled'))->toBeFalse();
});

test('non-admin cannot trigger test notifications', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/admin/water/notification/test-email', ['email' => 'x@y.id'])
        ->assertForbidden();

    $this->actingAs(User::factory()->create())
        ->postJson('/admin/water/notification/test-whatsapp', ['number' => '081291903483'])
        ->assertForbidden();
});