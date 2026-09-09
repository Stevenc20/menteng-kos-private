<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

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

    /**
     * Room documentation entries (MOVE_IN / MOVE_OUT) for this tenancy.
     */
    public function roomDocumentations(): HasMany
    {
        return $this->hasMany(RoomDocumentation::class);
    }

    /**
     * The move-in documentation entry, if any.
     */
    public function moveInDocumentation(): HasOne
    {
        return $this->hasOne(RoomDocumentation::class)
            ->where('documentation_type', 'MOVE_IN');
    }
}