<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Mute E_NOTICE/E_WARNING khusus 'tempnam()' agar Laravel tidak mengonversinya menjadi ErrorException HTTP 500
set_error_handler(function ($severity, $message, $file, $line) {
    if (str_contains($message, 'tempnam()')) {
        return true; // abaikan, PHP akan memakai fallback temp file tanpa crash
    }
    return false; // biarkan error lain ditangani handler default
}, E_WARNING | E_NOTICE);

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
