<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tenancy extends Model
{
    /**
     * Get the user associated with the tenancy.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the property associated with the tenancy.
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}