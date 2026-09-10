<?php

use Illuminate\Support\Facades\Route;
use App\Models\Property;
use Inertia\Inertia;

Route::get('/', function () {
    $properties = Property::with(['media' => function($q) {
            $q->orderBy('sort_order');
        }])
        ->whereIn('status', ['AVAILABLE', 'UPCOMING_AVAILABLE', 'OCCUPIED'])
        ->get();

    return Inertia::render('welcome', [
        'properties' => $properties
    ]);
})->name('home');

Route::get('/kamar/{id}', function ($id) {
    $property = Property::with(['media' => function($q) {
        $q->orderBy('sort_order');
    }])->findOrFail($id);

    return Inertia::render('Public/PropertyDetail', [
        'property' => $property
    ]);
})->name('property.show');

// Auth Routes (Google OAuth)
Route::get('/auth/google', [\App\Http\Controllers\AuthController::class, 'redirectToGoogle'])->name('auth.google');
Route::get('/auth/google/callback', [\App\Http\Controllers\AuthController::class, 'handleGoogleCallback']);
Route::post('/logout', [\App\Http\Controllers\AuthController::class, 'logout'])->name('logout');

Route::get('/dashboard', function () {
    $user = \Illuminate\Support\Facades\Auth::user();
    if ($user && $user->role === 'ADMIN') {
        return redirect()->route('admin.dashboard');
    }
    return redirect()->route('tenant.dashboard');
})->middleware('auth')->name('dashboard');

// Admin Routes
Route::middleware(['auth', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [\App\Http\Controllers\AdminController::class, 'dashboard'])->name('admin.dashboard');
    
    // Properties
    Route::get('/properties', [\App\Http\Controllers\AdminController::class, 'properties'])->name('admin.properties');
    Route::post('/properties', [\App\Http\Controllers\AdminController::class, 'storeProperty'])->name('admin.properties.store');
    Route::put('/properties/{id}', [\App\Http\Controllers\AdminController::class, 'updateProperty'])->name('admin.properties.update');
    Route::delete('/properties/{id}', [\App\Http\Controllers\AdminController::class, 'destroyProperty'])->name('admin.properties.destroy');
    
    // Property Media
    Route::post('/properties/{id}/media', [\App\Http\Controllers\AdminController::class, 'storeMedia'])->name('admin.properties.media.store');
    Route::post('/properties/{id}/media/{mediaId}/cover', [\App\Http\Controllers\AdminController::class, 'setCoverMedia'])->name('admin.properties.media.cover');
    Route::delete('/properties/{id}/media/{mediaId}', [\App\Http\Controllers\AdminController::class, 'deleteMedia'])->name('admin.properties.media.destroy');
    Route::post('/properties/{id}/media/reorder', [\App\Http\Controllers\AdminController::class, 'reorderMedia'])->name('admin.properties.media.reorder');
    
    // Tenants & Invitations
    Route::get('/tenants', [\App\Http\Controllers\AdminController::class, 'tenants'])->name('admin.tenants');
    Route::post('/tenants/invite', [\App\Http\Controllers\AdminController::class, 'inviteTenant'])->name('admin.tenants.invite');

    // Admin Approval Workflow
    Route::get('/tenants/{id}', [\App\Http\Controllers\AdminController::class, 'showApproval'])->name('admin.tenants.show');
    Route::post('/tenants/{id}/approve', [\App\Http\Controllers\AdminController::class, 'approveTenant'])->name('admin.tenants.approve');
    Route::post('/tenants/{id}/reject', [\App\Http\Controllers\AdminController::class, 'rejectTenant'])->name('admin.tenants.reject');
    Route::post('/tenants/{id}/reopen', [\App\Http\Controllers\AdminController::class, 'reopenApproval'])->name('admin.tenants.reopen');
    Route::put('/tenants/{id}/profile', [\App\Http\Controllers\AdminController::class, 'updateTenantProfile'])->name('admin.tenants.profile.update');
    Route::put('/tenants/{id}/details', [\App\Http\Controllers\AdminController::class, 'updateTenancyDetails'])->name('admin.tenants.details.update');
    Route::delete('/tenants/{id}', [\App\Http\Controllers\AdminController::class, 'destroyTenant'])->name('admin.tenants.destroy');
    Route::get('/tenants/{id}/ktp/{kind}', [\App\Http\Controllers\AdminController::class, 'getTenantKtpPhoto'])->name('admin.tenants.ktp');
    Route::get('/tenants/{id}/ktp/{kind}/download', [\App\Http\Controllers\AdminController::class, 'downloadTenantKtpPhoto'])->name('admin.tenants.ktp.download');

    // Tenant Approvals & Onboarding (Phase 5 - legacy multi-step)
    Route::get('/approvals/{id}', [\App\Http\Controllers\AdminController::class, 'showApproval'])->name('admin.approvals.show');
    Route::post('/approvals/{id}/approve', [\App\Http\Controllers\AdminController::class, 'approveData'])->name('admin.approvals.approve');
    Route::post('/approvals/{id}/move-in-doc', [\App\Http\Controllers\AdminController::class, 'storeMoveInDoc'])->name('admin.approvals.moveInDoc');
    Route::post('/approvals/{id}/water-meter', [\App\Http\Controllers\AdminController::class, 'storeStartWaterMeter'])->name('admin.approvals.waterMeter');

    // Admin Operations (Phase 6)
    Route::post('/payments/{billingId}/verify', [\App\Http\Controllers\PaymentController::class, 'verifyPayment'])->name('admin.payments.verify');
    Route::post('/tenants/{tenancyId}/water-meter', [\App\Http\Controllers\WaterMeterController::class, 'store'])->name('admin.waterMeter.store');

    // Move Out & Archiving
    Route::get('/move-out/{tenancyId}', [\App\Http\Controllers\MoveOutController::class, 'show'])->name('admin.moveOut.show');
    Route::post('/move-out/{tenancyId}/doc', [\App\Http\Controllers\MoveOutController::class, 'storeDocumentation'])->name('admin.moveOut.storeDoc');
    Route::post('/move-out/{tenancyId}/finalize', [\App\Http\Controllers\MoveOutController::class, 'finalize'])->name('admin.moveOut.finalize');
});

// Tenant Routes
Route::middleware(['auth'])->prefix('tenant')->group(function () {
    // Onboarding Wizard
    Route::get('/onboarding', [\App\Http\Controllers\OnboardingController::class, 'show'])->name('tenant.onboarding');
    Route::get('/onboarding/profile', [\App\Http\Controllers\OnboardingController::class, 'getProfile'])->name('tenant.onboarding.profile');
    Route::post('/onboarding/info', [\App\Http\Controllers\OnboardingController::class, 'storeInfo'])->name('tenant.onboarding.info');
    Route::post('/onboarding/ktp', [\App\Http\Controllers\OnboardingController::class, 'uploadKtp'])->name('tenant.onboarding.ktp');
    Route::get('/onboarding/ktp/{kind}', [\App\Http\Controllers\OnboardingController::class, 'getKtpPhoto'])->name('tenant.onboarding.ktp.photo');
    Route::post('/onboarding/agreement', [\App\Http\Controllers\OnboardingController::class, 'submitAgreement'])->name('tenant.onboarding.agreement');
    Route::post('/onboarding/revise', [\App\Http\Controllers\OnboardingController::class, 'revise'])->name('tenant.onboarding.revise');
    
    // Tenant Dashboard (Active)
    Route::get('/dashboard', function () {
        $user = \Illuminate\Support\Facades\Auth::user();
        $tenancy = \App\Models\Tenancy::with('property')->where('user_id', $user->id)->first();
        
        if (!$tenancy || !in_array($tenancy->status, ['ACTIVE', 'NOT_CONTINUE', 'SUSPENDED'])) {
            return redirect('/tenant/onboarding'); // Redirect to onboarding if not active
        }

        // Fetch Next Payment (Active Billing)
        $nextBilling = \App\Models\Billing::where('tenancy_id', $tenancy->id)
                            ->where('billing_type', 'RENT')
                            ->orderBy('due_date', 'asc')
                            ->first();

        return Inertia::render('Tenant/Dashboard', [
            'tenancy' => $tenancy,
            'nextBilling' => $nextBilling
        ]);
    })->name('tenant.dashboard');

    // Continuation Logic (H-3)
    Route::post('/continuation', [\App\Http\Controllers\ContinuationController::class, 'submitDecision'])->name('tenant.continuation.submit');

    // Tenant Payment Proof Submission (Phase 6)
    Route::post('/payments/{billingId}/proof', [\App\Http\Controllers\PaymentController::class, 'submitProof'])->name('tenant.payments.proof');
});

require __DIR__.'/settings.php';
