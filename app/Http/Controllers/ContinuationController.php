<?php

namespace App\Http\Controllers;

use App\Models\Tenancy;
use App\Models\Billing;
use App\Models\ContinuationLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class ContinuationController extends Controller
{
    /**
     * Submit tenant's decision to continue or not for the upcoming cycle.
     */
    public function submitDecision(Request $request)
    {
        $validated = $request->validate([
            'tenancy_id' => 'required|exists:tenancies,id',
            'response' => 'required|in:YES,NO',
            'period_start' => 'required|date'
        ]);

        $tenancy = Tenancy::where('id', $validated['tenancy_id'])
                          ->where('user_id', Auth::id())
                          ->firstOrFail();

        // Save the response log
        ContinuationLog::create([
            'tenancy_id' => $tenancy->id,
            'period_start' => $validated['period_start'],
            'response' => $validated['response'],
            'responded_at' => now(),
        ]);

        if ($validated['response'] === 'NO') {
            // Cancel the H-5 generated bill if unpaid
            Billing::where('tenancy_id', $tenancy->id)
                   ->where('billing_type', 'RENT')
                   ->where('due_date', $validated['period_start'])
                   ->whereIn('status', ['UPCOMING', 'REMINDER_SENT'])
                   ->update(['status' => 'REJECTED']); // Or 'VOID' if we add it to enum

            // Update tenancy status
            $tenancy->update([
                'status' => 'NOT_CONTINUE',
                'expected_move_out_date' => Carbon::parse($validated['period_start'])->subDay()->toDateString()
            ]);

            // Update property status
            $tenancy->property->update(['status' => 'UPCOMING_AVAILABLE']);

            return redirect()->back()->with('success', 'Keputusan Anda telah dicatat. Tagihan dibatalkan dan Admin telah diberitahu.');
        }

        return redirect()->back()->with('success', 'Terima kasih telah memperpanjang sewa Anda!');
    }
}
