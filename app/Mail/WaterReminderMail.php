<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class WaterReminderMail extends Mailable
{
    use Queueable;

    /**
     * Create a new message instance.
     */
    public function __construct(public string $messageSubject, public string $bodyHtml)
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
        return new Content(htmlString: nl2br(e($this->bodyHtml)));
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