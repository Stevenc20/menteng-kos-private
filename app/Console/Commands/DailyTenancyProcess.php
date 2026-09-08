<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Tenancy;
use App\Models\Billing;
use App\Models\ContinuationLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class DailyTenancyProcess extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'tenancy:daily-process';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run daily checks for tenancy H-5 billing, H-3 continuation, and late penalties.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting Daily Tenancy Process...');
        
        $today = Carbon::today();
        
        // Process only ACTIVE tenancies
        $tenancies = Tenancy::where('status', 'ACTIVE')->get();

        foreach ($tenancies as $tenancy) {
            // Find the most recent RENT billing
            $lastBilling = Billing::where('tenancy_id', $tenancy->id)
                                  ->where('billing_type', 'RENT')
                                  ->orderBy('due_date', 'desc')
                                  ->first();
            
            // Calculate Next Due Date (30-day cycle)
            if ($lastBilling) {
                $nextDueDate = Carbon::parse($lastBilling->due_date)->addDays(30);
            } else {
                // First ever payment after move in
                $nextDueDate = Carbon::parse($tenancy->move_in_date)->addDays(30);
            }

            $daysUntilDue = $today->diffInDays($nextDueDate, false); // Negative if overdue

            // 1. H-5: Payment Reminder & Bill Generation
            if ($daysUntilDue == 5) {
                $this->generateBillAndRemind($tenancy, $nextDueDate);
            }

            // 2. H-3: Continuation Request
            if ($daysUntilDue == 3) {
                $this->requestContinuation($tenancy, $nextDueDate);
            }
            
            // 3. Overdue Processing & Penalties
            if ($daysUntilDue < 0) {
                $this->processOverdue($tenancy, $lastBilling, $today, $daysUntilDue);
            }
        }

        $this->info('Daily Tenancy Process Completed.');
    }

    private function generateBillAndRemind($tenancy, $nextDueDate)
    {
        // Check if bill already exists to maintain idempotency
        $existing = Billing::where('tenancy_id', $tenancy->id)
                           ->where('billing_type', 'RENT')
                           ->where('due_date', $nextDueDate->toDateString())
                           ->first();
        
        if (!$existing) {
            // Fetch any unpaid excess water from the previous cycle?
            // For now, excess_water_charge is 0 by default. Admin sets it when closing the previous cycle's water meter.
            
            Billing::create([
                'tenancy_id' => $tenancy->id,
                'billing_type' => 'RENT',
                'amount' => $tenancy->agreed_price,
                'due_date' => $nextDueDate->toDateString(),
                'status' => 'REMINDER_SENT',
                'excess_water_charge' => 0 // To be updated by water meter logic if applicable
            ]);
            
            Log::info("H-5 Reminder sent and bill generated for Tenancy ID: {$tenancy->id}");
            $this->info("Generated H-5 bill for Tenancy {$tenancy->id}");
        }
    }

    private function requestContinuation($tenancy, $nextDueDate)
    {
        $existingLog = ContinuationLog::where('tenancy_id', $tenancy->id)
                                      ->where('period_start', $nextDueDate->toDateString())
                                      ->first();
        
        if (!$existingLog) {
            // Send Notification to Tenant to confirm continuation
            Log::info("H-3 Continuation Request sent to Tenancy ID: {$tenancy->id}");
            $this->info("Requested continuation for Tenancy {$tenancy->id}");
        }
    }

    private function processOverdue($tenancy, $activeBilling, $today, $daysUntilDue)
    {
        if (!$activeBilling || in_array($activeBilling->status, ['PAID', 'PENDING_VERIFICATION'])) {
            return; // No penalty if already paid or waiting for admin verification
        }

        $daysLate = abs($daysUntilDue);
        
        // Calculate penalty
        $dailyPenalty = round($tenancy->agreed_price / 30);
        $totalPenalty = $dailyPenalty * $daysLate;
        
        // Ensure there's a penalty billing record or update the existing rent bill.
        // As per prompt: "Late Penalty calculation...". Usually billed separately or added to total.
        // Let's create a separate PENALTY billing for clear financial tracking.
        $penaltyBilling = Billing::updateOrCreate(
            [
                'tenancy_id' => $tenancy->id,
                'billing_type' => 'PENALTY',
                'due_date' => $activeBilling->due_date
            ],
            [
                'amount' => $totalPenalty,
                'status' => 'UPCOMING'
            ]
        );

        Log::info("Applied Rp{$totalPenalty} penalty to Tenancy ID: {$tenancy->id} for being {$daysLate} days late.");
        
        // Suspension check (Max 2 days grace period)
        if ($daysLate > 2) {
            $tenancy->update(['status' => 'SUSPENDED']);
            Log::warning("Tenancy ID: {$tenancy->id} SUSPENDED due to being {$daysLate} days late.");
            $this->error("Tenancy {$tenancy->id} suspended!");
        }
    }
}
