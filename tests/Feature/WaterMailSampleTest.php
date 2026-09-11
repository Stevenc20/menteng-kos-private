<?php

use App\Mail\WaterReminderMail;
use App\Models\NotificationLog;
use App\Models\Property;
use App\Models\Setting;
use App\Models\Tenancy;
use App\Models\User;
use App\Models\WaterPeriod;
use App\Services\WaterNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

function wsAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN']);
}

function wsUnit(): array
{
    $property = Property::create([
        'name' => 'KAMAR A-01',
        'type' => 'ROOM',
        'normal_price' => 1500000,
        'status' => 'OCCUPIED',
    ]);
    $user = User::factory()->create(['role' => 'TENANT', 'name' => 'Nama Tenant']);
    Tenancy::create([
        'user_id' => $user->id,
        'property_id' => $property->id,
        'agreed_price' => 1500000,
        'move_in_date' => now()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'approval_status' => 'APPROVED',
    ]);

    return [$property, $user];
}

function wsMailReady(): void
{
    Mail::fake();
    config()->set('mail.default', 'smtp');
    Setting::set('water.to_admin_email', 'admin@mentengkos.id');
}

// ---------------------------------------------------------------------------
// water:mail-sample — email scheduler ASLI, tapi tidak menyentuh data
// ---------------------------------------------------------------------------

test('water:mail-sample H-4 mengirim email scheduler di format asli', function () {
    wsMailReady();
    [$property, $user] = wsUnit();
    $admin = wsAdmin();

    $before = [
        'tenants' => User::where('role', 'TENANT')->count(),
        'units' => Property::count(),
        'times' => Tenancy::count(),
        'logs' => NotificationLog::count(),
    ];

    $this->actingAs($admin)
        ->artisan('water:mail-sample', ['--trigger' => 'h4', '--unit' => (string) $property->id])
        ->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, 1);
    Mail::assertSent(WaterReminderMail::class, function (WaterReminderMail $mail) {
        return str_contains($mail->messageSubject, '🔔 Pengingat Meter Air')
            && str_contains($mail->messageSubject, 'Update sebelum');
    });

    expect(User::where('role', 'TENANT')->count())->toBe($before['tenants']);
    expect(Property::count())->toBe($before['units']);
    expect(Tenancy::count())->toBe($before['times']);
    expect(WaterPeriod::count())->toBe(0);
    expect(NotificationLog::count())->toBe($before['logs']);
    expect(User::find($user->id)->name)->toBe('Nama Tenant');
    expect(Property::find($property->id)->name)->toBe('KAMAR A-01');
});

test('water:mail-sample new memakai subjek pembayaran selesai + template rollover', function () {
    wsMailReady();
    [$property] = wsUnit();

    $this->artisan('water:mail-sample', ['--trigger' => 'new', '--unit' => (string) $property->id])
        ->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, 1);
    Mail::assertSent(WaterReminderMail::class, function (WaterReminderMail $mail) {
        return str_contains($mail->messageSubject, 'Pembayaran Selesai, Update Meter Berikutnya')
            && str_contains($mail->messageSubject, 'KAMAR A-01');
    });
});

test('water:mail-sample menerima --due dan --to', function () {
    wsMailReady();
    [$property] = wsUnit();

    $this->artisan('water:mail-sample', [
        '--trigger' => 'due',
        '--unit' => (string) $property->id,
        '--due' => now()->toDateString(),
        '--to' => 'bukan-admin@contoh.id',
    ])->assertSuccessful();

    Mail::assertSent(WaterReminderMail::class, fn (WaterReminderMail $mail) => $mail->hasTo('bukan-admin@contoh.id'));
    expect(WaterPeriod::count())->toBe(0);
    expect(NotificationLog::count())->toBe(0);
});

test('water:mail-sample menolak trigger yang tidak dikenal', function () {
    wsMailReady();
    [$property] = wsUnit();

    $this->artisan('water:mail-sample', ['--trigger' => 'nope', '--unit' => (string) $property->id])
        ->assertExitCode(2);

    Mail::assertNothingSent();
});

// ---------------------------------------------------------------------------
// preview() — template asli, tanpa menulis NotificationLog
// ---------------------------------------------------------------------------

test('preview() mengirim template asli dan tidak menulis log apapun', function () {
    wsMailReady();
    [$property] = wsUnit();

    $period = new WaterPeriod;
    $period->property_id = $property->id;
    $period->period_month = (int) now()->month;
    $period->period_year = now()->year;
    $period->meter_start = 125;
    $period->meter_end = 138;
    $period->usage = 13;
    $period->due_date = now()->addDays(4);
    $period->setRelation('property', $property);

    $result = app(WaterNotificationService::class)->preview(
        WaterNotificationService::TRIGGER_H4_METER,
        $period,
        'admin@mentengkos.id'
    );

    expect($result['status'])->toBe('SENT');
    expect($result['subject'])->toContain('Pengingat Meter Air');
    Mail::assertSent(WaterReminderMail::class, 1);
    expect(NotificationLog::count())->toBe(0);
    expect(WaterPeriod::count())->toBe(0);
});
