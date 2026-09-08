<?php

namespace App\Http\Controllers;

use App\Models\Tenancy;
use App\Models\WaterMeter;
use App\Models\Billing;
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
        $excessUsage = max(0, $usage - 5); // 5 m3 is the included allowance
        $excessCharge = $excessUsage * 14000;

        $path = $request->file('photo')->store('private/water_meters');

        WaterMeter::create([
            'tenancy_id' => $tenancy->id,
            'period_month' => $validated['period_month'],
            'period_year' => $validated['period_year'],
            'previous_meter' => $previousMeter,
            'current_meter' => $validated['current_meter'],
            'photo' => $path,
            'excess_usage_charge' => $excessCharge
        ]);

        // If there's an excess charge, append it to the NEXT unpaid rent billing, 
        // or the CURRENT UPCOMING one.
        if ($excessCharge > 0) {
            $upcomingBilling = Billing::where('tenancy_id', $tenancy->id)
                                      ->where('billing_type', 'RENT')
                                      ->whereIn('status', ['UPCOMING', 'REMINDER_SENT'])
                                      ->first();
            
            if ($upcomingBilling) {
                $upcomingBilling->increment('excess_water_charge', $excessCharge);
            } else {
                // If there's no upcoming bill (maybe generated next month), 
                // we can queue it or create a new separate WATER bill. 
                // But as per the rule: combined with rent.
                // We'll just create a pending rent bill early for the excess.
                Billing::create([
                    'tenancy_id' => $tenancy->id,
                    'billing_type' => 'RENT',
                    'amount' => $tenancy->agreed_price,
                    'excess_water_charge' => $excessCharge,
                    'due_date' => now()->addDays(30)->toDateString(),
                    'status' => 'UPCOMING'
                ]);
            }
        }

        return redirect()->back()->with('success', "Meteran air tercatat. Pemakaian: {$usage}m³. Kelebihan: {$excessUsage}m³ (Rp" . number_format($excessCharge, 0, ',', '.') . ").");
    }
}
