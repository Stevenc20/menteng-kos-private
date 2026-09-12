<?php

namespace App\Services;

use App\Models\Property;
use App\Models\Setting;
use App\Models\Tenancy;
use App\Models\WaterPeriod;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

/**
 * Lifecycle of a per-unit water meter period.
 *
 * State machine:
 *   METER_DUE (start recorded) → WAITING_PAYMENT (end recorded + billed)
 *   → PAID (payment confirmed; a new METER_DUE period auto-continues with the
 *   old END becoming the new START, so the reading is never retyped).
 *
 * "Aktif" vs "Perlu Update Meter":
 *   The DB persists METER_DUE for every open pre-payment period. Whether the
 *   unit currently shows "Aktif" or "Perlu Update Meter" is DERIVED from the
 *   period's real due date (see effectiveStatus()): a fresh period is "Aktif"
 *   and only turns into "Perlu Update Meter" once it enters the reminder window
 *   (water.reminder_days before the due date). No schema change, no stored
 *   ACTIVE value — just the right status at the right time.
 */
class WaterPeriodService
{
    /**
     * Derived status shown while a period is running but NOT yet near its due
     * date. Never persisted (the DB only knows METER_DUE/WAITING_PAYMENT/PAID).
     */
    public const STATUS_ACTIVE = 'ACTIVE';

    public function __construct(protected WaterNotificationService $notificationService)
    {
    }

    /**
     * The status the UI should display for a period.
     *
     *  - METER_DUE: shown as "Perlu Update Meter" only once the real due date is
     *    inside the reminder window (or already reached/overdue). Before that it
     *    is "Aktif" so a brand-new period never starts as "Perlu Update Meter".
     *  - WAITING_PAYMENT / PAID: returned as-is.
     */
    public static function effectiveStatus(WaterPeriod $period, ?int $reminderDays = null): string
    {
        if ($period->status !== WaterPeriod::STATUS_METER_DUE || $period->due_date === null) {
            return $period->status;
        }

        $reminderDays = $reminderDays ?? (int) Setting::get('water.reminder_days', 4);

        $daysUntilDue = (int) today()->startOfDay()->diffInDays(
            Carbon::parse($period->due_date)->startOfDay(),
            false
        );

        // 0 = due today, negative = overdue — still "Perlu Update Meter".
        return $daysUntilDue <= $reminderDays ? WaterPeriod::STATUS_METER_DUE : self::STATUS_ACTIVE;
    }

    /**
     * Open a new water period for the unit (meter-start + photo).
     */
    public function startPeriod(Property $property, int $meterStart, ?string $meterStartPhoto, ?string $note = null): WaterPeriod
    {
        $tenancy = $property->currentTenancy();
        $now = now();

        return WaterPeriod::create([
            'property_id' => $property->id,
            'tenancy_id' => $tenancy?->id,
            'tenant_id' => $tenancy?->user_id,
            'period_year' => (int) $now->year,
            'period_month' => (int) $now->month,
            'status' => WaterPeriod::STATUS_METER_DUE,
            'payment_status' => 'NOT_APPLICABLE',
            'meter_start' => $meterStart,
            'meter_start_photo' => $meterStartPhoto,
            'meter_start_recorded_at' => $now,
            'water_rate' => WaterBillingService::ratePerM3($property),
            'due_date' => $this->resolveDueDate($tenancy, null),
            'note' => $note,
        ]);
    }

    /**
     * Record the meter-end reading for an open METER_DUE period.
     *
     * @throws ValidationException when the end reading is lower than the start.
     */
    public function recordEnd(WaterPeriod $period, int $meterEnd, ?string $meterEndPhoto): WaterPeriod
    {
        if ($period->status !== WaterPeriod::STATUS_METER_DUE) {
            throw ValidationException::withMessages(['meter_end' => 'Periode tidak sedang menunggu meter akhir.']);
        }

        if ($meterEnd < (int) $period->meter_start) {
            throw ValidationException::withMessages(['meter_end' => 'Meter akhir tidak boleh lebih kecil dari meter awal.']);
        }

        $usage = $meterEnd - (int) $period->meter_start;

        // Allowance is type-based: 5m³ for KAMAR, 0 for KIOS. When the period
        // has no tenancy snapshot, fall back to the unit type rule.
        $billable = $period->tenancy
            ? WaterBillingService::billableUsage($period->tenancy, $usage)
            : max(0, $usage - WaterBillingService::allowanceForType($period->property?->type));

        $rate = (float) ($period->water_rate ?? WaterBillingService::ratePerM3($period->property));
        $total = (int) round($billable * $rate);

        $period->update([
            'status' => WaterPeriod::STATUS_WAITING_PAYMENT,
            'payment_status' => 'UNPAID',
            'meter_end' => $meterEnd,
            'meter_end_photo' => $meterEndPhoto,
            'meter_end_recorded_at' => now(),
            'usage' => $usage,
            'billable_usage' => $billable,
            'total_amount' => $total,
        ]);

        return $period->refresh();
    }

    /**
     * Confirm the payment for a WAITING_PAYMENT period and auto-open the next
     * period with the old END as the new START. Returns the closed (now PAID)
     * period.
     */
    public function confirmPayment(WaterPeriod $period, int $confirmedById): WaterPeriod
    {
        if ($period->status !== WaterPeriod::STATUS_WAITING_PAYMENT) {
            throw ValidationException::withMessages(['payment' => 'Periode tidak sedang menunggu pembayaran.']);
        }

        $next = null;

        DB::transaction(function () use ($period, $confirmedById, &$next) {
            $period->update([
                'status' => WaterPeriod::STATUS_PAID,
                'payment_status' => 'PAID',
                'paid_at' => now(),
                'confirmed_by' => $confirmedById,
            ]);

            $next = $this->startNextPeriod($period);
        });

        // Tell the admin the new period has started (reminder to photo the meter).
        $this->notificationService->notifyPeriod($next, \App\Models\NotificationLog::TRIGGER_NEW_PERIOD);

        return $period->refresh();
    }

    /**
     * Auto-create the continuation period: END becomes START, photos carry over.
     */
    protected function startNextPeriod(WaterPeriod $period): WaterPeriod
    {
        $tenancy = $period->tenancy;

        $year = (int) $period->period_year;
        $month = (int) $period->period_month + 1;
        if ($month > 12) {
            $month = 1;
            $year++;
        }

        $nextDue = $this->resolveDueDate($tenancy, $period->due_date?->toDateString());

        return WaterPeriod::create([
            'property_id' => $period->property_id,
            'tenancy_id' => $period->tenancy_id,
            'tenant_id' => $period->tenant_id,
            'period_year' => $year,
            'period_month' => $month,
            'status' => WaterPeriod::STATUS_METER_DUE,
            'payment_status' => 'NOT_APPLICABLE',
            'meter_start' => $period->meter_end,
            'meter_start_photo' => $period->meter_end_photo,
            'meter_start_recorded_at' => $period->meter_end_recorded_at,
            'water_rate' => $period->water_rate,
            'due_date' => $nextDue,
        ]);
    }

    protected function resolveDueDate(?Tenancy $tenancy, ?string $anchorDueDate)
    {
        if (! $tenancy || ! $tenancy->move_in_date) {
            return now()->addDays(30)->toDateString();
        }

        $moveInDay = (int) \Carbon\Carbon::parse($tenancy->move_in_date)->day;

        $anchor = $anchorDueDate ?? \Carbon\Carbon::parse($tenancy->move_in_date)->toDateString();

        return DueDateService::nextDueDate($anchor, $moveInDay, $tenancy->due_day);
    }
}