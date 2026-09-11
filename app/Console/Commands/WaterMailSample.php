<?php

namespace App\Console\Commands;

use App\Models\Property;
use App\Models\Setting;
use App\Models\WaterPeriod;
use App\Services\WaterNotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Sends the REAL scheduler email — same professional subject and HTML template
 * used by water:send-reminders — for a chosen unit and trigger, WITHOUT writing
 * anything to the database. No tenant/unit/period/notification-log row is ever
 * created or modified, so it is safe to run at any time to preview what the
 * automatic reminder will look like in Gmail.
 */
class WaterMailSample extends Command
{
    protected $signature = 'water:mail-sample
        {--trigger=h4 : Jenis contoh: h4 | due | new}
        {--unit= : property id unit (default: unit pertama yang tersedia)}
        {--due= : tanggal jatuh tempo contoh (YYYY-MM-DD)}
        {--to= : penerima contoh (default: WATER_ADMIN_EMAIL / admin terdaftar)}';

    protected $description = 'Kirim contoh email reminder meter air versi asli scheduler — TANPA menyentuh data tenant/unit/log.';

    public function handle(WaterNotificationService $notificationService): int
    {
        $trigger = match ($this->option('trigger')) {
            'h4' => WaterNotificationService::TRIGGER_H4_METER,
            'due' => WaterNotificationService::TRIGGER_PAYMENT_DUE,
            'new' => WaterNotificationService::TRIGGER_NEW_PERIOD,
            default => null,
        };

        if ($trigger === null) {
            $this->error('--trigger harus salah satu: h4 | due | new');

            return self::INVALID;
        }

        $property = $this->option('unit')
            ? Property::find((int) $this->option('unit'))
            : Property::query()->orderBy('id')->first();

        if (! $property) {
            $this->error('Tidak ada unit terdaftar. Buat unit/kamar terlebih dahulu di sistem.');

            return self::INVALID;
        }

        $tenant = $property->currentTenancy()?->user;

        $reminderDays = (int) Setting::get('water.reminder_days', 4);
        $defaultDue = $trigger === WaterNotificationService::TRIGGER_PAYMENT_DUE
            ? Carbon::today()
            : Carbon::today()->addDays($reminderDays);
        $due = $this->option('due') ? Carbon::parse($this->option('due')) : $defaultDue;

        $hasEnd = $trigger !== WaterNotificationService::TRIGGER_H4_METER;

        $period = new WaterPeriod;
        $period->property()->associate($property);
        $period->tenant()->associate($tenant);
        $period->period_month = (int) now()->month;
        $period->period_year = now()->year;
        $period->meter_start = 125;
        $period->meter_end = $hasEnd ? 138 : null;
        $period->usage = $hasEnd ? 13 : null;
        $period->water_rate = 8000;
        $period->total_amount = $hasEnd ? 104000 : null;
        $period->due_date = $due;

        $result = $notificationService->preview($trigger, $period, $this->option('to') ?: null);

        $this->line('');
        $this->info('Ringkasan email contoh:');
        $this->line('  Unit     : '.$property->name);
        $this->line('  Trigger  : '.$trigger);
        $this->line('  Subjek   : '.$result['subject']);
        $this->line('  Penerima : '.implode(', ', $result['recipients']));
        $this->line('  Status   : '.$result['status'].' — '.$result['message']);
        $this->line('');
        $this->warn('Tidak ada data yang dibuat/diubah: tenant, unit, periode, maupun notification_log tetap utuh.');

        return $result['status'] === 'SENT' ? self::SUCCESS : self::FAILURE;
    }
}
