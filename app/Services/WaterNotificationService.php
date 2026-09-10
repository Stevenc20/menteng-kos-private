<?php

namespace App\Services;

use App\Mail\WaterReminderMail;
use App\Models\NotificationLog;
use App\Models\Setting;
use App\Models\User;
use App\Models\WaterPeriod;
use Illuminate\Support\Facades\Mail;

/**
 * Sends water reminders to the ADMIN (never to tenants in v1).
 *
 * Channels:
 *  - EMAIL   : a real mail shipment through the configured Laravel mailer
 *              (MAIL_MAILER=log on staging still routes through the mailer).
 *  - WHATSAPP: abstraction only. Until a real provider + credential exists the
 *              delivery is logged as SKIPPED with a clear reason — this service
 *              NEVER pretends a WhatsApp was delivered.
 *
 * Dedupe: one NotificationLog row per (period, trigger, channel, date).
 */
class WaterNotificationService
{
    public const TRIGGER_H4_METER = 'WATER_H4_METER';
    public const TRIGGER_PAYMENT_DUE = 'WATER_PAYMENT_DUE';
    public const TRIGGER_NEW_PERIOD = 'WATER_NEW_PERIOD';

    public function notifyPeriod(WaterPeriod $period, string $trigger): void
    {
        $reminderDate = now()->toDateString();

        $subject = $this->subject($trigger, $period);
        $body = $this->body($trigger, $period);

        // ----- EMAIL -----
        if ($this->boolSetting('water.email_enabled', true)) {
            $this->viaEmail($period, $trigger, $subject, $body, $reminderDate);
        } else {
            $this->log($period, $trigger, 'EMAIL', $subject, "Email dinonaktifkan (water.email_enabled=0).", 'SKIPPED', $reminderDate);
        }

        // ----- WHATSAPP -----
        $waNumber = (string) Setting::get('water.to_admin_whatsapp', env('WATER_ADMIN_WHATSAPP', '081291903483'));

        if (! $this->boolSetting('water.whatsapp_enabled', false)) {
            $this->log($period, $trigger, 'WHATSAPP', $subject, "WhatsApp dinonaktifkan (water.whatsapp_enabled=0). Nomor admin: {$waNumber}. Pesan TIDAK dikirim.", 'SKIPPED', $reminderDate);

            return;
        }

        $provider = (string) Setting::get('water.whatsapp_provider', '');

        if ($provider === '') {
            $this->log($period, $trigger, 'WHATSAPP', $subject, "WhatsApp provider belum dikonfigurasi (set \"water.whatsapp_provider\" + credential). Nomor admin: {$waNumber}. Pesan TIDAK dikirim.", 'SKIPPED', $reminderDate);

            return;
        }

        $this->log($period, $trigger, 'WHATSAPP', $subject, "Provider \"{$provider}\" belum diimplementasikan. Pesan TIDAK dikirim.", 'SKIPPED', $reminderDate);
    }

    protected function viaEmail(WaterPeriod $period, string $trigger, string $subject, string $body, string $reminderDate): void
    {
        if ($this->alreadyLogged($period, $trigger, 'EMAIL', $reminderDate)) {
            return;
        }

        $recipients = User::query()
            ->whereIn('role', ['ADMIN', 'SUPER_ADMIN'])
            ->whereNotNull('email')
            ->pluck('email')
            ->all();

        if (empty($recipients)) {
            $this->log($period, $trigger, 'EMAIL', $subject, 'Tidak ada email admin yang terdaftar. Pesan TIDAK dikirim.', 'SKIPPED', $reminderDate);

            return;
        }

        try {
            Mail::to($recipients)->send(new WaterReminderMail($subject, $body));
            $this->log($period, $trigger, 'EMAIL', $subject, 'Email terkirim ke: '.implode(', ', $recipients), 'SENT', $reminderDate);
        } catch (\Throwable $e) {
            $this->log($period, $trigger, 'EMAIL', $subject, 'Gagal mengirim email: '.$e->getMessage(), 'FAILED', $reminderDate);
        }
    }

    protected function alreadyLogged(WaterPeriod $period, string $trigger, string $channel, string $reminderDate): bool
    {
        return NotificationLog::query()
            ->where('period_id', $period->id)
            ->where('trigger', $trigger)
            ->where('channel', $channel)
            ->where('reminder_date', $reminderDate)
            ->exists();
    }

    protected function log(WaterPeriod $period, string $trigger, string $channel, string $subject, string $body, string $status, string $reminderDate): void
    {
        if ($this->alreadyLogged($period, $trigger, $channel, $reminderDate)) {
            return;
        }

        NotificationLog::create([
            'period_id' => $period->id,
            'trigger' => $trigger,
            'channel' => $channel,
            'recipient' => $channel === 'EMAIL'
                ? implode(', ', User::query()->whereIn('role', ['ADMIN', 'SUPER_ADMIN'])->whereNotNull('email')->pluck('email')->all())
                : (string) Setting::get('water.to_admin_whatsapp', env('WATER_ADMIN_WHATSAPP', '081291903483')),
            'subject' => $subject,
            'body' => $body,
            'status' => $status,
            'error' => $status === 'SENT' ? null : $body,
            'reminder_date' => $reminderDate,
        ]);
    }

    /**
     * H-4 reminder: meter-end reading is due soon.
     */
    protected function subject(string $trigger, WaterPeriod $period): string
    {
        $unit = $period->property?->name ?? "Unit #{$period->property_id}";

        return match ($trigger) {
            self::TRIGGER_H4_METER => "[PAM] H-4: Foto meter akhir {$unit}",
            self::TRIGGER_PAYMENT_DUE => "[PAM] Tagihan air {$unit} jatuh tempo",
            self::TRIGGER_NEW_PERIOD => "[PAM] Periode baru {$unit} dimulai",
            default => "[PAM] Notifikasi {$unit}",
        };
    }

    /**
     * Human-readable body (also stored in the notification log).
     */
    protected function body(string $trigger, WaterPeriod $period): string
    {
        $unit = $period->property?->name ?? "Unit #{$period->property_id}";
        $tenant = $period->tenant?->name ?? '-';

        $start = $period->meter_start !== null ? number_format((int) $period->meter_start) : '-';
        $end = $period->meter_end !== null ? number_format((int) $period->meter_end) : 'Belum dicatat';
        $usage = $period->usage !== null ? number_format((int) $period->usage).' m³' : '-';
        $due = $period->due_date?->toDateString() ?? '-';
        $amount = $period->total_amount !== null ? 'Rp '.number_format((float) $period->total_amount, 0, ',', '.') : '-';

        $header = match ($trigger) {
            self::TRIGGER_H4_METER => "Meter air unit {$unit} (penghuni: {$tenant}) perlu difoto meter akhirnya sebelum jatuh tempo.",
            self::TRIGGER_PAYMENT_DUE => "Tagihan air unit {$unit} (penghuni: {$tenant}) sudah jatuh tempo dan belum dibayar.",
            self::TRIGGER_NEW_PERIOD => "Periode air baru unit {$unit} (penghuni: {$tenant}) sudah dimulai. Meter akhir periode sebelumnya menjadi meter awal periode ini.",
            default => 'Notifikasi meter air.',
        };

        return "{$header}\n"
            . "Meter awal: {$start}\n"
            . "Meter akhir: {$end}\n"
            . "Pemakaian: {$usage}\n"
            . "Wajib bayar: {$amount}\n"
            . "Jatuh tempo: {$due}\n"
            . "Silakan cek /admin/water.";
    }

    protected function boolSetting(string $key, bool $default): bool
    {
        $value = Setting::get($key, $default ? '1' : '0');

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}