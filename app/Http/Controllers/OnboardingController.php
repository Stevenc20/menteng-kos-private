<?php

namespace App\Http\Controllers;

use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\Agreement;
use App\Models\AgreementSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class OnboardingController extends Controller
{
    /**
     * Display the onboarding wizard.
     */
    public function show()
    {
        $user = Auth::user();
        
        // Ensure user is a TENANT
        if ($user->role !== 'TENANT') {
            return redirect('/dashboard');
        }

        // Get active or pending tenancy
        $tenancy = Tenancy::with('property')->where('user_id', $user->id)
            ->whereIn('status', ['INVITED', 'ONBOARDING_IN_PROGRESS', 'AGREEMENT_PENDING', 'AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])
            ->first();

        if (!$tenancy) {
            // Already active or no invitation found
            $activeTenancy = Tenancy::where('user_id', $user->id)
                ->whereIn('status', ['ACTIVE', 'NOT_CONTINUE', 'SUSPENDED'])
                ->first();
                
            if ($activeTenancy) {
                return redirect('/tenant/dashboard');
            }
            
            // If completely no tenancy exists (not invited properly)
            abort(403, 'Belum ada undangan sewa untuk akun Anda. Silakan hubungi Admin.');
        }

        $profile = TenantProfile::where('user_id', $user->id)->first();
        
        // If agreement is already submitted, show waiting page
        if (in_array($tenancy->status, ['AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])) {
            return Inertia::render('Tenant/Onboarding/WaitingApproval', [
                'tenancy' => $tenancy
            ]);
        }

        return Inertia::render('Tenant/Onboarding/Wizard', [
            'tenancy' => $tenancy,
            'profile' => $profile ?? (object)[]
        ]);
    }

    /**
     * Handle KTP upload and personal info submission.
     */
    public function storeInfo(Request $request)
    {
        $user = Auth::user();
        $tenancy = Tenancy::where('user_id', $user->id)->firstOrFail();

        $validated = $request->validate([
            'whatsapp' => 'required|string',
            'ktp_1_name' => 'required|string',
            'ktp_1_nik' => 'required|string',
            'ktp_1_birth_place' => 'required|string',
            'ktp_1_birth_date' => 'required|date',
            'ktp_1_job' => 'required|string',
            'ktp_1_address' => 'required|string',
            'ktp_1_photo' => 'nullable|image|max:5120', // Max 5MB
            
            'has_second_occupant' => 'required|boolean',
            
            'ktp_2_name' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_nik' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_birth_place' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_birth_date' => 'nullable|required_if:has_second_occupant,true|date',
            'ktp_2_job' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_address' => 'nullable|required_if:has_second_occupant,true|string',
            'ktp_2_photo' => 'nullable|image|max:5120',
        ]);

        $profileData = $validated;
        unset($profileData['has_second_occupant']);

        $profile = TenantProfile::firstOrNew(['user_id' => $user->id]);

        // Secure file upload to PRIVATE storage
        if ($request->hasFile('ktp_1_photo')) {
            if ($profile->ktp_1_photo) {
                Storage::disk('local')->delete($profile->ktp_1_photo);
            }
            $path = $request->file('ktp_1_photo')->store('private/ktp');
            $profileData['ktp_1_photo'] = $path;
        }

        if ($request->boolean('has_second_occupant') && $request->hasFile('ktp_2_photo')) {
            if ($profile->ktp_2_photo) {
                Storage::disk('local')->delete($profile->ktp_2_photo);
            }
            $path = $request->file('ktp_2_photo')->store('private/ktp');
            $profileData['ktp_2_photo'] = $path;
        }

        // If no second occupant, clear out occupant 2 data
        if (!$request->boolean('has_second_occupant')) {
            $profileData['ktp_2_name'] = null;
            $profileData['ktp_2_nik'] = null;
            $profileData['ktp_2_birth_place'] = null;
            $profileData['ktp_2_birth_date'] = null;
            $profileData['ktp_2_job'] = null;
            $profileData['ktp_2_address'] = null;
            $profileData['ktp_2_photo'] = null;
        }

        $profile->fill($profileData);
        $profile->save();

        // Update Tenancy Status
        $tenancy->update(['status' => 'AGREEMENT_PENDING']);

        return redirect()->back()->with('success', 'Information saved successfully.');
    }

    /**
     * Submit Agreement and Signatures
     */
    public function submitAgreement(Request $request)
    {
        $user = Auth::user();
        $tenancy = Tenancy::where('user_id', $user->id)->firstOrFail();

        $validated = $request->validate([
            'document_html' => 'required|string',
            'signature_1' => 'required|string', // Base64 data image
            'paraf_1' => 'required|string',
            'signature_2' => 'nullable|string',
            'paraf_2' => 'nullable|string',
        ]);

        $agreement = Agreement::updateOrCreate(
            ['tenancy_id' => $tenancy->id],
            [
                'document_html' => $validated['document_html'],
                'status' => 'SIGNED',
                'signed_at' => now(),
            ]
        );

        // Save Occupant 1 Signature
        AgreementSignature::updateOrCreate(
            ['agreement_id' => $agreement->id, 'occupant_type' => 'OCCUPANT_1'],
            [
                'signature_image' => $validated['signature_1'], // Store base64 or decode and save as file
                'paraf_image' => $validated['paraf_1']
            ]
        );

        // Save Occupant 2 Signature if provided
        if (!empty($validated['signature_2']) && !empty($validated['paraf_2'])) {
            AgreementSignature::updateOrCreate(
                ['agreement_id' => $agreement->id, 'occupant_type' => 'OCCUPANT_2'],
                [
                    'signature_image' => $validated['signature_2'],
                    'paraf_image' => $validated['paraf_2']
                ]
            );
        }

        $tenancy->update(['status' => 'PENDING_ADMIN_APPROVAL']);

        return redirect()->route('tenant.onboarding')->with('success', 'Agreement submitted successfully.');
    }
}
