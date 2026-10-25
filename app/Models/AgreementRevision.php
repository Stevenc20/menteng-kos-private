<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgreementRevision extends Model
{
    protected $casts = [
        'previous_terms_snapshot' => 'array',
        'new_terms_snapshot' => 'array',
    ];

    public function agreement(): BelongsTo
    {
        return $this->belongsTo(Agreement::class);
    }

    public function tenancy(): BelongsTo
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function revisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revised_by');
    }
}
