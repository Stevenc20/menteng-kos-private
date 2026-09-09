<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageWatermarkService
{
    /**
     * Store the client-processed image securely and publicly.
     * Note: Watermark and compression are now handled by the client-side canvas
     * to prevent PHP memory limits and GD library errors.
     *
     * @param UploadedFile $file The uploaded image file
     * @param int $propertyId The property ID
     * @return array Returns ['original_path' => string, 'public_path' => string]
     */
    public function processAndStore(UploadedFile $file, int $propertyId): array
    {
        $filename = Str::random(40);
        $extension = $file->getClientOriginalExtension() ?: 'webp';
        
        $fullName = "{$filename}.{$extension}";

        // 1. Store original securely in private storage (local disk)
        $originalPath = "properties/{$propertyId}/originals/{$fullName}";
        Storage::disk('local')->putFileAs("properties/{$propertyId}/originals", $file, $fullName);

        // 2. Save public version to public disk directly from the uploaded file
        $publicRelativePath = "properties/{$propertyId}/{$fullName}";
        Storage::disk('public')->putFileAs("properties/{$propertyId}", $file, $fullName);

        // We return the storage URL for public path
        return [
            'original_path' => $originalPath,
            'public_path' => $publicRelativePath, // Save relative path to DB
        ];
    }
}
