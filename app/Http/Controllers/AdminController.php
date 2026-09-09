<?php

namespace App\Http\Controllers;

use App\Models\Agreement;
use App\Models\AgreementSignature;
use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\RoomDocumentation;
use App\Models\RoomDocumentationMedia;
use App\Models\Tenancy;
use App\Models\TenantProfile;
use App\Models\User;
use App\Models\WaterMeter;
use App\Services\ImageWatermarkService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AdminController extends Controller
{
    /**
     * Display the Admin Dashboard.
     */
    public function dashboard()
    {
        $stats = [
            'total_rooms' => Property::where('type', 'ROOM')->count(),
            'available_rooms' => Property::where('type', 'ROOM')->where('status', 'AVAILABLE')->count(),
            'occupied_rooms' => Property::where('type', 'ROOM')->where('status', 'OCCUPIED')->count(),
            'active_tenants' => Tenancy::where('status', 'ACTIVE')->count(),
        ];

        return Inertia::render('Admin/Dashboard', [
            'stats' => $stats,
        ]);
    }

    /**
     * Display the Property Management page.
     */
    public function properties()
    {
        $properties = Property::with('media')->withCount('media')->orderBy('name')->get();

        return Inertia::render('Admin/Properties', [
            'properties' => $properties,
        ]);
    }

    /**
     * Store a new Property, optionally with photo uploads in the same request.
     */
    public function storeProperty(Request $request, ImageWatermarkService $watermarkService)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:ROOM,KIOSK',
            'normal_price' => 'required|numeric|min:0',
            'status' => 'required|in:AVAILABLE,OCCUPIED,MAINTENANCE',
            'description' => 'nullable|string',
            'facilities' => 'nullable|array',
            'facilities.*' => 'string',
            'photos.*' => 'nullable|file|image|max:5120',
        ]);

        // Remove the file keys so they are never mass-assigned to properties.
        unset($validated['photos']);

        $wantsJson = $request->wantsJson();
        $storedPaths = [];

        try {
            $property = DB::transaction(function () use ($validated, $request, $watermarkService, &$storedPaths) {
                $property = Property::create($validated);

                if ($request->hasFile('photos')) {
                    foreach ($request->file('photos') as $photo) {
                        $paths = $watermarkService->processAndStore($photo, $property->id);
                        $storedPaths[] = $paths;

                        $property->media()->create([
                            'type' => 'IMAGE',
                            'original_path' => $paths['original_path'],
                            'public_path' => $paths['public_path'],
                            'is_cover' => ! $property->media()->where('is_cover', true)->exists(),
                            'sort_order' => $property->media()->count(),
                        ]);
                    }
                }

                return $property;
            });

            $payload = ['property' => $property->load('media')];

            if ($wantsJson) {
                return response()->json($payload, 201);
            }

            return redirect()->back()->with('success', 'Property created successfully.');
        } catch (\Throwable $e) {
            // Rollback safety: remove any files stored during the failed attempt.
            foreach ($storedPaths as $paths) {
                Storage::disk('local')->delete($paths['original_path']);
                Storage::disk('public')->delete($paths['public_path']);
            }

            if ($wantsJson) {
                return response()->json(['message' => 'Server Error: '.$e->getMessage()], 500);
            }

            return redirect()->back()->withErrors(['photos' => 'Server Error: '.$e->getMessage()]);
        }
    }

    /**
     * Update an existing Property.
     */
    public function updateProperty(Request $request, $id)
    {
        $property = Property::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:ROOM,KIOSK',
            'normal_price' => 'required|numeric|min:0',
            'status' => 'required|in:AVAILABLE,OCCUPIED,MAINTENANCE',
            'description' => 'nullable|string',
            'facilities' => 'nullable|array',
            'facilities.*' => 'string',
        ]);

        $property->update($validated);

        return redirect()->back()->with('success', 'Property updated successfully.');
    }

    /**
     * Destroy a Property.
     */
    public function destroyProperty($id)
    {
        $property = Property::findOrFail($id);

        // Remove stored media files before deleting, so no orphan files remain.
        foreach ($property->media as $media) {
            if ($media->original_path) {
                Storage::disk('local')->delete($media->original_path);
            }
            if ($media->public_path) {
                $publicRelative = str_replace([config('app.url').'/storage', '/storage/'], '', $media->public_path);
                Storage::disk('public')->delete($publicRelative);
            }
        }

        $property->delete();

        return redirect()->back()->with('success', 'Property deleted successfully.');
    }

    /**
     * Store Media for a Property.
     */
    public function storeMedia(Request $request, $id, ImageWatermarkService $watermarkService)
    {
        $property = Property::findOrFail($id);

        $request->validate([
            'photos.*' => 'nullable|image|max:5120',
            'video' => 'nullable|mimes:mp4,mov,avi|max:51200',
        ]);

        $wantsJson = $request->wantsJson();

        try {
            if (! $request->hasFile('photos') && ! $request->hasFile('video')) {
                if ($wantsJson) {
                    return response()->json(['message' => 'Belum ada file yang dipilih.'], 422);
                }

                return redirect()->back()->withErrors(['photos' => 'No files received by server.']);
            }

            if ($request->hasFile('photos')) {
                foreach ($request->file('photos') as $photo) {
                    $paths = $watermarkService->processAndStore($photo, $property->id);

                    $media = new PropertyMedia;
                    $media->property_id = $property->id;
                    $media->type = 'IMAGE';
                    $media->original_path = $paths['original_path'];
                    $media->public_path = $paths['public_path'];
                    $media->is_cover = $property->media()->where('is_cover', true)->doesntExist();
                    $media->sort_order = $property->media()->count();
                    $media->save();
                }
            }

            if ($request->hasFile('video')) {
                $video = $request->file('video');
                $filename = Str::random(40).'.'.$video->getClientOriginalExtension();

                $publicRelativePath = "properties/{$property->id}/videos/{$filename}";
                Storage::disk('public')->putFileAs("properties/{$property->id}/videos", $video, $filename);

                $media = new PropertyMedia;
                $media->property_id = $property->id;
                $media->type = 'VIDEO';
                $media->original_path = $publicRelativePath;
                $media->public_path = $publicRelativePath;
                $media->is_cover = false;
                $media->sort_order = $property->media()->count();
                $media->save();
            }

            $mediaList = $property->media()->orderBy('sort_order')->get();

            if ($wantsJson) {
                return response()->json(['media' => $mediaList]);
            }

            return redirect()->back()->with('success', 'Media uploaded successfully.');
        } catch (\Exception $e) {
            if ($wantsJson) {
                return response()->json(['message' => 'Server Error: '.$e->getMessage()], 500);
            }

            return redirect()->back()->withErrors(['photos' => 'Server Error: '.$e->getMessage()]);
        }
    }

    public function setCoverMedia(Request $request, $id, $mediaId)
    {
        $property = Property::findOrFail($id);
        $property->media()->update(['is_cover' => false]);
        $property->media()->where('id', $mediaId)->update(['is_cover' => true]);

        $mediaList = $property->media()->orderBy('sort_order')->get();

        if ($request->wantsJson()) {
            return response()->json(['success' => true, 'media' => $mediaList]);
        }

        return redirect()->back()->with('success', 'Cover image updated.');
    }

    public function deleteMedia(Request $request, $id, $mediaId)
    {
        $media = PropertyMedia::where('property_id', $id)->findOrFail($mediaId);

        // Delete private original (stored on the 'local' disk)
        if ($media->original_path) {
            Storage::disk('local')->delete($media->original_path);
        }

        // Delete public copy (stored on the 'public' disk as a relative path)
        if ($media->public_path) {
            $publicRelative = str_replace([config('app.url').'/storage', '/storage/'], '', $media->public_path);
            Storage::disk('public')->delete($publicRelative);
        }

        // Delete thumbnail if it was ever generated
        if ($media->thumbnail_path && ! str_starts_with($media->thumbnail_path, 'http')) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $media->thumbnail_path));
        }

        $media->delete();

        // Cover fallback: when the last cover is removed but photos remain,
        // automatically promote the next media so is_cover stays consistent.
        if (! PropertyMedia::where('property_id', $id)->where('is_cover', true)->exists()) {
            PropertyMedia::where('property_id', $id)
                ->orderBy('sort_order')
                ->first()
                ?->update(['is_cover' => true]);
        }

        $mediaList = PropertyMedia::where('property_id', $id)->orderBy('sort_order')->get();

        if ($request->wantsJson()) {
            return response()->json(['success' => true, 'media' => $mediaList]);
        }

        return redirect()->back()->with('success', 'Media deleted.');
    }

    public function reorderMedia(Request $request, $id)
    {
        $validated = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|exists:property_media,id',
        ]);

        foreach ($validated['order'] as $index => $mediaId) {
            PropertyMedia::where('property_id', $id)
                ->where('id', $mediaId)
                ->update(['sort_order' => $index]);
        }

        return redirect()->back()->with('success', 'Media reordered.');
    }

    /**
     * Display the Tenants and Invitations page.
     */
    public function tenants(Request $request)
    {
        // Filter status via ?status= (all|pending|active|rejected)
        $filter = $request->query('status', 'all');

        $query = Tenancy::with(['user', 'property'])->orderBy('created_at', 'desc');

        switch ($filter) {
            case 'pending':
                // Waiting for review: both legacy (AGREEMENT_SUBMITTED) and current
                // submission (PENDING_ADMIN_APPROVAL) can be pending, but never one
                // that has been rejected.
                $query->whereIn('status', ['AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])
                    ->where('approval_status', 'PENDING');
                break;
            case 'active':
                $query->where('status', 'ACTIVE');
                break;
            case 'rejected':
                $query->where('approval_status', 'REJECTED');
                break;
        }

        $tenancies = $query->get();

        $counts = [
            'total' => Tenancy::count(),
            'pending' => Tenancy::whereIn('status', ['AGREEMENT_SUBMITTED', 'PENDING_ADMIN_APPROVAL'])
                ->where('approval_status', 'PENDING')
                ->count(),
            'active' => Tenancy::where('status', 'ACTIVE')->count(),
            'rejected' => Tenancy::where('approval_status', 'REJECTED')->count(),
        ];

        $availableProperties = Property::where('status', 'AVAILABLE')->get();

        return Inertia::render('Admin/Tenants', [
            'tenancies' => $tenancies,
            'counts' => $counts,
            'activeFilter' => $filter,
            'availableProperties' => $availableProperties,
        ]);
    }

    /**
     * Invite a new Tenant.
     */
    public function inviteTenant(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'property_id' => 'required|exists:properties,id',
            'agreed_price' => 'required|numeric|min:0',
            'move_in_date' => 'required|date',
        ]);

        // Create or find user by email
        $user = User::firstOrCreate(
            ['email' => $validated['email']],
            ['name' => 'Invited Tenant', 'role' => 'TENANT', 'password' => null]
        );

        // Create tenancy
        Tenancy::create([
            'user_id' => $user->id,
            'property_id' => $validated['property_id'],
            'agreed_price' => $validated['agreed_price'],
            'move_in_date' => $validated['move_in_date'],
            'status' => 'INVITED',
        ]);

        return redirect()->back()->with('success', 'Tenant invited successfully.');
    }

    /**
     * Display the specific Tenancy Approval & Onboarding Process Page.
     */
    public function showApproval($id)
    {
        $tenancy = Tenancy::with(['user', 'property'])->findOrFail($id);
        $profile = TenantProfile::where('user_id', $tenancy->user_id)->first();
        $agreement = Agreement::where('tenancy_id', $tenancy->id)->first();
        $signatures = AgreementSignature::where('agreement_id', $agreement?->id)->get();

        $moveInDoc = RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->first();
        $waterMeter = WaterMeter::where('tenancy_id', $tenancy->id)->first();
        $approvedBy = $tenancy->approved_by ? User::find($tenancy->approved_by) : null;

        return Inertia::render('Admin/ApprovalDetail', [
            'tenancy' => $tenancy,
            'profile' => $profile,
            'agreement' => $agreement,
            'signatures' => $signatures,
            'approvedBy' => $approvedBy,
            'moveInDoc' => $moveInDoc,
            'waterMeter' => $waterMeter,
        ]);
    }

    /**
     * Serve a tenant's private KTP photo to admin reviewers.
     */
    public function getTenantKtpPhoto($id, $kind)
    {
        $tenancy = Tenancy::findOrFail($id);
        $profile = TenantProfile::where('user_id', $tenancy->user_id)->firstOrFail();

        $path = $kind === '2' ? ($profile->ktp_2_photo ?? null) : ($profile->ktp_1_photo ?? null);

        if (! $path || ! Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return Storage::disk('local')->response($path, basename($path));
    }

    /**
     * Approve a PENDING_ADMIN_APPROVAL tenant: activate account + occupied unit.
     */
    public function approveTenant($id)
    {
        $tenancy = Tenancy::findOrFail($id);

        abort_unless($tenancy->status === 'PENDING_ADMIN_APPROVAL', 422, 'Tenant tidak sedang dalam status menunggu persetujuan.');

        DB::transaction(function () use ($tenancy) {
            $tenancy->update([
                'status' => 'ACTIVE',
                'approval_status' => 'APPROVED',
                'approved_at' => now(),
                'approved_by' => \Illuminate\Support\Facades\Auth::id(),
                'rejection_reason' => null,
            ]);

            $property = Property::find($tenancy->property_id);
            if ($property && $property->status !== 'OCCUPIED') {
                $property->update(['status' => 'OCCUPIED']);
            }
        });

        return redirect()->route('admin.tenants.show', $tenancy->id)->with('success', 'Tenant disetujui dan diaktifkan.');
    }

    /**
     * Reject / ask revision for a pending tenant. Reason stored for tenant to see.
     */
    public function rejectTenant(Request $request, $id)
    {
        $tenancy = Tenancy::findOrFail($id);

        abort_unless($tenancy->status === 'PENDING_ADMIN_APPROVAL', 422, 'Tenant tidak sedang dalam status menunggu persetujuan.');

        $validated = $request->validate([
            'rejection_reason' => 'required|string|max:2000',
        ]);

        $tenancy->update([
            'approval_status' => 'REJECTED',
            'rejection_reason' => $validated['rejection_reason'],
            'approved_at' => null,
            'approved_by' => null,
        ]);

        return redirect()->back()->with('success', 'Tenant ditolak dan diminta perbaikan.');
    }

    /**
     * Reopen a rejected approval back into the review queue.
     */
    public function reopenApproval($id)
    {
        $tenancy = Tenancy::findOrFail($id);

        abort_unless($tenancy->approval_status === 'REJECTED', 422, 'Tenant tidak sedang dalam status ditolak.');

        $tenancy->update([
            'approval_status' => 'PENDING',
            'rejection_reason' => null,
        ]);

        return redirect()->back()->with('success', 'Review tenant dibuka kembali.');
    }

    /**
     * Step 1: Admin Approves the Data/Agreement
     */
    public function approveData($id)
    {
        $tenancy = Tenancy::findOrFail($id);
        $tenancy->update(['status' => 'PENDING_MOVE_IN_DOCUMENTATION']);

        return redirect()->back()->with('success', 'Data and Agreement approved. Please proceed with Room Documentation.');
    }

    /**
     * Step 2: Admin Submits Move-In Room Documentation
     */
    public function storeMoveInDoc(Request $request, $id)
    {
        $tenancy = Tenancy::findOrFail($id);

        $validated = $request->validate([
            'documentation_date' => 'required|date',
            'notes' => 'nullable|string',
            'photos.*' => 'required|image|max:5120',
        ]);

        $doc = RoomDocumentation::create([
            'property_id' => $tenancy->property_id,
            'tenancy_id' => $tenancy->id,
            'documentation_type' => 'MOVE_IN',
            'documentation_date' => $validated['documentation_date'],
            'notes' => $validated['notes'] ?? null,
            'created_by' => Auth::id(),
        ]);

        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('private/room_docs');
                RoomDocumentationMedia::create([
                    'documentation_id' => $doc->id,
                    'file_type' => 'IMAGE',
                    'file_path' => $path,
                    'original_name' => $photo->getClientOriginalName(),
                    'file_size' => $photo->getSize(),
                    'mime_type' => $photo->getMimeType(),
                ]);
            }
        }

        $tenancy->update(['status' => 'PENDING_WATER_METER']);

        return redirect()->back()->with('success', 'Move-in documentation saved. Please proceed with Initial Water Meter.');
    }

    /**
     * Step 3: Admin Submits Start Water Meter & Activates Tenant
     */
    public function storeStartWaterMeter(Request $request, $id)
    {
        $tenancy = Tenancy::findOrFail($id);

        $validated = $request->validate([
            'date' => 'required|date',
            'start_meter' => 'required|integer|min:0',
            'photo' => 'required|image|max:5120',
        ]);

        $path = $request->file('photo')->store('private/water_meters');

        // Create the initial water meter record
        WaterMeter::create([
            'tenancy_id' => $tenancy->id,
            'period_month' => (int) date('m', strtotime($validated['date'])),
            'period_year' => (int) date('Y', strtotime($validated['date'])),
            'previous_meter' => 0, // Since it's the start
            'current_meter' => $validated['start_meter'],
            'photo' => $path,
            'excess_usage_charge' => 0,
        ]);

        // Activate the tenant
        $tenancy->update(['status' => 'ACTIVE']);

        // Change Property status to OCCUPIED
        $property = Property::find($tenancy->property_id);
        if ($property) {
            $property->update(['status' => 'OCCUPIED']);
        }

        return redirect()->route('admin.tenants')->with('success', 'Tenant has been activated successfully!');
    }
}
