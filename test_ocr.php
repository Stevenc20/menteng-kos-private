<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$service = app(\App\Services\KtpOcrService::class);
$path = 'C:/Users/StevC/.gemini/antigravity/brain/366d108b-5ad8-43fd-80f9-415a77e83756/.user_uploaded/media_1788995386199.jpg';

// Crop the screenshot to get just the KTP part
$src = @imagecreatefromjpeg($path);
$crop = imagecrop($src, ['x' => 100, 'y' => 900, 'width' => 880, 'height' => 560]);
$cropPath = 'test_ocr_crop.jpg';
imagejpeg($crop, $cropPath);

$result = $service->extract($cropPath);
print_r($result);
