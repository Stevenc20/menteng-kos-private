<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Manual "Test Notification" email. Fixed subject/body so the admin can
 * verify the mail pipeline before the automatic reminders are enabled.
 */
class TestNotificationMail extends Mailable
{
    use Queueable;

    public const SUBJECT = 'Test Notifikasi Meter Air - Menteng Kos Private';

    protected string $messageBody = "Ini adalah email percobaan dari sistem Menteng Kos Private.\n\n"
        . "Jika Anda menerima email ini, konfigurasi notifikasi email berhasil.\n\n"
        . 'Notifikasi reminder meter air nantinya akan dikirim melalui sistem yang sama.';

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(subject: self::SUBJECT);
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(htmlString: nl2br(e($this->messageBody)));
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}