<?php

namespace App\Http\Controllers;

use App\Models\Billing;
use App\Models\PaymentProof;
use App\Models\IncomeProof;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PaymentController extends Controller
{
    /**
     * [TENANT] Submit transfer proof for a billing.
     */
    public function submitProof(Request $request, $billingId)
    {
        $billing = Billing::findOrFail($billingId);

        // Ensure the tenant owns this billing
        if ($billing->tenancy->user_id !== Auth::id()) {
            abort(403);
        }

        $validated = $request->validate([
            'amount_claimed' => 'required|numeric|min:0',
            'receipt_image' => 'required|image|max:5120'
        ]);

        $path = $request->file('receipt_image')->store('private/payments');

        PaymentProof::create([
            'billing_id' => $billing->id,
            'uploaded_by' => Auth::id(),
            'amount_claimed' => $validated['amount_claimed'],
            'receipt_image' => $path,
            'status' => 'PENDING'
        ]);

        $billing->update(['status' => 'PENDING_VERIFICATION']);

        return redirect()->back()->with('success', 'Bukti pembayaran berhasil diunggah. Menunggu verifikasi admin.');
    }

    /**
     * [ADMIN] Verify payment and upload income proof (Two-sided).
     */
    public function verifyPayment(Request $request, $billingId)
    {
        $billing = Billing::with('paymentProofs')->findOrFail($billingId);

        $validated = $request->validate([
            'amount_received' => 'required|numeric|min:0',
            'payment_source' => 'required|string',
            'evidence_image' => 'required|image|max:5120',
            'admin_note' => 'nullable|string',
            'action' => 'required|in:CONFIRM,REJECT'
        ]);

        if ($validated['action'] === 'REJECT') {
            $billing->update(['status' => 'REJECTED']);
            
            // Mark the tenant's proof as rejected
            if ($billing->paymentProofs->last()) {
                $billing->paymentProofs->last()->update(['status' => 'REJECTED']);
            }

            return redirect()->back()->with('error', 'Pembayaran ditolak. Tenant harus mengunggah ulang bukti bayar.');
        }

        // CONFIRM Action
        $path = $request->file('evidence_image')->store('private/income');

        IncomeProof::create([
            'billing_id' => $billing->id,
            'uploaded_by_admin' => Auth::id(),
            'amount_received' => $validated['amount_received'],
            'evidence_image' => $path,
            'payment_source' => $validated['payment_source'],
            'admin_note' => $validated['admin_note']
        ]);

        // Mark the tenant's proof as verified
        if ($billing->paymentProofs->last()) {
            $billing->paymentProofs->last()->update(['status' => 'VERIFIED']);
        }

        $billing->update(['status' => 'PAID']);

        return redirect()->back()->with('success', 'Pembayaran berhasil diverifikasi.');
    }
}
