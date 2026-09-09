<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomDocumentationMedia extends Model
{
    protected $fillable = [
        'documentation_id',
        'file_type',
        'file_path',
        'original_name',
        'file_size',
        'mime_type',
    ];

    public function documentation(): BelongsTo
    {
        return $this->belongsTo(RoomDocumentation::class, 'documentation_id');
    }
}