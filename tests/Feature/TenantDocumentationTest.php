<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use App\Models\User;
use App\Models\Tenancy;
use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\RoomDocumentation;

class TenantDocumentationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
    }

    public function test_existing_data_is_untouched_when_adding_documentation()
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@test.com', 'password' => '123', 'role' => 'ADMIN']);
        $tenant = User::create(['name' => 'Tenant', 'email' => 't1@test.com', 'password' => '123', 'role' => 'TENANT']);
        $property = Property::create(['name' => 'Kios A', 'type' => 'KIOSK', 'normal_price' => 1000000]);
        
        $tenancy = Tenancy::create([
            'user_id' => $tenant->id,
            'property_id' => $property->id,
            'agreed_price' => 1500000,
            'move_in_date' => '2026-09-01',
            'status' => 'ACTIVE'
        ]);

        $tenancyCountBefore = Tenancy::count();
        $propertyCountBefore = Property::count();

        $file = UploadedFile::fake()->create('before.jpg', 100, 'image/jpeg');

        $response = $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'photos' => [$file]
        ]);

        $response->assertStatus(302);
        
        // Assert counts remain identical
        $this->assertEquals($tenancyCountBefore, Tenancy::count());
        $this->assertEquals($propertyCountBefore, Property::count());

        $this->assertDatabaseHas('room_documentations', [
            'tenancy_id' => $tenancy->id,
            'documentation_type' => 'MOVE_IN'
        ]);
    }

    public function test_can_upload_old_statement_letter()
    {
        $admin = User::create(['name' => 'Admin2', 'email' => 'admin2@test.com', 'password' => '123', 'role' => 'ADMIN']);
        $tenant = User::create(['name' => 'Tenant2', 'email' => 't2@test.com', 'password' => '123', 'role' => 'TENANT']);
        $property = Property::create(['name' => 'Kios B', 'type' => 'KIOSK', 'normal_price' => 1000000]);
        
        $tenancy = Tenancy::create([
            'user_id' => $tenant->id,
            'property_id' => $property->id,
            'agreed_price' => 1500000,
            'move_in_date' => '2026-09-01'
        ]);

        $file = UploadedFile::fake()->create('surat.jpg', 100, 'image/jpeg');

        $response = $this->actingAs($admin)->post(route('admin.tenants.agreements.upload', $tenancy->id), [
            'document' => $file
        ]);

        $response->assertStatus(302);
        
        $this->assertDatabaseHas('agreements', [
            'tenancy_id' => $tenancy->id,
            'uploaded_document_type' => 'image/jpeg'
        ]);
        
        Storage::disk('local')->assertExists('agreements_scans/' . $file->hashName());
    }

    public function test_can_copy_property_media_to_before_documentation()
    {
        $admin = User::create(['name' => 'Admin3', 'email' => 'admin3@test.com', 'password' => '123', 'role' => 'ADMIN']);
        $tenant = User::create(['name' => 'Tenant3', 'email' => 't3@test.com', 'password' => '123', 'role' => 'TENANT']);
        $property = Property::create(['name' => 'Kios C', 'type' => 'KIOSK', 'normal_price' => 1000000]);
        
        $tenancy = Tenancy::create([
            'user_id' => $tenant->id,
            'property_id' => $property->id,
            'agreed_price' => 1500000,
            'move_in_date' => '2026-09-01'
        ]);

        // Fake existing property media file
        Storage::disk('public')->put('properties/test.jpg', 'fake content');

        $propMedia = PropertyMedia::create([
            'property_id' => $property->id,
            'type' => 'IMAGE',
            'original_path' => 'properties/test.jpg',
            'is_cover' => false,
            'sort_order' => 1
        ]);

        $response = $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_id' => $propMedia->id
        ]);

        $response->assertStatus(302);
        
        // Assert original file STILL exists
        Storage::disk('public')->assertExists('properties/test.jpg');

        // Assert new copied file exists in room_documentations
        $doc = RoomDocumentation::where('tenancy_id', $tenancy->id)->first();
        $media = $doc->media()->first();
        
        $this->assertNotNull($media);
        Storage::disk('public')->assertExists($media->file_path);
    }
}

