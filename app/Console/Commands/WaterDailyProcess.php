<?php

namespace App\Console\Commands;

use App\Models\NotificationLog;
use App\Models\Setting;
use App\Models\WaterPeriod;
use App\Services\WaterNotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class WaterDailyProcess extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'water:daily-process';

    /**
     * The console command description.
     */
    protected $description = 'Run daily checks for water meter reminders (H-4 meter end) and payment due reminders.';

    /**
     * Execute the console command.
     */
    public function handle(WaterNotificationService $notificationService)
    {
        $this->info('Starting Daily Water Process...');

        $today = Carbon::today()->startOfDay();
        $reminderDays = (int) Setting::get('water.reminder_days', 4);

        $periods = WaterPeriod::query()
            ->whereIn('status', [WaterPeriod::STATUS_METER_DUE, WaterPeriod::STATUS_WAITING_PAYMENT])
            ->whereNotNull('due_date')
            ->with(['property', 'tenant'])
            ->get();

        foreach ($periods as $period) {
            $due = Carbon::parse($period->due_date)->startOfDay();
            $daysUntilDue = (int) $today->diffInDays($due, false); // negative = overdue

            // H-4: remind the admin to record the meter-end reading.
            if ($daysUntilDue === $reminderDays) {
                $trigger = $period->status === WaterPeriod::STATUS_METER_DUE
                    ? NotificationLog::TRIGGER_H4_METER
                    : NotificationLog::TRIGGER_PAYMENT_DUE;

                $notificationService->notifyPeriod($period, $trigger);
                $this->info("Reminder ({$trigger}) for period #{$period->id} unit {$period->property?->name}");
            }

            // Due (or overdue) with money waiting: remind the admin to confirm the payment.
            if ($daysUntilDue <= 0 && $period->status === WaterPeriod::STATUS_WAITING_PAYMENT) {
                $notificationService->notifyPeriod($period, NotificationLog::TRIGGER_PAYMENT_DUE);
                $this->info("Payment reminder for period #{$period->id} unit {$period->property?->name}");
            }
        }

        $this->info('Daily Water Process Completed.');
    }
}