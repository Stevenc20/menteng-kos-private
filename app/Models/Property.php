<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Property extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'facilities' => 'array',
        ];
    }

    /**
     * Get the media for the property.
     */
    public function media(): HasMany
    {
        return $this->hasMany(PropertyMedia::class);
    }

    /**
     * Water meter periods, newest first (per-unit history).
     */
    public function waterPeriods(): HasMany
    {
        return $this->hasMany(WaterPeriod::class)->latest('period_year')->latest('period_month')->latest('id');
    }

    /**
     * The single currently open water period (METER_DUE / WAITING_PAYMENT), if any.
     */
    public function openWaterPeriod(): ?WaterPeriod
    {
        return $this->waterPeriods()->whereIn('status', ['METER_DUE', 'WAITING_PAYMENT'])->first();
    }

    /**
     * The tenancy currently occupying this unit (ACTIVE), if any.
     */
    public function currentTenancy(): ?Tenancy
    {
        return $this->hasOne(Tenancy::class)->where('status', 'ACTIVE')->latest('id')->first();
    }
}
