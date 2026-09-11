<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32">
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>Menteng Kos Private</title>
            <meta name="description" content="Hunian modern di pusat kota dengan fasilitas premium, desain minimalis, dan manajemen profesional. Tersedia 10 Kamar Eksklusif dan 1 Kios." />
            <link rel="canonical" href="{{ url('/') }}" />

            <meta property="og:type" content="website" />
            <meta property="og:site_name" content="Menteng Kos Private" />
            <meta property="og:title" content="Menteng Kos Private" />
            <meta property="og:description" content="Hunian modern di pusat kota dengan fasilitas premium, desain minimalis, dan manajemen profesional. Tersedia 10 Kamar Eksklusif dan 1 Kios." />
            <meta property="og:url" content="{{ url('/') }}" />
            <meta property="og:image" content="{{ request()->getSchemeAndHttpHost() . '/images/logo/logo-og.png' }}" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="1200" />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="Menteng Kos Private" />
            <meta name="twitter:description" content="Hunian modern di pusat kota dengan fasilitas premium, desain minimalis, dan manajemen profesional. Tersedia 10 Kamar Eksklusif dan 1 Kios." />
            <meta name="twitter:image" content="{{ request()->getSchemeAndHttpHost() . '/images/logo/logo-og.png' }}" />
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <script>
            window.addEventListener('error', function(event) {
                document.body.innerHTML += '<div style="position:fixed;top:0;left:0;width:100%;padding:20px;background:red;color:white;z-index:999999;font-family:monospace;white-space:pre-wrap;"><h3>Fatal Error</h3><p>' + event.message + '</p><pre>' + (event.error ? event.error.stack : '') + '</pre></div>';
            });
            window.addEventListener('unhandledrejection', function(event) {
                document.body.innerHTML += '<div style="position:fixed;top:0;left:0;width:100%;padding:20px;background:red;color:white;z-index:999999;font-family:monospace;white-space:pre-wrap;"><h3>Promise Error</h3><p>' + event.reason + '</p></div>';
            });
        </script>
        <x-inertia::app />
    </body>
</html>
