<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$extractor = app(\App\Services\KtpFieldExtractor::class);

$mockData = [
    ["box" => [[20, 20], [100, 20], [100, 40], [20, 40]], "text" => "PROVINSI SUMATERA SELATAN", "confidence" => 0.99],
    ["box" => [[20, 45], [100, 45], [100, 65], [20, 65]], "text" => "KABUPATEN BANYUASIN", "confidence" => 0.98],
    
    // NIK label and value
    ["box" => [[20, 80], [60, 80], [60, 100], [20, 100]], "text" => "NIK", "confidence" => 0.99],
    ["box" => [[80, 80], [300, 80], [300, 100], [80, 100]], "text" => ": 1607032605010001", "confidence" => 0.97],
    
    // Nama label and value
    ["box" => [[20, 120], [70, 120], [70, 140], [20, 140]], "text" => "Nama", "confidence" => 0.99],
    ["box" => [[90, 120], [250, 120], [250, 140], [90, 140]], "text" => "SATRIO MUSLIM WIBOWO", "confidence" => 0.95],

    // Tempat/Tgl Lahir
    ["box" => [[20, 150], [90, 150], [90, 170], [20, 170]], "text" => "Tempat/Tgl Lahir", "confidence" => 0.96],
    ["box" => [[100, 150], [300, 150], [300, 170], [100, 170]], "text" => ": PALEMBANG, 26-05-2001", "confidence" => 0.97],

    // Jenis kelamin
    ["box" => [[20, 180], [90, 180], [90, 200], [20, 200]], "text" => "Jenis Kelamin", "confidence" => 0.98],
    ["box" => [[100, 180], [180, 180], [180, 200], [100, 200]], "text" => "LAKI-LAKI", "confidence" => 0.98],

    // Gol Darah
    ["box" => [[200, 180], [250, 180], [250, 200], [200, 200]], "text" => "Gol. Darah", "confidence" => 0.92],
    ["box" => [[260, 180], [280, 180], [280, 200], [260, 200]], "text" => "O", "confidence" => 0.95],

    // Alamat
    ["box" => [[20, 210], [70, 210], [70, 230], [20, 230]], "text" => "Alamat", "confidence" => 0.97],
    ["box" => [[90, 210], [350, 210], [350, 230], [90, 230]], "text" => "PERUM BUMI INDAH BLOK B NO 10", "confidence" => 0.94],
    
    // RT RW
    ["box" => [[40, 240], [80, 240], [80, 260], [40, 260]], "text" => "RT/RW", "confidence" => 0.97],
    ["box" => [[100, 240], [150, 240], [150, 260], [100, 260]], "text" => ": 001/002", "confidence" => 0.98],
    
    // Kel/Desa
    ["box" => [[40, 270], [90, 270], [90, 290], [40, 290]], "text" => "Kel/Desa", "confidence" => 0.97],
    ["box" => [[100, 270], [200, 270], [200, 290], [100, 290]], "text" => ": KARANG ANYAR", "confidence" => 0.95],
    
    // Agama
    ["box" => [[20, 300], [70, 300], [70, 320], [20, 320]], "text" => "Agama", "confidence" => 0.99],
    ["box" => [[90, 300], [140, 300], [140, 320], [90, 320]], "text" => "ISLAM", "confidence" => 0.99],
    
    // Status Perkawinan
    ["box" => [[20, 330], [120, 330], [120, 350], [20, 350]], "text" => "Status Perkawinan", "confidence" => 0.97],
    ["box" => [[130, 330], [250, 330], [250, 350], [130, 350]], "text" => ": BELUM KAWIN", "confidence" => 0.98],

    // Pekerjaan
    ["box" => [[20, 360], [90, 360], [90, 380], [20, 380]], "text" => "Pekerjaan", "confidence" => 0.98],
    ["box" => [[100, 360], [250, 360], [250, 380], [100, 380]], "text" => ": PELAJAR/MAHASISWA", "confidence" => 0.98],
];

$result = $extractor->extract($mockData);
print_r($result);
