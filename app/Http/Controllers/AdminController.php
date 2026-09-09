<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Http\Request;
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
            'stats' => $stats
        ]);
    }

    /**
     * Display the Property Management page.
     */
    public function properties()
    {
        $properties = Property::orderBy('name')->get();

        return Inertia::render('Admin/Properties', [
            'properties' => $properties
        ]);
    }

    /**
     * Store a new Property.
     */
    public function storeProperty(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:ROOM,KIOSK',
            'normal_price' => 'required|numeric|min:0',
            'status' => 'required|in:AVAILABLE,OCCUPIED,MAINTENANCE',
            'description' => 'nullable|string',
            'facilities' => 'nullable|array',
            'facilities.*' => 'string'
        ]);

        Property::create($validated);

        return redirect()->back()->with('success', 'Property created successfully.');
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
            'facilities.*' => 'string'
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
        $property->delete();

        return redirect()->back()->with('success', 'Property deleted successfully.');
    }

    /**
     * Store Media for a Property.
     */
    public function storeMedia(Request $request, $id, \App\Services\ImageWatermarkService $watermarkService)
    {
        $property = Property::findOrFail($id);

        $request->validate([
            'photos.*' => 'nullable|image|max:5120',
            'video' => 'nullable|mimes:mp4,mov,avi|max:51200',
        ]);

        try {
            if (!$request->hasFile('photos')) {
                return redirect()->back()->withErrors(['photos' => 'No files received by server. Keys: ' . implode(',', array_keys($request->all()))]);
            }

            if ($request->hasFile('photos')) {
                foreach ($request->file('photos') as $photo) {
                    $paths = $watermarkService->processAndStore($photo, $property->id);
                    
                    \Illuminate\Support\Facades\Log::info('Creating media for property ' . $property->id, $paths);

                    $media = new \App\Models\PropertyMedia();
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
                $filename = \Illuminate\Support\Str::random(40) . '.' . $video->getClientOriginalExtension();
                
                // Store on public disk
                $publicRelativePath = "properties/{$property->id}/videos/{$filename}";
                \Illuminate\Support\Facades\Storage::disk('public')->putFileAs("properties/{$property->id}/videos", $video, $filename);
                
                $media = new \App\Models\PropertyMedia();
                $media->property_id = $property->id;
                $media->type = 'VIDEO';
                $media->original_path = $publicRelativePath;
                $media->public_path = $publicRelativePath; // Store relative path
                $media->is_cover = false;
                $media->sort_order = $property->media()->count();
                $media->save();
            }

            return redirect()->back()->with('success', 'Media uploaded successfully.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['photos' => 'Server Error: ' . $e->getMessage()]);
        }
    }

    public function setCoverMedia($id, $mediaId)
    {
        $property = Property::findOrFail($id);
        $property->media()->update(['is_cover' => false]);
        $property->media()->where('id', $mediaId)->update(['is_cover' => true]);

        return redirect()->back()->with('success', 'Cover image updated.');
    }

    public function deleteMedia($id, $mediaId)
    {
        $media = \App\Models\PropertyMedia::where('property_id', $id)->findOrFail($mediaId);
        
        // Delete files
        \Illuminate\Support\Facades\Storage::delete($media->original_path);
        if ($media->public_path) {
            $publicRelative = str_replace('/storage/', 'public/', $media->public_path);
            \Illuminate\Support\Facades\Storage::delete($publicRelative);
        }

        $media->delete();

        return redirect()->back()->with('success', 'Media deleted.');
    }

    public function reorderMedia(Request $request, $id)
    {
        $validated = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer|exists:property_media,id'
        ]);

        foreach ($validated['order'] as $index => $mediaId) {
            \App\Models\PropertyMedia::where('property_id', $id)
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
                $query->where('status', 'PENDING_ADMIN_APPROVAL')->where('approval_status', 'PENDING');
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
            'pending' => Tenancy::where('status', 'PENDING_ADMIN_APPROVAL')->where('approval_status', 'PENDING')->count(),
            'active' => Tenancy::where('status', 'ACTIVE')->count(),
            'rejected' => Tenancy::where('approval_status', 'REJECTED')->count(),
        ];

        $availableProperties = Property::where('status', 'AVAILABLE')->get();

        return Inertia::render('Admin/Tenants', [
            'tenancies' => $tenancies,
            'counts' => $counts,
            'activeFilter' => $filter,
            'availableProperties' => $availableProperties
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
            'status' => 'INVITED'
        ]);

        return redirect()->back()->with('success', 'Tenant invited successfully.');
    }

    /**
     * Display the specific Tenancy Approval & Onboarding Process Page.
     */
    public function showApproval($id)
    {
        $tenancy = Tenancy::with(['user', 'property'])->findOrFail($id);
        $profile = \App\Models\TenantProfile::where('user_id', $tenancy->user_id)->first();
        $agreement = \App\Models\Agreement::where('tenancy_id', $tenancy->id)->first();
        $signatures = \App\Models\AgreementSignature::where('agreement_id', $agreement?->id)->get();
        
        $moveInDoc = \App\Models\RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->first();
        $waterMeter = \App\Models\WaterMeter::where('tenancy_id', $tenancy->id)->first();
        $approvedBy = $tenancy->approved_by ? User::find($tenancy->approved_by) : null;

        return Inertia::render('Admin/ApprovalDetail', [
            'tenancy' => $tenancy,
            'profile' => $profile,
            'agreement' => $agreement,
            'signatures' => $signatures,
            'approvedBy' => $approvedBy,
            'moveInDoc' => $moveInDoc,
            'waterMeter' => $waterMeter
        ]);
    }

    /**
     * Serve a tenant's private KTP photo to admin reviewers.
     */
    public function getTenantKtpPhoto($id, $kind)
    {
        $tenancy = Tenancy::findOrFail($id);
        $profile = \App\Models\TenantProfile::where('user_id', $tenancy->user_id)->firstOrFail();

        $path = $kind === '2' ? ($profile->ktp_2_photo ?? null) : ($profile->ktp_1_photo ?? null);

        if (!$path || !\Illuminate\Support\Facades\Storage::disk('local')->exists($path)) {
            abort(404);
        }

        return \Illuminate\Support\Facades\Storage::disk('local')->response($path, basename($path), ['Content-Type' => 'image/*']);
    }

    /**
     * Approve a PENDING_ADMIN_APPROVAL tenant: activate account + occupied unit.
     */
    public function approveTenant($id)
    {
        $tenancy = Tenancy::findOrFail($id);

        abort_unless($tenancy->status === 'PENDING_ADMIN_APPROVAL', 422, 'Tenant tidak sedang dalam status menunggu persetujuan.');

        \Illuminate\Support\Facades\DB::transaction(function () use ($tenancy) {
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

        $doc = \App\Models\RoomDocumentation::create([
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
                \App\Models\RoomDocumentationMedia::create([
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
        \App\Models\WaterMeter::create([
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
        $property = \App\Models\Property::find($tenancy->property_id);
        if($property) {
            $property->update(['status' => 'OCCUPIED']);
        }

        return redirect()->route('admin.tenants')->with('success', 'Tenant has been activated successfully!');
    }
}
