<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationLog extends Model
{
    public const TRIGGER_H4_METER = 'WATER_H4_METER';
    public const TRIGGER_PAYMENT_DUE = 'WATER_PAYMENT_DUE';
    public const TRIGGER_NEW_PERIOD = 'WATER_NEW_PERIOD';
    public const TRIGGER_TEST = 'WATER_TEST';

    protected $casts = [
        'reminder_date' => 'date',
        'sent_at' => 'datetime',
    ];

    public function period(): BelongsTo
    {
        return $this->belongsTo(WaterPeriod::class, 'period_id');
    }
}