<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agreement extends Model
{
    protected $casts = [
        'signed_at' => 'datetime',
        'revised_at' => 'datetime',
    ];

    public function tenancy(): BelongsTo
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(AgreementSignature::class);
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(AgreementRevision::class)->orderByDesc('version');
    }
}
