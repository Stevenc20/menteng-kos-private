<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

// Pastikan direktori framework selalu ada dan bisa ditulis bahkan sebelum boot
foreach ([
    __DIR__.'/../storage',
    __DIR__.'/../storage/framework',
    __DIR__.'/../storage/framework/views',
    __DIR__.'/../storage/framework/sessions',
    __DIR__.'/../storage/framework/cache',
    __DIR__.'/../storage/logs',
    __DIR__.'/cache',
] as $dir) {
    if (! is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    @chmod($dir, 0777);
}

// Set temporary directory PHP agar tempnam tidak pernah fallback jika storage views bermasalah
if (is_dir(__DIR__.'/../storage/framework/views')) {
    putenv('TMPDIR='.__DIR__.'/../storage/framework/views');
}

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->dontReportDuplicates();

        $exceptions->stopIgnoring(\ErrorException::class);

        // Jangan render atau lempar error jika ada warning tempnam
        $exceptions->renderable(function (\ErrorException $e) {
            if (str_contains($e->getMessage(), 'tempnam()')) {
                return response('');
            }
        });
    })->create();
