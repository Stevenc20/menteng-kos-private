<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomDocumentationMedia extends Model
{
    protected $fillable = [
        'documentation_id',
        'file_type',
        'source',
        'property_media_id',
        'file_path',
        'original_name',
        'file_size',
        'mime_type',
    ];

    protected $appends = ['url'];

    public function documentation(): BelongsTo
    {
        return $this->belongsTo(RoomDocumentation::class, 'documentation_id');
    }

    public function propertyMedia(): BelongsTo
    {
        return $this->belongsTo(PropertyMedia::class, 'property_media_id');
    }

    /**
     * Resolved public URL for the stored file.
     *
     * New snapshots are stored on the public disk under `room_documentations/...`
     * (served via the /storage symlink). Some legacy rows store absolute URLs or
     * `public/`-prefixed paths, which we normalize here so the UI + statement
     * injection always get a working URL.
     */
    public function getUrlAttribute(): string
    {
        if (empty($this->file_path)) {
            return '';
        }

        if (str_starts_with($this->file_path, 'http://') || str_starts_with($this->file_path, 'https://')) {
            if (str_contains($this->file_path, 'http://localhost')) {
                return str_replace('http://localhost', config('app.url'), $this->file_path);
            }

            return $this->file_path;
        }

        if (str_starts_with($this->file_path, '/storage')) {
            return $this->file_path;
        }

        $path = str_replace('public/', '', $this->file_path);

        return '/storage/'.ltrim($path, '/');
    }
}
