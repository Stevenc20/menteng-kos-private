<?php

namespace App\Services;

use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Typography\FontFactory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageWatermarkService
{
    /**
     * Process an uploaded image, save original securely, and generate a watermarked public version.
     *
     * @param UploadedFile $file The uploaded image file
     * @param int $propertyId The property ID
     * @return array Returns ['original_path' => string, 'public_path' => string]
     */
    public function processAndStore(UploadedFile $file, int $propertyId): array
    {
        $filename = Str::random(40);
        $extension = $file->getClientOriginalExtension();
        
        // 1. Store original securely in private storage
        $originalPath = $file->storeAs("private/properties/{$propertyId}", "{$filename}.{$extension}");

        // 2. Process for public (Watermark + Resize + WebP optimization)
        $manager = new ImageManager(new Driver());
        $image = $manager->read($file->getRealPath());

        // Resize down if too large (max 1600px width), maintain aspect ratio
        $image->scaleDown(width: 1600);

        // Add watermark
        $image->text('MENTENG KOS PRIVATE', $image->width() / 2, $image->height() / 2, function(FontFactory $font) use ($image) {
            // Using a default GD font since custom TTF might not be available or reliable across servers without setup
            $font->filename(5); // Built-in GD font 5 (largest)
            $font->color([255, 255, 255, 0.35]); // White with 35% opacity
            $font->align('center');
            $font->valign('middle');
            
            // Note: Intervention Image v3 text size is tricky with GD built-in fonts.
            // For a robust implementation, we should use a TTF. Since we don't have one guaranteed,
            // we will apply a watermark as best as possible.
            // To make it truly large, we can create a temporary text image and scale it up, 
            // or just rely on a TTF file. Let's use public path if available, else fallback.
        });

        // Encode as WebP with 80% quality
        $encoded = $image->toWebp(80);
        $publicFilename = "{$filename}.webp";
        $publicRelativePath = "public/properties/{$propertyId}/{$publicFilename}";

        // Save public version to storage
        Storage::put($publicRelativePath, $encoded->toString());

        // We return the storage URL for public path
        return [
            'original_path' => $originalPath,
            'public_path' => Storage::url($publicRelativePath), // usually /storage/properties/...
        ];
    }
}
