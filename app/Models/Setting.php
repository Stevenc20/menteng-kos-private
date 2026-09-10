<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    /**
     * Read a setting value, or return the given default when no row exists.
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $row = static::query()->where('key', $key)->first();

        return $row ? $row->value : $default;
    }

    /**
     * Store a setting value (insert or update the row for the key).
     */
    public static function set(string $key, mixed $value): static
    {
        return static::updateOrCreate(['key' => $key], ['value' => (string) $value]);
    }

    /**
     * All settings as a flat key => value map (for the settings UI).
     */
    public static function map(): array
    {
        return static::query()->pluck('value', 'key')->all();
    }
}