<?php

namespace App\Console\Commands;

use App\Models\NotificationLog;
use App\Models\Setting;
use App\Models\WaterPeriod;
use App\Services\WaterNotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Runs the exact same reminder logic used by the scheduler, so it can also be
 * triggered manually with `php artisan water:send-reminders`.
 *
 * Per day it checks every open period and asks the WaterNotificationService to
 * send (EMAIL) / log what is due. The service de-duplicates per
 * (period, trigger, channel, day) plus a one-shot guard per reminder type, so
 * running this command multiple times can never spam.
 */
class WaterDailyProcess extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'water:send-reminders';

    /**
     * The console command description.
     */
    protected $description = 'Send automatic water meter email reminders (H-4, due today, next period) to the admin.';

    /**
     * Execute the console command.
     */
    public function handle(WaterNotificationService $notificationService)
    {
        $this->info('Starting Water Reminder Process...');

        $today = Carbon::today()->startOfDay();
        $reminderDays = (int) Setting::get('water.reminder_days', 4);

        $periods = WaterPeriod::query()
            ->whereIn('status', [WaterPeriod::STATUS_METER_DUE, WaterPeriod::STATUS_WAITING_PAYMENT])
            ->whereNotNull('due_date')
            ->with(['property', 'tenant'])
            ->get();

        $sent = 0;

        foreach ($periods as $period) {
            $due = Carbon::parse($period->due_date)->startOfDay();
            $daysUntilDue = (int) $today->diffInDays($due, false); // + before due, 0 = due today, - = overdue

            // H-4 (or configured X days) before the due date: remind the admin
            // to record the meter-end reading + photo.
            if ($period->status === WaterPeriod::STATUS_METER_DUE && $daysUntilDue === $reminderDays) {
                $notificationService->notifyPeriod($period, NotificationLog::TRIGGER_H4_METER);
                $this->info("H-4 reminder for period #{$period->id} unit {$period->property?->name}");
                $sent++;
            }

            // Due today (or overdue): meter still pending, or a billed period
            // has reached its due date — remind the admin to act.
            if ($daysUntilDue <= 0) {
                $notificationService->notifyPeriod($period, NotificationLog::TRIGGER_PAYMENT_DUE);
                $this->info("Due reminder for period #{$period->id} unit {$period->property?->name}");
                $sent++;
            }
        }

        $this->info("Water Reminder Process completed (triggers attempted: {$sent}).");
    }
}