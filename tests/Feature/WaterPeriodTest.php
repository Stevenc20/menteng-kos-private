<?php

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

function waterAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function waterTenantUser(): User
{
    return User::factory()->create(['role' => 'TENANT']);
}

function waterPng(string $name): UploadedFile
{
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    $path = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($path, $png);

    return new UploadedFile($path, $name, 'image/png', null, true);
}

/**
 * Create an admin, an occupied unit and its ACTIVE tenancy.
 * Returns [admin, property, tenantUser, tenancy].
 */
function waterUnit(string $type = 'ROOM', float $normal = 1500000, array $propertyExtra = []): array
{
    $admin = waterAdmin();
    $property = Property::create(array_merge([
        'name' => 'KAMAR 02',
        'type' => $type,
        'normal_price' => $normal,
        'status' => 'OCCUPIED',
    ], $propertyExtra));

    $user = waterTenantUser();
    $tenancy = Tenancy::create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => $normal,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);

    return [$admin, $property, $user, $tenancy];
}

// ---------------------------------------------------------------------------
// 1. Halaman list & hak akses
// ---------------------------------------------------------------------------

test('admin water list shows every unit', function () {
    $admin = waterAdmin();
    [$old, $property] = waterUnit();

    $this->actingAs($admin)
        ->get('/admin/water')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/Air')
            ->has('properties', 1)
            ->where('properties.0.name', $property->name)
            ->where('properties.0.water', null)
        );
});

test('non-admin cannot access the water pages', function () {
    $this->actingAs(User::factory()->create())
        ->get('/admin/water')
        ->assertForbidden();
});

// ---------------------------------------------------------------------------
// 2. Mulai periode (meter awal + foto)
// ---------------------------------------------------------------------------

test('admin starts a water period with meter awal + photo', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 1350,
        'photo' => waterPng('start.jpg'),
        'note' => 'periode perdana',
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();
    expect($period)->not->toBeNull();
    expect($period->status)->toBe('METER_DUE');
    expect((int) $period->meter_start)->toBe(1350);
    expect($period->meter_start_photo)->toContain('water_periods');
    expect((int) $period->tenant_id)->toBe($property->currentTenancy()->user_id);
    expect((int) $period->water_rate)->toBe(14000);
    expect($period->note)->toBe('periode perdana');

    Storage::disk('local')->assertExists($period->meter_start_photo);
});

test('cannot start a new period while one is already open', function () {
    Storage::fake('local');
    [$admin, $property, , $tenancy] = waterUnit();

    WaterPeriod::create([
        'property_id' => $property->id,
        'tenancy_id' => $tenancy->id,
        'tenant_id' => $tenancy->user_id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
        'meter_start' => 100,
        'due_date' => now()->addDays(20)->toDateString(),
    ]);

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 200,
        'photo' => waterPng('start.jpg'),
    ])->assertSessionHasErrors('meter_start');

    expect(WaterPeriod::where('property_id', $property->id)->count())->toBe(1);
});

// ---------------------------------------------------------------------------
// 3. Catat meter akhir
// ---------------------------------------------------------------------------

test('meter akhir >= meter awal computes usage, billable and total', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 1350,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/record", [
        'meter_end' => 1390,
        'photo' => waterPng('end.jpg'),
    ])->assertRedirect();

    $period->refresh();
    expect($period->status)->toBe('WAITING_PAYMENT');
    expect($period->payment_status)->toBe('UNPAID');
    expect((int) $period->usage)->toBe(40);
    // ROOM: first 5 m³ included => billable 35
    expect((int) $period->billable_usage)->toBe(35);
    expect((float) $period->total_amount)->toBe(490000.0);
    expect($period->meter_end_photo)->toContain('water_periods');
    Storage::disk('local')->assertExists($period->meter_end_photo);
});

test('meter akhir lower than meter awal is rejected and nothing is stored', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 1350,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/record", [
        'meter_end' => 100,
        'photo' => waterPng('end.jpg'),
    ])->assertSessionHasErrors('meter_end');

    $period->refresh();
    expect($period->status)->toBe('METER_DUE');
    expect($period->meter_end)->toBeNull();
    expect($period->usage)->toBeNull();
});

test('kiosk with deal below standard bills the full usage (separate water)', function () {
    Storage::fake('local');
    [$admin, $property, , $tenancy] = waterUnit('KIOSK', 2000000, ['name' => 'KIOS']);
    $tenancy->update(['agreed_price' => 1700000]);

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/record", [
        'meter_end' => 110,
        'photo' => waterPng('end.jpg'),
    ])->assertRedirect();

    $period->refresh();
    expect((int) $period->usage)->toBe(10);
    expect((int) $period->billable_usage)->toBe(10); // no allowance for separate KIOSK
    expect((float) $period->total_amount)->toBe(140000.0);
});

// ---------------------------------------------------------------------------
// 4. Konfirmasi pembayaran
// ---------------------------------------------------------------------------

test('confirming payment closes the period and opens the next one from the old end', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/record", [
        'meter_end' => 130,
        'photo' => waterPng('end.jpg'),
    ])->assertRedirect();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/confirm")->assertRedirect();

    $period->refresh();
    expect($period->status)->toBe('PAID');
    expect($period->payment_status)->toBe('PAID');
    expect($period->paid_at)->not->toBeNull();
    expect((int) $period->confirmed_by)->toBe($admin->id);

    $next = WaterPeriod::where('property_id', $property->id)->where('id', '!=', $period->id)->first();
    expect($next)->not->toBeNull();
    expect($next->status)->toBe('METER_DUE');
    // Old END becomes the new START without retyping.
    expect((int) $next->meter_start)->toBe((int) $period->meter_end);
    expect($next->meter_start_photo)->toBe($period->meter_end_photo);
    expect((int) $next->tenant_id)->toBe((int) $period->tenant_id);

    $expectedMonth = (int) $period->period_month === 12 ? 1 : (int) $period->period_month + 1;
    expect((int) $next->period_month)->toBe($expectedMonth);
});

test('tenant snapshot survives the tenancy being removed', function () {
    Storage::fake('local');
    [$admin, $property, $user, $tenancy] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();
    expect((int) $period->tenant_id)->toBe($user->id);
    $startPhoto = $period->meter_start_photo;

    // Tenant leaves: tenancy soft-deleted. History must stay on the unit.
    $tenancy->delete();

    expect(WaterPeriod::where('property_id', $property->id)->count())->toBe(1);
    $period->refresh();
    expect((int) $period->tenant_id)->toBe($user->id);
    expect($period->meter_start_photo)->toBe($startPhoto);
});

// ---------------------------------------------------------------------------
// 5. Reminder H-4 & scheduler
// ---------------------------------------------------------------------------

test('H-4 scheduler sends one email and logs an honest WhatsApp SKIPPED', function () {
    Storage::fake('local');
    Mail::fake();
    waterAdmin();
    [$old, $property] = waterUnit();

    // WhatsApp enabled but provider empty => delivery must be an honest SKIPPED.
    Setting::set('water.whatsapp_enabled', '1');

    $period = WaterPeriod::create([
        'property_id' => $property->id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'METER_DUE',
        'payment_status' => 'NOT_APPLICABLE',
        'meter_start' => 100,
        'due_date' => today()->addDays((int) Setting::get('water.reminder_days', 4))->toDateString(),
    ]);

    $this->artisan('water:daily-process')->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, 1);

    expect(NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_H4_METER')->where('channel', 'EMAIL')->where('status', 'SENT')->count())->toBe(1);

    $wa = NotificationLog::where('period_id', $period->id)->where('channel', 'WHATSAPP')->first();
    expect($wa)->not->toBeNull();
    expect($wa->status)->toBe('SKIPPED');
    expect($wa->error)->toContain('belum dikonfigurasi');

    // Dedupe: running the command again does not send duplicates on the same day.
    $this->artisan('water:daily-process')->assertSuccessful();
    expect(NotificationLog::where('period_id', $period->id)->count())->toBe(2); // 1 EMAIL + 1 WHATSAPP
});

test('payment due reminder fires when a billed period is due', function () {
    Storage::fake('local');
    Mail::fake();
    waterAdmin();
    [$old, $property] = waterUnit();

    $period = WaterPeriod::create([
        'property_id' => $property->id,
        'period_year' => now()->year,
        'period_month' => now()->month,
        'status' => 'WAITING_PAYMENT',
        'payment_status' => 'UNPAID',
        'meter_start' => 100,
        'meter_end' => 110,
        'usage' => 10,
        'billable_usage' => 5,
        'water_rate' => 14000,
        'total_amount' => 70000,
        'due_date' => today()->toDateString(),
    ]);

    $this->artisan('water:daily-process')->assertSuccessful();

    expect(NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_PAYMENT_DUE')->where('channel', 'EMAIL')->where('status', 'SENT')->count())->toBe(1);
    expect(NotificationLog::where('period_id', $period->id)->where('trigger', 'WATER_PAYMENT_DUE')->where('channel', 'WHATSAPP')->where('status', 'SKIPPED')->count())->toBe(1);
});

test('confirming a payment logs a WATER_NEW_PERIOD reminder', function () {
    Storage::fake('local');
    Mail::fake();
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/record", [
        'meter_end' => 110,
        'photo' => waterPng('end.jpg'),
    ])->assertRedirect();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/confirm")->assertRedirect();

    $next = WaterPeriod::where('property_id', $property->id)->where('id', '!=', $period->id)->first();

    expect(NotificationLog::where('period_id', $next->id)->where('trigger', 'WATER_NEW_PERIOD')->where('channel', 'EMAIL')->where('status', 'SENT')->count())->toBe(1);
    expect(NotificationLog::where('period_id', $next->id)->where('trigger', 'WATER_NEW_PERIOD')->where('channel', 'WHATSAPP')->where('status', 'SKIPPED')->count())->toBe(1);
});

// ---------------------------------------------------------------------------
// 6. Pengaturan
// ---------------------------------------------------------------------------

test('settings page updates admin whatsapp, rate, reminder days and toggles', function () {
    $admin = waterAdmin();

    $this->actingAs($admin)->post('/admin/water/settings', [
        'to_admin_whatsapp' => '0812000111',
        'rate_per_m3' => 15000,
        'reminder_days' => 5,
        'email_enabled' => '1',
        'whatsapp_enabled' => '0',
        'whatsapp_provider' => '',
    ])->assertRedirect();

    expect(Setting::get('water.to_admin_whatsapp'))->toBe('0812000111');
    expect((float) Setting::get('water.rate_per_m3'))->toBe(15000.0);
    expect((int) Setting::get('water.reminder_days'))->toBe(5);
    expect(filter_var(Setting::get('water.email_enabled'), FILTER_VALIDATE_BOOLEAN))->toBeTrue();
    expect(filter_var(Setting::get('water.whatsapp_enabled'), FILTER_VALIDATE_BOOLEAN))->toBeFalse();
});

test('the configured rate (per settings) is used for new periods instead of a hardcode', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    Setting::set('water.rate_per_m3', 25000);

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();
    expect((int) $period->water_rate)->toBe(25000);
});

test('a unit-specific water rate overrides the global setting', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit('ROOM', 1500000, ['name' => 'KAMAR 05']);
    $property->update(['water_rate' => 20000]);
    Setting::set('water.rate_per_m3', 14000);

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->post("/admin/water/periods/{$period->id}/record", [
        'meter_end' => 110,
        'photo' => waterPng('end.jpg'),
    ])->assertRedirect();

    $period->refresh();
    expect((int) $period->water_rate)->toBe(20000);
    // ROOM allowance: 10 m³ usage => 5 m³ billable × Rp 20.000
    expect((float) $period->total_amount)->toBe(100000.0);
});

// ---------------------------------------------------------------------------
// 7. Foto privat
// ---------------------------------------------------------------------------

test('meter photos are served from private storage', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $period = WaterPeriod::where('property_id', $property->id)->first();

    $this->actingAs($admin)->get("/admin/water/periods/{$period->id}/photo/start")
        ->assertOk();
});

test('water detail page shows period history per unit', function () {
    Storage::fake('local');
    [$admin, $property] = waterUnit();

    $this->actingAs($admin)->post("/admin/water/{$property->id}/start", [
        'meter_start' => 100,
        'photo' => waterPng('start.jpg'),
    ])->assertRedirect();

    $this->actingAs($admin)
        ->get("/admin/water/{$property->id}")
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Admin/WaterDetail')
            ->has('periods', 1)
        );
});