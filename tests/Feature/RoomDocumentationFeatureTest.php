<?php

namespace Tests\Feature;

use App\Models\Agreement;
use App\Models\Property;
use App\Models\PropertyMedia;
use App\Models\RoomDocumentation;
use App\Models\RoomDocumentationMedia;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RoomDocumentationFeatureTest extends TestCase
{
    use RefreshDatabase;

    private const PLACEHOLDER = '<div style="border:1.5px dashed #999;height:110px;margin:4px 0 14px;"></div>';

    private const HEADING = '<p style="font-weight:bold;">Dokumentasi kios saat diserahkan</p>';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
    }

    private function makeAdmin(): User
    {
        return User::create(['name' => 'Admin', 'email' => 'admin@doc.test', 'password' => 'x', 'role' => 'ADMIN']);
    }

    private function makeTenancy(Property $property): Tenancy
    {
        $tenant = User::create(['name' => 'Tenant', 'email' => 'tenant@doc.test', 'password' => 'x', 'role' => 'TENANT']);

        return Tenancy::create([
            'user_id' => $tenant->id,
            'property_id' => $property->id,
            'agreed_price' => 1000000,
            'move_in_date' => '2026-09-01',
            'status' => 'ACTIVE',
        ]);
    }

    private function makePropertyWithMedia(int $count, string $name = 'KIOS', string $type = 'KIOSK'): Property
    {
        $property = Property::create(['name' => $name, 'type' => $type, 'normal_price' => 1000000]);

        for ($i = 1; $i <= $count; $i++) {
            $file = "properties/{$property->id}/f{$i}.jpg";
            Storage::disk('public')->put($file, "content-{$i}");

            PropertyMedia::create([
                'property_id' => $property->id,
                'type' => 'IMAGE',
                'original_path' => "properties/{$property->id}/originals/f{$i}.jpg",
                'public_path' => $file,
                'is_cover' => $i === 1,
                'sort_order' => $i,
            ]);
        }

        return $property;
    }

    private function kioskStatementHtml(): string
    {
        return '<html>'.$this::HEADING.'<p>Isi surat lain.</p>'.$this::PLACEHOLDER.'<p>Penutup.</p></html>';
    }

    private function pageProps($response): array
    {
        $props = null;
        $response->assertInertia(function ($page) use (&$props) {
            $props = $page->toArray()['props'];
        });

        return $props;
    }

    public function test_selecting_all_property_photos_saves_5_before_documentation(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(5);
        $tenancy = $this->makeTenancy($property);
        $ids = PropertyMedia::where('property_id', $property->id)->pluck('id')->all();

        $response = $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_ids' => $ids,
        ]);

        $response->assertStatus(302);

        $doc = RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->first();
        $this->assertNotNull($doc);
        $this->assertCount(5, $doc->media);

        foreach ($doc->media as $media) {
            $this->assertEquals('PROPERTY', $media->source);
            $this->assertNotNull($media->property_media_id);
            $this->assertTrue(in_array($media->property_media_id, $ids, true));
            Storage::disk('public')->assertExists($media->file_path);
        }

        // Property originals are untouched.
        $this->assertCount(5, PropertyMedia::where('property_id', $property->id)->get());
    }

    public function test_before_documentation_persists_and_survives_refresh(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(5);
        $tenancy = $this->makeTenancy($property);
        $ids = PropertyMedia::where('property_id', $property->id)->pluck('id')->all();

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_ids' => $ids,
        ]);

        // Simulate a page refresh: fresh DB query + re-render of the page props.
        $props = $this->pageProps($this->actingAs($admin)->get(route('admin.tenants.show', $tenancy->id))->assertOk());

        $this->assertCount(5, $props['moveInDoc']['media'] ?? []);
        $this->assertCount(5, RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->first()->media);
    }

    public function test_deleting_one_documentation_photo_keeps_property_photo(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(5);
        $tenancy = $this->makeTenancy($property);
        $ids = PropertyMedia::where('property_id', $property->id)->pluck('id')->all();

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_ids' => $ids,
        ]);

        $doc = RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->first();
        $toDelete = $doc->media->first();

        $this->actingAs($admin)->delete(route('admin.tenants.documentations.media.destroy', $toDelete->id));

        $this->assertCount(4, $doc->fresh()->media);
        $this->assertCount(5, PropertyMedia::where('property_id', $property->id)->get());
        // The copied snapshot is gone, the property sub-files remain.
        Storage::disk('public')->assertMissing($toDelete->file_path);
        foreach (PropertyMedia::where('property_id', $property->id)->get() as $pm) {
            Storage::disk('public')->assertExists($pm->public_path);
        }
    }

    public function test_statement_page_injects_all_before_photos_but_keeps_stored_snapshot(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(4);
        $tenancy = $this->makeTenancy($property);
        $ids = PropertyMedia::where('property_id', $property->id)->pluck('id')->all();

        Agreement::create([
            'tenancy_id' => $tenancy->id,
            'document_html' => $this->kioskStatementHtml(),
            'status' => 'SIGNED',
            'signed_at' => now(),
        ]);

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_ids' => $ids,
        ]);

        $props = $this->pageProps($this->actingAs($admin)->get(route('admin.tenants.show', $tenancy->id))->assertOk());
        $served = $props['agreement']['document_html'];

        $this->assertStringNotContainsString($this::PLACEHOLDER, $served);
        $this->assertStringContainsString($this::HEADING, $served);
        $this->assertSame(4, preg_match_all('/<img src="\/storage\/room_documentations\//', $served));

        // The stored, signed snapshot itself is NEVER rewritten.
        $this->assertSame($this->kioskStatementHtml(), Agreement::first()->document_html);
    }

    public function test_statement_can_render_all_ten_property_photos(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(10);
        $tenancy = $this->makeTenancy($property);
        $ids = PropertyMedia::where('property_id', $property->id)->pluck('id')->all();

        Agreement::create([
            'tenancy_id' => $tenancy->id,
            'document_html' => $this->kioskStatementHtml(),
            'status' => 'SIGNED',
        ]);

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_ids' => $ids,
        ]);

        $props = $this->pageProps($this->actingAs($admin)->get(route('admin.tenants.show', $tenancy->id))->assertOk());
        $this->assertSame(10, preg_match_all('/<img src="\/storage\/room_documentations\//', $props['agreement']['document_html']));
        // 2-column grid wrapper is present.
        $this->assertStringContainsString('grid-template-columns:repeat(2,1fr)', $props['agreement']['document_html']);
    }

    public function test_manual_upload_goes_to_before_and_into_statement(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(0);
        $tenancy = $this->makeTenancy($property);

        Agreement::create([
            'tenancy_id' => $tenancy->id,
            'document_html' => $this->kioskStatementHtml(),
            'status' => 'SIGNED',
        ]);

        $file = UploadedFile::fake()->create('manual.jpg', 1024, 'image/jpeg');

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'photos' => [$file],
            'source' => 'UPLOAD',
        ]);

        $media = RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->firstOrFail()->media;
        $this->assertCount(1, $media);
        $this->assertEquals('UPLOAD', $media->first()->source);
        $this->assertNull($media->first()->property_media_id);
        Storage::disk('public')->assertExists($media->first()->file_path);

        $props = $this->pageProps($this->actingAs($admin)->get(route('admin.tenants.show', $tenancy->id))->assertOk());
        $this->assertSame(1, preg_match_all('/<img src="\/storage\/room_documentations\//', $props['agreement']['document_html']));
    }

    public function test_camera_upload_is_tagged_camera_and_enters_statement(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(0);
        $tenancy = $this->makeTenancy($property);

        Agreement::create([
            'tenancy_id' => $tenancy->id,
            'document_html' => $this->kioskStatementHtml(),
            'status' => 'SIGNED',
        ]);

        $file = UploadedFile::fake()->create('kamera.jpg', 1024, 'image/jpeg');

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'photos' => [$file],
            'source' => 'CAMERA',
        ]);

        $media = RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->firstOrFail()->media;
        $this->assertEquals('CAMERA', $media->first()->source);

        $props = $this->pageProps($this->actingAs($admin)->get(route('admin.tenants.show', $tenancy->id))->assertOk());
        $this->assertSame(1, preg_match_all('/<img src="\/storage\/room_documentations\//', $props['agreement']['document_html']));
    }

    public function test_after_photos_never_enter_the_statement(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(2);
        $tenancy = $this->makeTenancy($property);

        Agreement::create([
            'tenancy_id' => $tenancy->id,
            'document_html' => $this->kioskStatementHtml(),
            'status' => 'SIGNED',
        ]);

        $file = UploadedFile::fake()->create('after.jpg', 1024, 'image/jpeg');
        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_OUT',
            'photos' => [$file],
        ]);

        $props = $this->pageProps($this->actingAs($admin)->get(route('admin.tenants.show', $tenancy->id))->assertOk());

        $this->assertCount(1, $props['moveOutDoc']['media']);
        $this->assertNull($props['moveInDoc']);
        // Statement served unchanged (still the placeholder) because only MOVE_OUT exists.
        $this->assertStringContainsString($this::PLACEHOLDER, $props['agreement']['document_html']);
    }

    public function test_legacy_documentation_rows_without_source_default_to_upload(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(0);
        $tenancy = $this->makeTenancy($property);

        $doc = RoomDocumentation::create([
            'property_id' => $property->id,
            'tenancy_id' => $tenancy->id,
            'documentation_type' => 'MOVE_IN',
            'documentation_date' => now()->toDateString(),
            'created_by' => $admin->id,
        ]);

        $media = $doc->media()->create([
            'file_type' => 'IMAGE',
            'file_path' => 'room_documentations/legacy.jpg',
            'original_name' => 'legacy.jpg',
        ]);

        $media = $media->fresh();
        $this->assertEquals('UPLOAD', $media->source);
        $this->assertNull($media->property_media_id);

        // Migration did not delete existing rows.
        $this->assertDatabaseHas('room_documentation_media', ['id' => $media->id]);
    }

    public function test_photo_from_a_different_property_is_rejected(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(2);
        $other = $this->makePropertyWithMedia(2, 'OTHER KIOS');
        $tenancy = $this->makeTenancy($property);

        $foreignMedia = PropertyMedia::where('property_id', $other->id)->first();

        $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
            'type' => 'MOVE_IN',
            'property_media_ids' => [$foreignMedia->id],
        ]);

        // No documentation row and no media rows are created for foreign photos.
        $this->assertFalse(RoomDocumentation::where('tenancy_id', $tenancy->id)
            ->where('documentation_type', 'MOVE_IN')
            ->exists());
        $this->assertTrue(RoomDocumentationMedia::where('documentation_id', $tenancy->id)->get()->isEmpty());
        Storage::disk('public')->assertExists($foreignMedia->public_path);
    }

    public function test_reopening_modal_does_not_duplicate_property_photos(): void
    {
        $admin = $this->makeAdmin();
        $property = $this->makePropertyWithMedia(5);
        $tenancy = $this->makeTenancy($property);
        $ids = PropertyMedia::where('property_id', $property->id)->pluck('id')->all();

        // Admin saves the same selection twice (modal reopened).
        foreach ([0, 1] as $_) {
            $this->actingAs($admin)->post(route('admin.tenants.documentations.store', $tenancy->id), [
                'type' => 'MOVE_IN',
                'property_media_ids' => $ids,
            ]);
        }

        $doc = RoomDocumentation::where('tenancy_id', $tenancy->id)->where('documentation_type', 'MOVE_IN')->firstOrFail();
        $this->assertCount(5, $doc->media);
        $this->assertCount(5, $doc->media->unique('property_media_id'));
    }
}
