<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PropertyMedia extends Model
{
    /**
     * Get the property that owns the media.
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
