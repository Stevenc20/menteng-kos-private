<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$extractor = app(\App\Services\KtpFieldExtractor::class);

$mockData = [
    // Inline NIK
    ["box" => [[20, 80], [300, 80], [300, 100], [20, 100]], "text" => "NIK : 1607032605010001", "confidence" => 0.99],
    // Inline Nama
    ["box" => [[20, 120], [250, 120], [250, 140], [20, 140]], "text" => "Nama SATRIO MUSLIM WIBOWO", "confidence" => 0.95],
];

$result = $extractor->extract($mockData);
print_r($result);
