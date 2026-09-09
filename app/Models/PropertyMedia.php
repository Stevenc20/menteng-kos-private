<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PropertyMedia extends Model
{
    protected $appends = ['url'];

    /**
     * Get the property that owns the media.
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * Get the resolved public URL for the media.
     */
    public function getUrlAttribute(): string
    {
        if (empty($this->public_path)) {
            return '';
        }

        // If it's already an absolute URL (legacy or from another disk), return as is
        if (str_starts_with($this->public_path, 'http://') || str_starts_with($this->public_path, 'https://')) {
            // Fix legacy localhost URLs if accessing from production
            if (str_contains($this->public_path, 'http://localhost')) {
                return str_replace('http://localhost', config('app.url'), $this->public_path);
            }
            return $this->public_path;
        }

        // If it starts with /storage, just return it relative to current domain
        if (str_starts_with($this->public_path, '/storage')) {
            return $this->public_path;
        }

        // Clean up paths that accidentally have public/ prefixed
        $cleanPath = str_replace('public/', '', $this->public_path);
        
        return \Illuminate\Support\Facades\Storage::disk('public')->url($cleanPath);
    }
}
