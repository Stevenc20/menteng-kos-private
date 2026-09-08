<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$m = \App\Models\PropertyMedia::create(['property_id'=>9, 'original_path'=>'test', 'public_path'=>'test']);
print_r($m->toArray());
