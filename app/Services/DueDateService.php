<?php

namespace App\Services;

use App\Models\Tenancy;
use Carbon\Carbon;

/**
 * Single source of truth for tenancy effective move-in date and due-day rules.
 *
 * Business rule (same as resources/js/services/statement.ts#calcDueDay):
 *   move-in day 9  -> due day 8
 *   move-in day 15 -> due day 14
 *   move-in day 2  -> due day 1
 *   move-in day 1  -> last day of the PREVIOUS month (never day 0)
 */
class DueDateService
{
    public static function dueDay(int $moveInDay): int
    {
        if ($moveInDay <= 1) {
            return 0; // sentinel: caller resolves to last day of previous month
        }

        return $moveInDay - 1;
    }

    /**
     * Resolve an actual calendar due-day for a given month.
     */
    public static function dueDayOfMonth(Carbon $month, int $moveInDay): int
    {
        if ($moveInDay <= 1) {
            return $month->copy()->subMonthNoOverflow()->daysInMonth;
        }

        $day = $moveInDay - 1;

        return min($day, $month->daysInMonth);
    }

    /**
     * The actual submitted date of the onboarding (source of truth for a pending tenant).
     */
    public static function submissionDate(Tenancy $tenancy): ?Carbon
    {
        $agreement = \App\Models\Agreement::where('tenancy_id', $tenancy->id)
            ->latest('id')
            ->first();

        $reference = $agreement?->signed_at ?? $tenancy->updated_at;

        return $reference ? Carbon::parse($reference) : null;
    }

    /**
     * Effective move-in date shown/used while a tenancy is still being onboarded.
     *
     * Only corrects STALE dates for tenancies that have NOT been activated yet
     * (anything before ACTIVE). ACTIVE and later statuses (SUSPENDED, INACTIVE,
     * NOT_CONTINUE, ARCHIVED) are never touched, and future move-in dates are kept.
     */
    public static function effectiveMoveInDate(Tenancy $tenancy): ?Carbon
    {
        $raw = $tenancy->move_in_date ? Carbon::parse($tenancy->move_in_date) : null;

        $locked = in_array($tenancy->status, ['ACTIVE', 'SUSPENDED', 'NOT_CONTINUE', 'INACTIVE', 'ARCHIVED']);

        if (! $raw || $locked || ! $raw->lt(Carbon::today())) {
            return $raw;
        }

        $submitted = self::submissionDate($tenancy);

        return $submitted ? $submitted->copy()->startOfDay() : $raw;
    }

    /**
     * Next monthly due date for reminders/billing, following the same day rule.
     */
    public static function nextDueDate(Carbon|string $anchor, int $moveInDay): Carbon
    {
        $fallback = $anchor instanceof Carbon ? $anchor->copy()->addDays(30) : Carbon::parse($anchor)->addDays(30);

        for ($i = 0; $i <= 3; $i++) {
            $month = Carbon::today()->copy()->addMonthsNoOverflow($i);

            if ($moveInDay <= 1) {
                $due = $month->copy()->endOfMonth();
            } else {
                $due = $month->copy()->startOfMonth()->addDays($moveInDay - 2);
                if ($due->gt($month->copy()->endOfMonth())) {
                    $due = $month->copy()->endOfMonth();
                }
            }

            if ($due->gte(Carbon::today())) {
                return $due;
            }
        }

        return $fallback->startOfDay();
    }
}