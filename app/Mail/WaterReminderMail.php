<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Professional HTML reminder for the water meter system (H-4, due today, and
 * the next period after a payment is confirmed). Rendered from a Blade
 * template with no external assets so it looks the same everywhere.
 */
class WaterReminderMail extends Mailable
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $data  view data (see mails/water/reminder.blade.php)
     */
    public function __construct(public string $messageSubject, public array $data)
    {
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->messageSubject);
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'mails.water.reminder',
            with: ['data' => $this->data, 'subject' => $this->messageSubject],
        );
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