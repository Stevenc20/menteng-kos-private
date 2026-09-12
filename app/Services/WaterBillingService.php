<?php

namespace App\Services;

use App\Models\Property;
use App\Models\Setting;
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
     * Included m³ for the tenancy (the free allowance inside the rent).
     *
     *  - ROOM & full-price KIOSK: first WATER_ALLOWANCE_M3 are included.
     *  - KIOSK billed separately (deal below standard): no allowance at all.
     */
    public static function allowanceM3(Tenancy $tenancy): int
    {
        return self::chargesWaterSeparately($tenancy) ? 0 : self::WATER_ALLOWANCE_M3;
    }

    /**
     * Resolve usage m³ that will actually be charged.
     *
     * @param  int  $usageM3  recorded usage for this period (current - previous)
     * @return int the billable m³
     */
    public static function billableUsage(Tenancy $tenancy, int $usageM3): int
    {
        return max(0, (int) $usageM3 - self::allowanceM3($tenancy));
    }

    /**
     * Effective water rate (Rupiah / m³) for a unit.
     *
     * Resolution order:
     *   1. The property's own `water_rate` override (if > 0)
     *   2. The global `water.rate_per_m3` setting
     *   3. The WATER_RATE_PER_M3 constant fallback
     */
    public static function ratePerM3(?Property $property = null): float
    {
        if ($property && $property->water_rate !== null && (float) $property->water_rate > 0) {
            return (float) $property->water_rate;
        }

        return (float) Setting::get('water.rate_per_m3', self::WATER_RATE_PER_M3);
    }

    /**
     * Compute the water charge (Rupiah) for the given usage.
     */
    public static function chargeFor(Tenancy $tenancy, int $usageM3): int
    {
        return (int) round(self::billableUsage($tenancy, $usageM3) * self::ratePerM3($tenancy->property));
    }
}
