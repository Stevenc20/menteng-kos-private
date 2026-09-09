<?php

namespace App\Services;

use App\Models\Tenancy;

/**
 * Single source of truth for water (PAM) billing.
 *
 * Business rules:
 *  - Water is billed on the RENT billing via the `excess_water_charge` column.
 *  - KIOSK: if the agreed (deal) price is BELOW the property's standard
 *    (normal) price, the tenant pays for the FULL PAM usage separately at
 *    WATER_RATE_PER_M3 (no included 5m³ allowance).
 *  - KIOSK with deal >= standard, and all ROOM units: the first
 *    WATER_ALLOWANCE_M3 are included; usage beyond that is charged at
 *    WATER_RATE_PER_M3.
 */
class WaterBillingService
{
    /** Tarif PAM (Rupiah) per meter kubik (m³). */
    public const WATER_RATE_PER_M3 = 14000;

    /** Kubik air yang sudah termasuk dalam sewa untuk ROOM / KIOSK penuh. */
    public const WATER_ALLOWANCE_M3 = 5;

    /**
     * Whether the tenancy pays for PAM water separately (no allowance).
     * Applies only when the unit is a KIOSK whose deal price is below the
     * property's standard price — i.e. the negotiated price did not include water.
     *
     * @param Tenancy $tenancy
     * @return bool
     */
    public static function chargesWaterSeparately(Tenancy $tenancy): bool
    {
        if ($tenancy->property?->type !== 'KIOSK') {
            return false;
        }

        $standard = (float) $tenancy->property->normal_price;
        $deal = (float) $tenancy->agreed_price;

        // A KIOSK with no standard price set falls back to the default behaviour.
        if ($standard <= 0) {
            return false;
        }

        return $deal < $standard;
    }

    /**
     * Resolve usage m³ that will actually be charged.
     *
     * @param Tenancy $tenancy
     * @param int $usageM3  recorded usage for this period (current - previous)
     * @return int  the billable m³
     */
    public static function billableUsage(Tenancy $tenancy, int $usageM3): int
    {
        if (self::chargesWaterSeparately($tenancy)) {
            return max(0, (int) $usageM3);
        }

        return max(0, (int) $usageM3 - self::WATER_ALLOWANCE_M3);
    }

    /**
     * Compute the water charge (Rupiah) for the given usage.
     *
     * @param Tenancy $tenancy
     * @param int $usageM3
     * @return int
     */
    public static function chargeFor(Tenancy $tenancy, int $usageM3): int
    {
        return self::billableUsage($tenancy, $usageM3) * self::WATER_RATE_PER_M3;
    }
}
