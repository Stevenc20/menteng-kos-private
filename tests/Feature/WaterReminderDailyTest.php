<?php

use App\Mail\TestNotificationMail;
use App\Mail\WaterReminderMail;
use App\Models\NotificationLog;
use App\Models\Property;
use App\Models\Setting;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterPeriod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function wkAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function wkPng(string $name): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    $path = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($path, $png);

    return new UploadedFile($path, $name, 'image/png', null, true);
}

function wkUnit(string $type = 'ROOM', float $normal = 1500000): array
{
    $admin = wkAdmin();
    $property = Property::create([
        'name' => 'KAMAR A-01',
        'type' => $type,
        'normal_price' => $normal,
        'status' => 'OCCUPIED',
    ]);
    $user = User::factory()->create(['role' => 'TENANT', 'name' => 'Nama Tenant']);
    Tenancy::create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => $normal,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);

    return [$admin, $property, $user];
}

function wkMakePeriod(Property $property, array $overrides = []): WaterPeriod
{
    return WaterPeriod::create(array_merge([
        'property_id' => $property->id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
        'meter_start' => 100,
        'due_date' => today()->addDays((int) Setting::get('water.reminder_days', 4))->toDateString(),
    ], $overrides));
}

function wkMailReady(): void
{
    Mail::fake();
    config()->set('mail.default', 'smtp');
    Setting::set('water.to_admin_email', 'admin@mentengkos.id');
}

// ---------------------------------------------------------------------------
// TEST 1 & 2 — H-4 mengirim email, sekali saja
// ---------------------------------------------------------------------------

test('TEST 1: H-4 reminder sends one email to the configured admin', function () {
    wkMailReady();
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property);

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, 1);

    $log = NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_H4_METER')->where('channel', 'EMAIL')->first();
    expect($log)->not->toBeNull();
    expect((string) $log->status)->toBe('SENT');
    expect((string) $log->purpose)->toBe('REMINDER');
    expect($log->recipient)->toBe('admin@mentengkos.id');
    expect($log->sent_at)->not->toBeNull();
});

test('TEST 2: H-4 reminder is never sent twice (dedupe + one-shot)', function () {
    wkMailReady();
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property);

    for ($i = 0; $i < 3; $i++) {
        $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();
    }

    Mail::assertSent(WaterReminderMail::class, 1);
    expect(NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_H4_METER')->where('channel', 'EMAIL')->count())->toBe(1);
    // WhatsApp channel is evaluated only once too (SKIPPED), so the total stays fixed.
    expect(NotificationLog::where('period_id', $period->id)->count())->toBe(2);
});

// ---------------------------------------------------------------------------
// TEST 3 & 4 — Jatuh tempo hari ini (meter belum di-update)
// ---------------------------------------------------------------------------

test('TEST 3: due-today reminder sends an email for a METER_DUE period', function () {
    wkMailReady();
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property, ['due_date' => today()->toDateString()]);

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, 1);
    expect(NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_PAYMENT_DUE')->where('channel', 'EMAIL')->where('status', 'SENT')->count())->toBe(1);
});

test('TEST 4: due-today reminder does not duplicate', function () {
    wkMailReady();
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property, ['due_date' => today()->toDateString()]);

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();
    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, 1);
    expect(NotificationLog::where('period_id', $period->id)->where('channel', 'EMAIL')->count())->toBe(1);
});

// ---------------------------------------------------------------------------
// TEST 5 & 6 — Setelah pembayaran: reminder update meter + rollover
// ---------------------------------------------------------------------------

test('TEST 5: confirming a payment triggers an update-meter reminder for the next period', function () {
    Storage::fake('local');
    Mail::fake();
    config()->set('mail.default', 'smtp');
    [$admin, $property] = wkUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", ['meter_start' => 100, 'photo' => wkPng('s.jpg')])->assertRedirect();
    $current = WaterPeriod::where('property_id', $property->id)->first();
    $this->actingAs($admin)->post("/admin/water/periods/{$current->id}/record", ['meter_end' => 130, 'photo' => wkPng('e.jpg')])->assertRedirect();
    $this->actingAs($admin)->post("/admin/water/periods/{$current->id}/confirm")->assertRedirect();

    $next = WaterPeriod::where('property_id', $property->id)->where('id', '!=', $current->id)->first();
    expect($next)->not->toBeNull();

    Mail::assertSent(WaterReminderMail::class, 1);
    $log = NotificationLog::where('period_id', $next->id)->where('trigger', 'WATER_NEW_PERIOD')->where('channel', 'EMAIL')->first();
    expect($log)->not->toBeNull();
    expect((string) $log->status)->toBe('SENT');
    expect($log->error)->toBeNull();
});

test('TEST 6: meter akhir periode sebelumnya menjadi meter awal periode berikutnya', function () {
    Storage::fake('local');
    [$admin, $property] = wkUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", ['meter_start' => 125, 'photo' => wkPng('s.jpg')])->assertRedirect();
    $current = WaterPeriod::where('property_id', $property->id)->first();
    $this->actingAs($admin)->post("/admin/water/periods/{$current->id}/record", ['meter_end' => 132, 'photo' => wkPng('e.jpg')])->assertRedirect();
    $this->actingAs($admin)->post("/admin/water/periods/{$current->id}/confirm")->assertRedirect();

    $next = WaterPeriod::where('property_id', $property->id)->where('id', '!=', $current->id)->first();
    expect((int) $next->meter_start)->toBe(132);
});

// ---------------------------------------------------------------------------
// TEST 7 & 8 — Unit yang belum waktunya & data existing
// ---------------------------------------------------------------------------

test('TEST 7: a unit that is not due yet receives no reminder', function () {
    wkMailReady();
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property, ['due_date' => today()->addDays(2)->toDateString()]);

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    Mail::assertNothingSent();
    expect(NotificationLog::where('period_id', $period->id)->count())->toBe(0);
});

test('TEST 8: existing tenants and units are untouched by reminder runs', function () {
    wkMailReady();
    [$admin, $property, $user] = wkUnit();
    wkMakePeriod($property);

    $before = ['tenants' => User::where('role', 'TENANT')->count(), 'properties' => Property::count(), 'tenancies' => Tenancy::count()];

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    expect(User::where('role', 'TENANT')->count())->toBe($before['tenants']);
    expect(Property::count())->toBe($before['properties']);
    expect(Tenancy::count())->toBe($before['tenancies']);
    expect(User::find($user->id)->name)->toBe('Nama Tenant');
    expect(Property::find($property->id)->name)->toBe('KAMAR A-01');
});

// ---------------------------------------------------------------------------
// TEST 9 & 10 — SMTP failure honesty & no cascade stop
// ---------------------------------------------------------------------------

test('TEST 9: SMTP failure is recorded as FAILED (never claimed SENT)', function () {
    config()->set('mail.default', 'smtp');
    Setting::set('water.to_admin_email', 'admin@mentengkos.id');
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property);

    Mail::shouldReceive('to')->andThrow(new RuntimeException('connection refused'));

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    $log = NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_H4_METER')->where('channel', 'EMAIL')->first();
    expect($log)->not->toBeNull();
    expect((string) $log->status)->toBe('FAILED');
    expect($log->sent_at)->toBeNull();
    expect($log->error)->toContain('connection refused');
});

test('TEST 10: SMTP failure on one unit does not stop the rest from being processed', function () {
    config()->set('mail.default', 'smtp');
    Setting::set('water.to_admin_email', 'admin@mentengkos.id');
    [$admin, $propertyA] = wkUnit();
    [, $propertyB] = wkUnit();
    $propertyB->update(['name' => 'KAMAR B-02']);
    wkMakePeriod($propertyA, ['due_date' => today()->toDateString()]);
    wkMakePeriod($propertyB, ['due_date' => today()->toDateString()]);

    Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP server down'));

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    $a = $propertyA->fresh();
    $b = $propertyB->fresh();
    expect(NotificationLog::where('period_id', WaterPeriod::where('property_id', $a->id)->first()->id)->where('channel', 'EMAIL')->where('status', 'FAILED')->count())->toBe(1);
    expect(NotificationLog::where('period_id', WaterPeriod::where('property_id', $b->id)->first()->id)->where('channel', 'EMAIL')->where('status', 'FAILED')->count())->toBe(1);
});

// ---------------------------------------------------------------------------
// TEST 11, 12 & 13
// ---------------------------------------------------------------------------

test('TEST 11: manual Test Email still works independently of reminders', function () {
    Mail::fake();
    config()->set('mail.default', 'smtp');
    [$admin] = wkUnit();

    $this->actingAs($admin)->postJson('/admin/water/notification/test-email', ['email' => 'admin@mentengkos.id'])
        ->assertOk()
        ->assertJson(['status' => 'sent']);

    Mail::assertSent(TestNotificationMail::class, 1);
    Mail::assertNotSent(WaterReminderMail::class);
});

test('TEST 12: notification log records all required delivery fields', function () {
    wkMailReady();
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property);

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    $log = NotificationLog::where('period_id', $period->id)->where('channel', 'EMAIL')->first();
    expect($log->channel)->toBe('EMAIL');
    expect($log->recipient)->toBe('admin@mentengkos.id');
    expect($log->purpose)->toBe('REMINDER');
    expect($log->status)->toBe('SENT');
    expect($log->sent_at)->not->toBeNull();
    expect($log->error)->toBeNull();
    expect($log->subject)->toContain('Pengingat Meter Air');
    expect($log->subject)->toContain('Update sebelum');
});

test('TEST 13: SMTP credentials never appear in logs or responses', function () {
    config()->set('mail.default', 'smtp');
    Setting::set('water.to_admin_email', 'admin@mentengkos.id');
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property);

    Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP authentication failed: password <PW> rejected'));

    $this->actingAs($admin)->artisan('water:send-reminders')->assertSuccessful();

    $log = NotificationLog::where('period_id', $period->id)->where('channel', 'EMAIL')->first();
    $payload = trim($log->subject.' '.$log->body.' '.($log->error ?? ''));
    expect(preg_match('/password|PW|<PW>|secret|token|api[_-]?key/i', $payload))->toBe(0);
    expect($log->error)->toContain('disembunyikan');
});

// ---------------------------------------------------------------------------
// HTML email render check (no external assets, brand present)
// ---------------------------------------------------------------------------

test('the reminder email renders professional HTML with the brand', function () {
    config()->set('mail.default', 'smtp');
    [$admin, $property] = wkUnit();
    $period = wkMakePeriod($property);

    $html = (new WaterReminderMail('Pengingat Meter Air — KAMAR A-01 — Update sebelum 15 September 2026', [
        'unit' => 'KAMAR A-01',
        'tenant' => 'Nama Tenant',
        'period' => 'September 2026',
        'due_date' => '14 September 2026',
        'meter_start' => '100 m³',
        'meter_end' => 'Belum tercatat',
        'usage' => '-',
        'amount' => '-',
        'header_tagline' => 'Sistem Meter Air',
        'action_label' => 'Buka Meter Air',
        'action_url' => route('admin.water.show', ['property' => $property->id]),
        'title' => 'Reminder Meter Air',
        'intro' => 'Halo Admin.',
        'rows' => [['Unit', 'KAMAR A-01']],
        'status_badge' => 'Menunggu Update Meter',
        'status_color' => '#B45309',
        'actions_title' => 'Tindakan yang diperlukan',
        'actions' => ['Update meter air.'],
        'note' => 'Data tidak berubah.',
    ]))->render();

    expect($html)->toContain('MENTENG KOS PRIVATE');
    expect($html)->toContain('Buka Meter Air');
    expect($html)->toContain('/admin/water/'.$property->id);
});
