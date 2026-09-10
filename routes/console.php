<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('tenancy:daily-process')->dailyAt('00:01');

// NOTE: the automatic water reminders (H-4 meter akhir & tagihan jatuh tempo)
// are intentionally NOT scheduled yet. Manual Test Notification on /admin/water
// must be confirmed first (TEST EMAIL really reaches an inbox, TEST WHATSAPP
// reaches the admin number) before the automatic reminders are enabled.
