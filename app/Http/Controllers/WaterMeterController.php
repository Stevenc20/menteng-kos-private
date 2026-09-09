<?php

namespace App\Http\Controllers;

use App\Models\Tenancy;
use App\Models\WaterMeter;
use App\Models\Billing;
use App\Services\WaterBillingService;
use Illuminate\Http\Request;

class WaterMeterController extends Controller
{
    /**
     * [ADMIN] Store monthly water meter reading.
     */
    public function store(Request $request, $tenancyId)
    {
        $tenancy = Tenancy::findOrFail($tenancyId);

        $validated = $request->validate([
            'period_month' => 'required|integer|min:1|max:12',
            'period_year' => 'required|integer',
            'current_meter' => 'required|integer|min:0',
            'photo' => 'required|image|max:5120'
        ]);

        // Find the last recorded meter for this tenancy
        $lastMeter = WaterMeter::where('tenancy_id', $tenancy->id)
                               ->orderBy('created_at', 'desc')
                               ->first();

        $previousMeter = $lastMeter ? $lastMeter->current_meter : 0;

        if ($validated['current_meter'] < $previousMeter) {
            return redirect()->back()->with('error', 'Current meter cannot be less than previous meter (' . $previousMeter . ').');
        }

        $usage = $validated['current_meter'] - $previousMeter;
        $charge = WaterBillingService::chargeFor($tenancy, $usage);
        $chargedUsage = WaterBillingService::billableUsage($tenancy, $usage);
        $allowance = WaterBillingService::chargesWaterSeparately($tenancy) ? 0 : WaterBillingService::WATER_ALLOWANCE_M3;

        $path = $request->file('photo')->store('private/water_meters');

        WaterMeter::create([
            'tenancy_id' => $tenancy->id,
            'period_month' => $validated['period_month'],
            'period_year' => $validated['period_year'],
            'previous_meter' => $previousMeter,
            'current_meter' => $validated['current_meter'],
            'photo' => $path,
            'excess_usage_charge' => $charge
        ]);

        // If there's a charge, append it to the NEXT unpaid rent billing,
        // or the CURRENT UPCOMING one.
        if ($charge > 0) {
            $upcomingBilling = Billing::where('tenancy_id', $tenancy->id)
                                      ->where('billing_type', 'RENT')
                                      ->whereIn('status', ['UPCOMING', 'REMINDER_SENT'])
                                      ->first();
            
            if ($upcomingBilling) {
                $upcomingBilling->increment('excess_water_charge', $charge);
            } else {
                // If there's no upcoming bill (maybe generated next month),
                // queue a pending rent bill early for the water charge.
                Billing::create([
                    'tenancy_id' => $tenancy->id,
                    'billing_type' => 'RENT',
                    'amount' => $tenancy->agreed_price,
                    'excess_water_charge' => $charge,
                    'due_date' => now()->addDays(30)->toDateString(),
                    'status' => 'UPCOMING'
                ]);
            }
        }

        $allowedText = $allowance > 0
            ? " (digratiskan {$allowance}m³ pertama)"
            : " (tanpa jatah gratis, KIOS dengan harga deal di bawah standar)";

        return redirect()->back()->with('success', "Meteran air tercatat. Pemakaian: {$usage}m³. Ditagih: {$chargedUsage}m³ × Rp " . number_format(WaterBillingService::WATER_RATE_PER_M3, 0, ',', '.') . " = Rp " . number_format($charge, 0, ',', '.') . "$allowedText.");
    }
}
