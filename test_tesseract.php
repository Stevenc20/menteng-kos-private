<?php
$path = 'C:/Users/StevC/.gemini/antigravity/brain/366d108b-5ad8-43fd-80f9-415a77e83756/.user_uploaded/media_1788995386199.jpg';
$src = @imagecreatefromjpeg($path);
if (!$src) { echo "Failed to load image\n"; exit; }
$w = imagesx($src);
$h = imagesy($src);
echo "Width: $w, Height: $h\n";

imagefilter($src, IMG_FILTER_GRAYSCALE);
imagefilter($src, IMG_FILTER_CONTRAST, -20);
imagejpeg($src, 'test_crop.jpg');
exec('tesseract test_crop.jpg stdout -l ind', $out);
echo implode("\n", $out);
