<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaterPeriod extends Model
{
    /**
     * Status values used by the period state machine:
     *  - METER_DUE      : period started, waiting for the meter-end reading
     *  - WAITING_PAYMENT: end recorded + amount computed, waiting for payment
     *  - PAID           : payment confirmed; period closed (next period continues)
     */
    public const STATUS_METER_DUE = 'METER_DUE';
    public const STATUS_WAITING_PAYMENT = 'WAITING_PAYMENT';
    public const STATUS_PAID = 'PAID';

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'meter_start' => 'integer',
            'meter_start_recorded_at' => 'datetime',
            'meter_end' => 'integer',
            'meter_end_recorded_at' => 'datetime',
            'usage' => 'integer',
            'billable_usage' => 'integer',
            'water_rate' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'due_date' => 'date',
            'paid_at' => 'datetime',
        ];
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function tenancy(): BelongsTo
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tenant_id');
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public static function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_METER_DUE, self::STATUS_WAITING_PAYMENT]);
    }
}