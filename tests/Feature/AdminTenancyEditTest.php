<?php

test('admin can edit tenancy details price move_in_date and due_day', function () {
    $admin = \App\Models\User::factory()->create(['role' => 'ADMIN']);
    $tenantUser = \App\Models\User::factory()->create(['role' => 'TENANT']);
    $property = \App\Models\Property::create([
        'name' => 'Unit A',
        'type' => 'KIOSK',
        'status' => 'OCCUPIED',
        'normal_price' => 2000000,
    ]);
    $tenancy = \App\Models\Tenancy::create([
        'user_id' => $tenantUser->id,
        'property_id' => $property->id,
        'agreed_price' => 1700000,
        'move_in_date' => '2026-09-09',
        'status' => 'ACTIVE',
    ]);

    $response = $this->actingAs($admin)->put("/admin/tenants/{$tenancy->id}/details", [
        'agreed_price' => 1500000,
        'move_in_date' => '2026-10-01',
        'due_day' => 5,
    ]);

    $response->assertRedirect();

    $tenancy->refresh();
    expect((float) $tenancy->agreed_price)->toBe(1500000.0);
    expect($tenancy->move_in_date)->toBe('2026-10-01');
    expect($tenancy->due_day)->toBe(5);
});