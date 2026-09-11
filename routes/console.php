<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('tenancy:daily-process')->dailyAt('00:01');

// Automatic water meter email reminders (H-4, due today, next period).
// Runs once a day, only when the schedule is enabled. Safe to keep OFF until
// SMTP delivery has been proven via Admin → Air → Test Notifikasi → Test Email.
if (config('water.scheduler_enabled')) {
    Schedule::command('water:send-reminders')->dailyAt('00:06');
}