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

        // 1. Store original securely in private storage
        $originalPath = $file->storeAs("private/properties/{$propertyId}", $fullName);

        // 2. Since the client already compressed and watermarked it, we just copy it to public
        $publicRelativePath = "public/properties/{$propertyId}/{$fullName}";
        
        // Save public version to storage directly from the uploaded file
        Storage::put($publicRelativePath, file_get_contents($file->getRealPath()));

        // We return the storage URL for public path
        return [
            'original_path' => $originalPath,
            'public_path' => Storage::url($publicRelativePath),
        ];
    }
}
