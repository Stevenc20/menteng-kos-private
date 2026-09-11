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
 *  - EMAIL   : professional HTML email via Laravel Mail (SMTP). Dedupe per
 *              (period, trigger, channel, day) PLUS a one-shot guard so a
 *              reminder type is ever delivered only once per period.
 *  - WHATSAPP: abstraction only. Until a real provider + driver exists the
 *              delivery is logged as SKIPPED with a clear reason — this service
 *              NEVER pretends a WhatsApp was delivered.
 *
 * Status honesty: "SENT" means the mailer accepted the message for delivery;
 * the app cannot claim inbox delivery (no tracking). With log/array/null
 * mailers a test email is reported FAILED because it never leaves the machine.
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

    protected const MONTHS_ID = [1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    public function notifyPeriod(WaterPeriod $period, string $trigger): void
    {
        $reminderDate = now()->toDateString();

        $subject = $this->subject($trigger, $period);
        $body = $this->body($trigger, $period);
        $data = $this->viewData($trigger, $period);

        // ----- EMAIL -----
        if ($this->alreadyDelivered($period, $trigger, 'EMAIL')) {
            return; // a reminder type is only ever delivered once per period
        }

        if ($this->boolSetting('water.email_enabled', true)) {
            $this->viaEmail($period, $trigger, $subject, $body, $data, $reminderDate);
        } else {
            $this->log($period, $trigger, 'EMAIL', $subject, 'Email dinonaktifkan (water.email_enabled=0).', 'SKIPPED', $reminderDate);
        }

        // ----- WHATSAPP (abstraction only) -----
        if ($this->alreadyTried($period, $trigger, 'WHATSAPP')) {
            return;
        }

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
     * Email recipients: a configured WATER_ADMIN_EMAIL (setting or env) wins;
     * otherwise all registered ADMIN/SUPER_ADMIN users with an email.
     */
    protected function adminRecipients(): array
    {
        $configured = trim((string) Setting::get('water.to_admin_email', (string) env('WATER_ADMIN_EMAIL', '')));

        if ($configured !== '') {
            return [$configured];
        }

        return User::query()
            ->whereIn('role', ['ADMIN', 'SUPER_ADMIN'])
            ->whereNotNull('email')
            ->pluck('email')
            ->all();
    }

    /**
     * True only when a notification log already recorded a real SENT delivery
     * for this (period, trigger, channel) — regardless of the day. Makes a
     * reminder type one-shot ever per period, while FAILED logs can be retried.
     */
    protected function alreadyDelivered(WaterPeriod $period, string $trigger, string $channel): bool
    {
        return NotificationLog::query()
            ->where('period_id', $period->id)
            ->where('trigger', $trigger)
            ->where('channel', $channel)
            ->where('purpose', 'REMINDER')
            ->where('status', 'SENT')
            ->whereNotNull('reminder_date')
            ->exists();
    }

    /**
     * True when any reminder row exists for this (period, trigger, channel)
     * regardless of its outcome — used so the WhatsApp channel (which can only
     * SKIP today) is not re-evaluated on every daily run.
     */
    protected function alreadyTried(WaterPeriod $period, string $trigger, string $channel): bool
    {
        return NotificationLog::query()
            ->where('period_id', $period->id)
            ->where('trigger', $trigger)
            ->where('channel', $channel)
            ->where('purpose', 'REMINDER')
            ->exists();
    }

    protected function viaEmail(WaterPeriod $period, string $trigger, string $subject, string $body, array $data, string $reminderDate): void
    {
        if ($this->alreadyLogged($period, $trigger, 'EMAIL', $reminderDate)) {
            return;
        }

        $recipients = $this->adminRecipients();

        if (empty($recipients)) {
            $this->log($period, $trigger, 'EMAIL', $subject, 'Tidak ada email admin yang terdaftar. Pesan TIDAK dikirim.', 'SKIPPED', $reminderDate);

            return;
        }

        try {
            Mail::to($recipients)->send(new WaterReminderMail($subject, $data));
            $this->log($period, $trigger, 'EMAIL', $subject, 'Email reminder terkirim ke: '.implode(', ', $recipients).\PHP_EOL.$body, 'SENT', $reminderDate);
        } catch (\Throwable $e) {
            $this->log($period, $trigger, 'EMAIL', $subject, 'Gagal mengirim email: '.$this->sanitizeError($e->getMessage()), 'FAILED', $reminderDate);
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
                ? implode(', ', $this->adminRecipients())
                : (string) Setting::get('water.to_admin_whatsapp', env('WATER_ADMIN_WHATSAPP', '081291903483')),
            'subject' => $subject,
            'body' => $body,
            'status' => $status,
            'error' => $status === 'SENT' ? null : $body,
            'reminder_date' => $reminderDate,
            'purpose' => 'REMINDER',
            'sent_at' => $status === 'SENT' ? now() : null,
        ]);
    }

    // ---------------------------------------------------------------------
    // Manual test notifications (Admin → Air → Test Notifikasi)
    // ---------------------------------------------------------------------

    /**
     * True when notifications (reminders) are actually sendable right now.
     */
    public function emailConfigured(): bool
    {
        if (! $this->boolSetting('water.email_enabled', true)) {
            return false;
        }

        return in_array((string) config('mail.default'), self::DELIVERY_MAILERS, true);
    }

    public function whatsappConfigured(): bool
    {
        if (! $this->boolSetting('water.whatsapp_enabled', false)) {
            return false;
        }

        $provider = (string) Setting::get('water.whatsapp_provider', '');

        return $provider !== '' && in_array($provider, self::supportedWhatsAppProviders(), true);
    }

    public static function supportedWhatsAppProviders(): array
    {
        return [];
    }

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

    // ---------------------------------------------------------------------
    // Content builders
    // ---------------------------------------------------------------------

    protected function subject(string $trigger, WaterPeriod $period): string
    {
        $unit = $period->property?->name ?? "Unit #{$period->property_id}";

        return match ($trigger) {
            self::TRIGGER_H4_METER => "Reminder Meter Air — H-4 — {$unit}",
            self::TRIGGER_PAYMENT_DUE => "Meter Air Jatuh Tempo Hari Ini — {$unit}",
            self::TRIGGER_NEW_PERIOD => "Update Meter Air Berikutnya — {$unit}",
            default => "Reminder Meter Air — {$unit}",
        };
    }

    /**
     * Human-readable body (also stored in the notification log).
     */
    protected function body(string $trigger, WaterPeriod $period): string
    {
        $unit = $period->property?->name ?? "Unit #{$period->property_id}";
        $tenant = $period->tenant?->name ?? '-';
        $amount = $period->total_amount !== null ? 'Rp '.number_format((float) $period->total_amount, 0, ',', '.') : '-';

        $header = match ($trigger) {
            self::TRIGGER_H4_METER => "Pencatatan meter air unit {$unit} (penghuni: {$tenant}) akan jatuh tempo dalam ".Setting::get('water.reminder_days', 4).' hari.',
            self::TRIGGER_PAYMENT_DUE => "Periode meter air unit {$unit} (penghuni: {$tenant}) telah memasuki tanggal jatuh tempo.",
            self::TRIGGER_NEW_PERIOD => "Pembayaran meter air unit {$unit} (penghuni: {$tenant}) dikonfirmasi. Catat meter akhir untuk periode berikutnya.",
            default => 'Notifikasi meter air.',
        };

        return "{$header}\n"
            . "Periode: {$this->periodLabel($period)}\n"
            . "Jatuh tempo: {$period->due_date?->toDateString()}\n"
            . "Meter awal: {$this->fmt($period->meter_start)}\n"
            . "Meter akhir: {$this->fmt($period->meter_end)}\n"
            . "Pemakaian: ".(($period->usage !== null) ? number_format((int) $period->usage).' m³' : '-')."\n"
            . "Wajib bayar: {$amount}\n"
            . 'Silakan cek /admin/water.';
    }

    /**
     * Data for the professional HTML Blade template (mails/water/reminder).
     *
     * @return array<string, mixed>
     */
    protected function viewData(string $trigger, WaterPeriod $period): array
    {
        $unit = $period->property?->name ?? "Unit #{$period->property_id}";
        $tenant = $period->tenant?->name ?? '-';
        $dueDateParts = $period->due_date
            ? $period->due_date->format('d').' '.self::MONTHS_ID[(int) $period->due_date->format('n')].' '.$period->due_date->format('Y')
            : '-';

        $data = [
            'unit' => $unit,
            'tenant' => $tenant,
            'period' => $this->periodLabel($period),
            'due_date' => $dueDateParts,
            'meter_start' => $this->fmt($period->meter_start).' m³',
            'meter_end' => $period->meter_end !== null ? $this->fmt($period->meter_end).' m³' : 'Belum tercatat',
            'usage' => $period->usage !== null ? number_format((int) $period->usage).' m³' : '-',
            'amount' => $period->total_amount !== null ? 'Rp '.number_format((float) $period->total_amount, 0, ',', '.') : '-',
            'header_tagline' => 'Sistem Meter Air',
            'action_label' => 'Update Meter Air',
            'action_url' => route('admin.water.show', ['property' => $period->property_id]),
        ];

        if ($trigger === self::TRIGGER_H4_METER) {
            $days = Setting::get('water.reminder_days', 4);

            return array_merge($data, [
                'title' => 'Reminder Meter Air',
                'intro' => "Halo Admin, ini adalah pengingat bahwa pencatatan meter air untuk unit berikut akan memasuki jatuh tempo dalam {$days} hari.",
                'rows' => [
                    ['Unit', e($unit)],
                    ['Tenant', e($tenant)],
                    ['Periode', e($data['period'])],
                    ['Jatuh Tempo', e($data['due_date'])],
                    ['Meter Awal', e($data['meter_start'])],
                ],
                'status_badge' => 'Menunggu Update Meter',
                'status_color' => '#B45309',
                'actions_title' => 'Tindakan yang diperlukan',
                'actions' => ['Update meter air.', 'Foto meter air terbaru.', 'Simpan hasil pembacaan meter.'],
                'note' => 'Periode yang belum di-update tetap berjalan. Data penghuni dan unit tidak berubah.',
            ]);
        }

        if ($trigger === self::TRIGGER_PAYMENT_DUE) {
            return array_merge($data, [
                'title' => 'Meter Air Jatuh Tempo Hari Ini',
                'intro' => 'Halo Admin, periode meter air berikut telah memasuki tanggal jatuh tempo.',
                'rows' => [
                    ['Unit', e($unit)],
                    ['Tenant', e($tenant)],
                    ['Periode', e($data['period'])],
                    ['Jatuh Tempo', e($data['due_date'])],
                    ['Meter Awal', e($data['meter_start'])],
                    ['Meter Akhir', e($data['meter_end'])],
                ],
                'status_badge' => 'Menunggu Update / Pembayaran',
                'status_color' => '#B91C1C',
                'actions_title' => 'Tindakan yang diperlukan',
                'actions' => ['Mohon lakukan update meter air.', 'Unggah foto meter air terbaru.', 'Setelah tagihan tersedia, konfirmasi pembayaran.'],
                'note' => 'Periode yang melewati jatuh tempo tetap harus dicatat pada kesempatan pertama. Data penghuni dan unit tidak berubah.',
            ]);
        }

        // WATER_NEW_PERIOD — next METER_DUE period after the payment was confirmed
        return array_merge($data, [
            'title' => 'Update Meter Air Berikutnya',
            'intro' => 'Halo Admin, pembayaran meter air telah dikonfirmasi. Silakan lakukan pencatatan meter akhir untuk melanjutkan periode berikutnya.',
            'rows' => [
                ['Unit', e($unit)],
                ['Tenant', e($tenant)],
                ['Periode', e($data['period'])],
                ['Jatuh Tempo', e($data['due_date'])],
                ['Meter Awal', e($data['meter_start'])],
                ['Meter Akhir', e($data['meter_end'])],
                ['Status Pembayaran', 'PAID'],
                ['Status Meter', 'Menunggu Update Meter'],
            ],
            'status_badge' => 'Menunggu Update Meter',
            'status_color' => '#1E6F50',
            'actions_title' => 'Tindakan yang diperlukan',
            'actions' => ['Buka unit ini pada halaman Meter Air.', 'Catat pembacaan meter akhir.', 'Upload foto meter terbaru.'],
            'note' => 'Meter akhir periode sebelumnya otomatis menjadi meter awal periode ini — tidak perlu dimasukkan ulang.',
        ]);
    }

    protected function periodLabel(WaterPeriod $period): string
    {
        $month = self::MONTHS_ID[(int) $period->period_month] ?? $period->period_month;

        return "{$month} {$period->period_year}";
    }

    protected function fmt(int|float|null $value): string
    {
        return $value === null ? '-' : number_format((int) $value);
    }

    protected function boolSetting(string $key, bool $default): bool
    {
        $value = Setting::get($key, $default ? '1' : '0');

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}