<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Property extends Model
{
    /**
     * Get the media for the property.
     */
    public function media(): HasMany
    {
        return $this->hasMany(PropertyMedia::class);
    }
}
