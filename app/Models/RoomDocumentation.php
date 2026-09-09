<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RoomDocumentation extends Model
{
    protected $fillable = [
        'property_id',
        'tenancy_id',
        'documentation_type',
        'documentation_date',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'documentation_date' => 'date',
    ];

    public function tenancy(): BelongsTo
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function media(): HasMany
    {
        return $this->hasMany(RoomDocumentationMedia::class, 'documentation_id');
    }
}