<?php

namespace App\Services;

use App\Models\Billing;
use App\Models\Tenancy;
use Carbon\Carbon;

/**
 * Handles initial payment verification, prorata adjustment period calculation,
 * alignment of monthly rent due date to the 1st of every month (tanggal 1),
 * and idempotent billing record synchronization.
 *
 * Formulas applied:
 *   Tarif harian  = Tarif sewa bulanan ÷ jumlah hari dalam bulan dasar perhitungan
 *   Biaya prorata = Tarif harian × jumlah hari pada periode penyesuaian yang belum dibayar
 */
class ProrataBillingService
{
    public const BASIS_ACTUAL = 'ACTUAL';

    public const BASIS_30_DAYS = '30_DAYS';

    /**
     * Calculate prorata adjustment period and cost so that the tenant aligns to
     * a monthly due date on the 1st of the month (`tanggal 1`).
     *
     * Rules enforced:
     * 1. Requires confirmed `initialPaidUntil` and `monthlyRent > 0`. Never assumes
     *    a tenant has paid up to move-in date if `initialPaidUntil` is null/empty.
     * 2. Never double-charges periods already covered on or before `initialPaidUntil`.
     * 3. Supports cross-month boundaries accurately (splitting per calendar month
     *    when `basisMode === 'ACTUAL'`, or using 30 days when `basisMode === '30_DAYS'`).
     *
     * @param  float|int|string|null  $monthlyRent
     * @param  Carbon|string|null  $moveInDate
     * @param  Carbon|string|null  $initialPaidUntil  End date of the period already paid by the tenant.
     * @param  string  $basisMode  'ACTUAL' (days in calendar month) or '30_DAYS' (30-day fixed basis)
     * @param  Carbon|string|null  $targetNormalStart  Optional explicit 1st-of-month target date
     */
    public static function calculateProrata(
        float|int|string|null $monthlyRent,
        Carbon|string|null $moveInDate,
        Carbon|string|null $initialPaidUntil,
        string $basisMode = self::BASIS_ACTUAL,
        Carbon|string|null $targetNormalStart = null,
    ): array {
        $rent = is_numeric($monthlyRent) ? (float) $monthlyRent : 0.0;
        $moveInStr = $moveInDate ? Carbon::parse($moveInDate)->toDateString() : null;
        $paidUntilStr = $initialPaidUntil !== null && $initialPaidUntil !== ''
            ? Carbon::parse($initialPaidUntil)->toDateString()
            : null;

        if ($rent <= 0) {
            return [
                'ready' => false,
                'reason' => 'Tarif sewa bulanan belum diisi atau tidak valid.',
                'move_in_date' => $moveInStr,
                'monthly_rent' => $rent,
                'initial_paid_until' => $paidUntilStr,
                'prorata_start_date' => null,
                'prorata_end_date' => null,
                'prorata_days' => 0,
                'basis_mode' => $basisMode,
                'basis_days' => null,
                'daily_rate' => 0.0,
                'prorata_amount' => 0.0,
                'normal_period_start_date' => null,
                'next_due_date' => null,
                'due_day' => 1,
                'segments' => [],
            ];
        }

        if (! $moveInStr) {
            return [
                'ready' => false,
                'reason' => 'Tanggal masuk tenant belum diisi.',
                'move_in_date' => null,
                'monthly_rent' => $rent,
                'initial_paid_until' => $paidUntilStr,
                'prorata_start_date' => null,
                'prorata_end_date' => null,
                'prorata_days' => 0,
                'basis_mode' => $basisMode,
                'basis_days' => null,
                'daily_rate' => 0.0,
                'prorata_amount' => 0.0,
                'normal_period_start_date' => null,
                'next_due_date' => null,
                'due_day' => 1,
                'segments' => [],
            ];
        }

        if (! $paidUntilStr) {
            return [
                'ready' => false,
                'reason' => 'Tanggal akhir periode pembayaran awal belum dikonfirmasi admin.',
                'move_in_date' => $moveInStr,
                'monthly_rent' => $rent,
                'initial_paid_until' => null,
                'prorata_start_date' => null,
                'prorata_end_date' => null,
                'prorata_days' => 0,
                'basis_mode' => $basisMode,
                'basis_days' => null,
                'daily_rate' => 0.0,
                'prorata_amount' => 0.0,
                'normal_period_start_date' => null,
                'next_due_date' => null,
                'due_day' => 1,
                'segments' => [],
            ];
        }

        $moveIn = Carbon::parse($moveInStr)->startOfDay();
        $paidUntil = Carbon::parse($paidUntilStr)->startOfDay();

        // Unpaid period starts from the later of moveInDate or initialPaidUntil
        // so we NEVER double-charge days already paid on or before initialPaidUntil.
        $prorataStart = $paidUntil->gt($moveIn) ? $paidUntil->copy() : $moveIn->copy();

        // Determine the target 1st of month (normal monthly cycle start):
        // If explicit targetNormalStart is provided, use it; otherwise if prorataStart
        // is already on day 1, normal period starts right away on prorataStart;
        // otherwise it starts on the 1st of the next calendar month after prorataStart.
        if ($targetNormalStart !== null && $targetNormalStart !== '') {
            $prorataEnd = Carbon::parse($targetNormalStart)->startOfDay();
        } elseif ((int) $prorataStart->day === 1) {
            $prorataEnd = $prorataStart->copy();
        } else {
            $prorataEnd = $prorataStart->copy()->addMonthNoOverflow()->startOfMonth();
        }

        if ($prorataEnd->lte($prorataStart)) {
            $basisDays = $basisMode === self::BASIS_30_DAYS ? 30 : (int) $prorataStart->daysInMonth;
            $dailyRate = round($rent / $basisDays, 2);

            return [
                'ready' => true,
                'reason' => null,
                'move_in_date' => $moveIn->toDateString(),
                'monthly_rent' => $rent,
                'initial_paid_until' => $paidUntil->toDateString(),
                'prorata_start_date' => $prorataStart->toDateString(),
                'prorata_end_date' => $prorataStart->toDateString(),
                'prorata_days' => 0,
                'basis_mode' => $basisMode,
                'basis_days' => $basisDays,
                'daily_rate' => $dailyRate,
                'prorata_amount' => 0.0,
                'normal_period_start_date' => $prorataStart->copy()->day === 1
                    ? $prorataStart->toDateString()
                    : $prorataStart->copy()->addMonthNoOverflow()->startOfMonth()->toDateString(),
                'next_due_date' => $prorataStart->copy()->day === 1
                    ? $prorataStart->toDateString()
                    : $prorataStart->copy()->addMonthNoOverflow()->startOfMonth()->toDateString(),
                'due_day' => 1,
                'segments' => [],
            ];
        }

        // Split [prorataStart, prorataEnd) by calendar month to handle cross-month periods accurately
        $segments = [];
        $cursor = $prorataStart->copy();
        $totalDays = 0;
        $rawTotalAmount = 0.0;

        while ($cursor->lt($prorataEnd)) {
            $nextMonthStart = $cursor->copy()->addMonthNoOverflow()->startOfMonth();
            $segmentEnd = $nextMonthStart->lt($prorataEnd) ? $nextMonthStart : $prorataEnd->copy();
            $segmentDays = (int) $cursor->diffInDays($segmentEnd);
            $monthDays = $basisMode === self::BASIS_30_DAYS ? 30 : (int) $cursor->daysInMonth;
            $segmentDailyRate = $rent / $monthDays;
            $segmentSubtotal = $segmentDailyRate * $segmentDays;

            $segments[] = [
                'month' => $cursor->format('Y-m'),
                'start_date' => $cursor->toDateString(),
                'end_date' => $segmentEnd->toDateString(),
                'days' => $segmentDays,
                'basis_days' => $monthDays,
                'daily_rate' => round($segmentDailyRate, 2),
                'subtotal' => round($segmentSubtotal),
            ];

            $totalDays += $segmentDays;
            $rawTotalAmount += $segmentSubtotal;
            $cursor = $segmentEnd;
        }

        $primaryBasisDays = count($segments) === 1
            ? $segments[0]['basis_days']
            : ($basisMode === self::BASIS_30_DAYS ? 30 : (int) $prorataStart->daysInMonth);

        $effectiveDailyRate = count($segments) === 1
            ? round($rent / $primaryBasisDays, 2)
            : ($totalDays > 0 ? round($rawTotalAmount / $totalDays, 2) : 0.0);

        $prorataAmount = (float) round($rawTotalAmount);

        return [
            'ready' => true,
            'reason' => null,
            'move_in_date' => $moveIn->toDateString(),
            'monthly_rent' => $rent,
            'initial_paid_until' => $paidUntil->toDateString(),
            'prorata_start_date' => $prorataStart->toDateString(),
            'prorata_end_date' => $prorataEnd->toDateString(),
            'prorata_days' => $totalDays,
            'basis_mode' => $basisMode,
            'basis_days' => $primaryBasisDays,
            'daily_rate' => $effectiveDailyRate,
            'prorata_amount' => $prorataAmount,
            'normal_period_start_date' => $prorataEnd->toDateString(),
            'next_due_date' => $prorataEnd->toDateString(),
            'due_day' => 1,
            'segments' => $segments,
        ];
    }

    /**
     * Persist prorata configuration onto the Tenancy and synchronize the
     * corresponding Billing record idempotently.
     *
     * Important guarantees:
     * - Never creates a prorata billing if `initial_paid_until` is not confirmed.
     * - Never marks a billing as `PAID` automatically just because a schedule/bill
     *   was created; status defaults to `PENDING_PAYMENT` unless admin explicitly
     *   sets `prorata_status = 'PAID'`.
     * - Idempotent: repeated calls or page refreshes update the existing prorata
     *   billing for the tenancy instead of creating duplicate rows.
     */
    public static function syncTenancyProrata(Tenancy $tenancy, array $input): array
    {
        $monthlyRent = array_key_exists('agreed_price', $input) && $input['agreed_price'] !== null && $input['agreed_price'] !== ''
            ? (float) $input['agreed_price']
            : (float) $tenancy->agreed_price;

        $moveInDate = array_key_exists('move_in_date', $input) && ! empty($input['move_in_date'])
            ? (string) $input['move_in_date']
            : (string) $tenancy->move_in_date;

        $initialPaidUntil = array_key_exists('initial_paid_until', $input)
            ? ($input['initial_paid_until'] ?: null)
            : $tenancy->initial_paid_until;

        $basisMode = $input['prorata_basis_mode']
            ?? $tenancy->prorata_basis_mode
            ?? self::BASIS_ACTUAL;

        if (! in_array($basisMode, [self::BASIS_ACTUAL, self::BASIS_30_DAYS], true)) {
            $basisMode = self::BASIS_ACTUAL;
        }

        $targetNormalStart = $input['prorata_end_date'] ?? null;

        $initialPaymentStatus = $input['initial_payment_status']
            ?? $tenancy->initial_payment_status
            ?? 'UNPAID';

        $prorataStatusInput = $input['prorata_status']
            ?? $tenancy->prorata_status
            ?? 'PENDING_PAYMENT';

        $calc = self::calculateProrata(
            $monthlyRent,
            $moveInDate,
            $initialPaidUntil,
            $basisMode,
            $targetNormalStart
        );

        // If initial_paid_until is not yet confirmed, persist what admin gave without
        // generating any assumed prorata bill.
        if (! $calc['ready']) {
            $tenancy->fill([
                'agreed_price' => $monthlyRent > 0 ? $monthlyRent : $tenancy->agreed_price,
                'move_in_date' => $moveInDate ?: $tenancy->move_in_date,
                'initial_paid_until' => null,
                'initial_payment_status' => $initialPaymentStatus,
                'prorata_basis_mode' => $basisMode,
            ]);
            $tenancy->save();

            return $calc;
        }

        $effectiveProrataStatus = $calc['prorata_days'] <= 0
            ? 'NOT_APPLICABLE'
            : (in_array($prorataStatusInput, ['PAID', 'PENDING_PAYMENT', 'UNPAID', 'UPCOMING'], true)
                ? $prorataStatusInput
                : 'PENDING_PAYMENT');

        $dueDay = isset($input['due_day']) && $input['due_day'] !== '' && $input['due_day'] !== null
            ? (int) $input['due_day']
            : 1;

        $tenancy->fill([
            'agreed_price' => $monthlyRent,
            'move_in_date' => $calc['move_in_date'],
            'due_day' => $dueDay,
            'initial_paid_until' => $calc['initial_paid_until'],
            'initial_payment_status' => $initialPaymentStatus,
            'prorata_start_date' => $calc['prorata_start_date'],
            'prorata_end_date' => $calc['prorata_end_date'],
            'prorata_days' => $calc['prorata_days'],
            'prorata_basis_mode' => $calc['basis_mode'],
            'prorata_basis_days' => $calc['basis_days'],
            'prorata_daily_rate' => $calc['daily_rate'],
            'prorata_amount' => $calc['prorata_amount'],
            'prorata_status' => $effectiveProrataStatus,
            'normal_period_start_date' => $calc['normal_period_start_date'],
        ]);
        $tenancy->save();

        // Idempotent Billing synchronization for the prorata adjustment period
        if ($calc['prorata_days'] > 0 && $calc['prorata_amount'] > 0) {
            // Map tenancy prorata_status to Billing status (never PAID unless explicitly confirmed as PAID)
            $billingStatus = $effectiveProrataStatus === 'PAID' ? 'PAID' : 'PENDING_PAYMENT';

            $existingProrataBill = Billing::withTrashed()
                ->where('tenancy_id', $tenancy->id)
                ->where('billing_type', 'RENT')
                ->where('period_type', 'PRORATA')
                ->first();

            $billingPayload = [
                'tenancy_id' => $tenancy->id,
                'billing_type' => 'RENT',
                'period_type' => 'PRORATA',
                'period_start' => $calc['prorata_start_date'],
                'period_end' => $calc['prorata_end_date'],
                'days_count' => $calc['prorata_days'],
                'daily_rate' => $calc['daily_rate'],
                'amount' => $calc['prorata_amount'],
                'due_date' => $calc['prorata_end_date'],
                'description' => sprintf(
                    'Biaya Prorata Penyesuaian Jatuh Tempo (%s s/d %s — %d hari)',
                    $calc['prorata_start_date'],
                    $calc['prorata_end_date'],
                    $calc['prorata_days']
                ),
            ];

            if ($existingProrataBill) {
                if ($existingProrataBill->trashed()) {
                    $existingProrataBill->restore();
                }
                // Preserve PENDING_VERIFICATION if tenant already uploaded proof and admin hasn't overridden to PAID
                if ($existingProrataBill->status === 'PENDING_VERIFICATION' && $billingStatus !== 'PAID') {
                    $billingPayload['status'] = 'PENDING_VERIFICATION';
                } else {
                    $billingPayload['status'] = $billingStatus;
                }
                $existingProrataBill->update($billingPayload);
            } else {
                $billingPayload['status'] = $billingStatus;
                $billingPayload['excess_water_charge'] = 0;
                Billing::create($billingPayload);
            }
        } else {
            // If prorata_days == 0 (no adjustment needed), remove any stale unpaid prorata bill
            Billing::where('tenancy_id', $tenancy->id)
                ->where('billing_type', 'RENT')
                ->where('period_type', 'PRORATA')
                ->where('status', '!=', 'PAID')
                ->delete();
        }

        return $calc;
    }
}
