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
            'status' => 'required|in:AVAILABLE,OCCUPIED,MAINTENANCE'
        ]);

        Property::create($validated);

        return redirect()->back()->with('success', 'Property created successfully.');
    }

    /**
     * Display the Tenants and Invitations page.
     */
    public function tenants()
    {
        // Load tenancies along with user and property for the UI
        $tenancies = Tenancy::with(['user', 'property'])->orderBy('created_at', 'desc')->get();
        $availableProperties = Property::where('status', 'AVAILABLE')->get();

        return Inertia::render('Admin/Tenants', [
            'tenancies' => $tenancies,
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
        
        $moveInDoc = \App\Models\RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->first();
        $waterMeter = \App\Models\WaterMeter::where('tenancy_id', $tenancy->id)->first();

        return Inertia::render('Admin/ApprovalDetail', [
            'tenancy' => $tenancy,
            'profile' => $profile,
            'agreement' => $agreement,
            'moveInDoc' => $moveInDoc,
            'waterMeter' => $waterMeter
        ]);
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
