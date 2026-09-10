<?php

namespace App\Services;

use App\Mail\TestNotificationMail;
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
    public const TRIGGER_TEST = 'WATER_TEST';

    /** Mailers that accept a message but do NOT deliver to an inbox. */
    protected const FAKE_MAILERS = ['log', 'array', 'null'];

    /** Mailers that actually hand the message to a delivery provider. */
    protected const DELIVERY_MAILERS = ['smtp', 'sendmail', 'mailgun', 'postmark', 'ses', 'resend'];

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

    /**
     * True when notifications (reminders) are actually sendable right now.
     *
     * Email is "configured" only when the active Laravel mailer hands the
     * message to a real delivery provider (log/array just write locally).
     */
    public function emailConfigured(): bool
    {
        if (! $this->boolSetting('water.email_enabled', true)) {
            return false;
        }

        return in_array((string) config('mail.default'), self::DELIVERY_MAILERS, true);
    }

    /**
     * True only when a WhatsApp provider with a real driver is configured.
     * No driver is implemented yet, so this stays false until one exists —
     * the panel must never claim WhatsApp is ready when it cannot send.
     */
    public function whatsappConfigured(): bool
    {
        if (! $this->boolSetting('water.whatsapp_enabled', false)) {
            return false;
        }

        $provider = (string) Setting::get('water.whatsapp_provider', '');

        return $provider !== '' && in_array($provider, self::supportedWhatsAppProviders(), true);
    }

    /**
     * WhatsApp providers for which an actual delivery driver exists.
     * Currently none — an empty list is the honest state of the project.
     */
    public static function supportedWhatsAppProviders(): array
    {
        return [];
    }

    /**
     * Manual "Test Email" from the Admin console. Distinguishes REQUEST ACCEPTED
     * from MESSAGE ACTUALLY DELIVERED: with MAIL_MAILER=log the message goes to
     * the local log, not an inbox, so it is reported as FAILED (not delivered).
     *
     * @return array{status: string, message: string, mailer?: string}
     */
    public function sendTestEmail(string $email): array
    {
        $subject = TestNotificationMail::SUBJECT;
        $body = 'Ini adalah email percobaan dari sistem Menteng Kos Private. '
            . 'Konfigurasi notifikasi email berhasil diproses oleh mailer.';

        $status = 'SENT';
        $error = null;

        try {
            Mail::to([$email])->send(new TestNotificationMail);
        } catch (\Throwable $e) {
            $status = 'FAILED';
            $error = $this->sanitizeError($e->getMessage());
        }

        $mailer = (string) config('mail.default');

        if ($status === 'SENT' && in_array($mailer, self::FAKE_MAILERS, true)) {
            $status = 'FAILED';
            $error = "Pesan diteruskan ke mailer \"{$mailer}\" (log lokal, bukan inbox). "
                . 'Konfigurasi MAIL_MAILER=smtp + kredensial SMTP untuk pengiriman yang riil.';
        }

        $this->logTest('EMAIL', $email, $subject, $body, $status, $error);

        $message = $status === 'SENT'
            ? "Test email berhasil dikirim ke {$email}."
            : ($error !== null
                ? "Test email belum sampai ke inbox ({$error})"
                : 'Test email gagal dikirim.');

        return ['status' => $status, 'message' => $message, 'mailer' => $mailer];
    }

    /**
     * Manual "Test WhatsApp" from the Admin console. This never pretends a
     * message was delivered: without a real provider+driver it reports FAILED
     * with a clear reason so the admin knows the channel is not ready.
     *
     * @return array{status: string, message: string}
     */
    public function sendTestWhatsApp(string $number): array
    {
        $subject = '[WATER-TEST] Test WhatsApp Notifikasi - Menteng Kos Private';
        $body = 'Test notifikasi Menteng Kos Private. '
            . 'Reminder meter air otomatis akan menggunakan channel ini.';

        $status = 'FAILED';
        $error = null;

        if (! $this->boolSetting('water.whatsapp_enabled', false)) {
            $error = 'WhatsApp dinonaktifkan (water.whatsapp_enabled=0). Aktifkan di Pengaturan Meter Air.';
        } else {
            $provider = (string) Setting::get('water.whatsapp_provider', '');

            if ($provider === '' || ! in_array($provider, self::supportedWhatsAppProviders(), true)) {
                $error = 'WhatsApp belum dikonfigurasi. Hubungkan provider WhatsApp/API terlebih dahulu.';
            } else {
                $error = "Provider \"{$provider}\" belum memiliki driver pengiriman terpasang.";
            }
        }

        $this->logTest('WHATSAPP', $number, $subject, $body, $status, $error);

        return ['status' => $status, 'message' => $error];
    }

    /**
     * Record a manual test notification (purpose=TEST).
     */
    protected function logTest(string $channel, string $recipient, string $subject, string $body, string $status, ?string $error): void
    {
        NotificationLog::create([
            'period_id' => null,
            'trigger' => self::TRIGGER_TEST,
            'channel' => $channel,
            'recipient' => $recipient,
            'subject' => $subject,
            'body' => $body,
            'status' => $status,
            'error' => $error,
            'reminder_date' => null,
            'purpose' => 'TEST',
            'sent_at' => $status === 'SENT' ? now() : null,
        ]);
    }

    /**
     * Never leak credentials/secrets into UI or the notification log.
     */
    protected function sanitizeError(string $message): string
    {
        if (preg_match('/password|token|secret|api_key|credential|key/i', $message)) {
            return 'terjadi kesalahan pada koneksi mail server (detail aman disembunyikan)';
        }

        return mb_substr($message, 0, 300);
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