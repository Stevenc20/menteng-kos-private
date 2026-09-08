<?php

namespace App\Http\Controllers;

use App\Models\Tenancy;
use App\Models\RoomDocumentation;
use App\Models\RoomDocumentationMedia;
use App\Models\WaterMeter;
use App\Models\Billing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MoveOutController extends Controller
{
    /**
     * Show Move-Out Documentation Comparison and Settlement Form
     */
    public function show($tenancyId)
    {
        $tenancy = Tenancy::with(['property', 'user'])->findOrFail($tenancyId);
        
        $moveInDoc = RoomDocumentation::with('media')
            ->where('tenancy_id', $tenancy->id)
            ->where('documentation_type', 'MOVE_IN')
            ->first();
            
        $moveOutDoc = RoomDocumentation::with('media')
            ->where('tenancy_id', $tenancy->id)
            ->where('documentation_type', 'MOVE_OUT')
            ->first();

        // Check if there are any outstanding bills
        $outstandingBills = Billing::where('tenancy_id', $tenancy->id)
            ->whereIn('status', ['UPCOMING', 'REMINDER_SENT', 'PENDING_PAYMENT', 'OVERDUE'])
            ->get();

        return inertia('Admin/MoveOutDetail', [
            'tenancy' => $tenancy,
            'moveInDoc' => $moveInDoc,
            'moveOutDoc' => $moveOutDoc,
            'outstandingBills' => $outstandingBills
        ]);
    }

    /**
     * Store Move-Out Room Documentation
     */
    public function storeDocumentation(Request $request, $tenancyId)
    {
        $tenancy = Tenancy::findOrFail($tenancyId);

        $validated = $request->validate([
            'documentation_date' => 'required|date',
            'notes' => 'nullable|string',
            'photos.*' => 'required|image|max:5120',
        ]);

        $doc = RoomDocumentation::create([
            'property_id' => $tenancy->property_id,
            'tenancy_id' => $tenancy->id,
            'documentation_type' => 'MOVE_OUT',
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

        return redirect()->back()->with('success', 'Move-out documentation saved.');
    }

    /**
     * Finalize Move-Out and Archive Tenant
     */
    public function finalize(Request $request, $tenancyId)
    {
        $tenancy = Tenancy::findOrFail($tenancyId);
        
        // Ensure there's no pending payment if strict settlement is required.
        // For now, Admin has the authority to bypass or they can settle it physically.
        
        // 1. Mark Tenancy as ARCHIVED
        $tenancy->update(['status' => 'ARCHIVED']);
        
        // 2. Mark User as INACTIVE (or keep them active if they might rent again, but usually we just leave their role)
        $tenancy->user->update(['status' => 'INACTIVE']);
        
        // 3. Mark Property as AVAILABLE or MAINTENANCE
        $validated = $request->validate([
            'property_status' => 'required|in:AVAILABLE,MAINTENANCE'
        ]);

        $tenancy->property->update([
            'status' => $validated['property_status']
        ]);

        return redirect()->route('admin.tenants')->with('success', 'Tenant Move-Out has been finalized and archived.');
    }
}
