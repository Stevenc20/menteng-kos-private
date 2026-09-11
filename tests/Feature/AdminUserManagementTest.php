<?php

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

function auAdmin(): User
{
    return User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE', 'is_super_admin' => false, 'email_verified_at' => now()]);
}

function auSuper(): User
{
    return User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE', 'is_super_admin' => true, 'email_verified_at' => now()]);
}

function auTenant(): User
{
    return User::factory()->create(['role' => 'TENANT', 'status' => 'ACTIVE']);
}

it('admin berwenang dapat membuka halaman Admin / User', function () {
    $this->actingAs(auAdmin())->get('/admin/users')->assertOk();
});

it('user tanpa authorization tidak dapat membuka halaman Admin / User', function () {
    $admin = auAdmin();

    $this->get('/admin/users')->assertRedirect('/login');

    $this->actingAs(auTenant())->get('/admin/users')->assertForbidden();

    $this->actingAs($admin)
        ->get('/admin/users')
        ->assertOk();
});

it('admin baru dapat dibuat, email terdaftar, dan password tersimpan sebagai hash', function () {
    $this->actingAs(auSuper())->post('/admin/users', [
        'name' => 'Budi Admin',
        'email' => 'budi@mentengkos.id',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
        'is_super_admin' => true,
        'status' => 'ACTIVE',
    ])->assertRedirect();

    $this->assertDatabaseHas('users', [
        'email' => 'budi@mentengkos.id',
        'role' => 'ADMIN',
        'is_super_admin' => true,
        'status' => 'ACTIVE',
    ]);

    $user = User::where('email', 'budi@mentengkos.id')->first();
    expect($user->password)->not->toBe('rahasia123')
        ->and(Hash::check('rahasia123', $user->password))->toBeTrue();
});

it('email admin harus unik di tabel users', function () {
    $admin = auAdmin();

    $this->actingAs(auSuper())->post('/admin/users', [
        'name' => 'Duplikat',
        'email' => $admin->email,
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
        'is_super_admin' => false,
        'status' => 'ACTIVE',
    ])->assertSessionHasErrors('email');

    expect(User::where('email', $admin->email)->count())->toBe(1);
});

it('admin dapat diedit: nama, email, hak akses, status', function () {
    $admin = auAdmin();
    $this->actingAs(auSuper())->put("/admin/users/{$admin->id}", [
        'name' => 'Nama Baru',
        'email' => 'baru@mentengkos.id',
        'is_super_admin' => true,
        'status' => 'SUSPENDED',
        'password' => '',
    ])->assertRedirect();

    $this->assertDatabaseHas('users', [
        'id' => $admin->id,
        'name' => 'Nama Baru',
        'email' => 'baru@mentengkos.id',
        'role' => 'ADMIN',
        'is_super_admin' => true,
        'status' => 'SUSPENDED',
    ]);
});

it('password baru hanya diganti jika diisi saat edit', function () {
    $admin = auAdmin();
    $oldHash = $admin->password;

    // tanpa password baru -> hash tetap
    $this->actingAs(auSuper())->put("/admin/users/{$admin->id}", [
        'name' => $admin->name,
        'email' => $admin->email,
        'is_super_admin' => false,
        'status' => 'ACTIVE',
        'password' => '',
    ])->assertRedirect();
    expect($admin->fresh()->password)->toBe($oldHash);

    // dengan password baru -> hash ikut berubah
    $this->actingAs(auSuper())->put("/admin/users/{$admin->id}", [
        'name' => $admin->name,
        'email' => $admin->email,
        'is_super_admin' => false,
        'status' => 'ACTIVE',
        'password' => 'passwordbaru99',
        'password_confirmation' => 'passwordbaru99',
    ])->assertRedirect();
    expect(Hash::check('passwordbaru99', $admin->fresh()->password))->toBeTrue();
});

it('admin aktif dapat login dengan email+password dan last_login_at tercatat', function () {
    $admin = auAdmin();

    $this->post('/login', [
        'email' => $admin->email,
        'password' => 'password',
    ])->assertRedirect('/dashboard');

    $this->assertAuthenticatedAs($admin);
    expect($admin->fresh()->last_login_at)->not->toBeNull();
});

it('admin nonaktif tidak dapat login', function () {
    $admin = User::factory()->create([
        'role' => 'ADMIN',
        'status' => 'SUSPENDED',
        'is_super_admin' => false,
        'email_verified_at' => now(),
    ]);

    $this->post('/login', [
        'email' => $admin->email,
        'password' => 'password',
    ])->assertSessionHasErrors();

    $this->assertGuest();
    expect($admin->fresh()->last_login_at)->toBeNull();
});

it('user tidak dapat menghapus akun dirinya sendiri', function () {
    $admin = auAdmin();

    $this->actingAs($admin)->delete("/admin/users/{$admin->id}")->assertSessionHasErrors('_form');

    expect($admin->fresh()->deleted_at)->toBeNull();
});

it('user tidak dapat menonaktifkan akun dirinya sendiri', function () {
    $admin = auAdmin();

    $this->actingAs($admin)->put("/admin/users/{$admin->id}", [
        'name' => $admin->name,
        'email' => $admin->email,
        'is_super_admin' => false,
        'status' => 'SUSPENDED',
    ])->assertSessionHasErrors('_form');

    expect($admin->fresh()->status)->toBe('ACTIVE');
});

it('satu-satunya Super Admin tidak dapat dihapus atau diturunkan haknya', function () {
    $super = auSuper();

    $this->actingAs($super)->delete("/admin/users/{$super->id}")->assertSessionHasErrors('_form');
    expect($super->fresh()->deleted_at)->toBeNull();

    $this->actingAs($super)->put("/admin/users/{$super->id}", [
        'name' => $super->name,
        'email' => $super->email,
        'is_super_admin' => false,
        'status' => 'ACTIVE',
    ])->assertSessionHasErrors('_form');
    expect($super->fresh()->is_super_admin)->toBeTrue();
});

it('admin terakhir yang aktif tidak dapat dinonaktifkan atau dihapus', function () {
    $suspendedActor = auSuper();
    $suspendedActor->update(['status' => 'SUSPENDED']);
    $target = auAdmin();

    $this->actingAs($suspendedActor)->put("/admin/users/{$target->id}", [
        'name' => $target->name,
        'email' => $target->email,
        'is_super_admin' => false,
        'status' => 'SUSPENDED',
    ])->assertSessionHasErrors('status');

    $this->actingAs($suspendedActor)->delete("/admin/users/{$target->id}")->assertSessionHasErrors('_form');

    expect($target->fresh()->status)->toBe('ACTIVE')
        ->and($target->fresh()->deleted_at)->toBeNull();
});

it('penghapusan admin menggunakan soft delete dan baris tetap tersimpan', function () {
    $keeper = auSuper();
    $target = auAdmin();

    $this->actingAs($keeper)->delete("/admin/users/{$target->id}")->assertRedirect();

    $this->assertDatabaseHas('users', ['id' => $target->id]);
    expect($target->fresh()->deleted_at)->not->toBeNull();
});

it('data tenant existing tidak berubah setelah operasi admin', function () {
    $admin = auSuper();

    $property = Property::create([
        'name' => 'KAMAR A-01',
        'type' => 'ROOM',
        'normal_price' => 1500000,
        'status' => 'OCCUPIED',
    ]);
    $tenant = auTenant();
    Tenancy::create([
        'user_id' => $tenant->id,
        'property_id' => $property->id,
        'agreed_price' => 1500000,
        'move_in_date' => '2026-08-01',
        'status' => 'ACTIVE',
    ]);

    $snapshot = [
        'name' => $tenant->name,
        'email' => $tenant->email,
        'role' => $tenant->role,
        'status' => $tenant->status,
        'deleted_at' => null,
    ];

    $this->actingAs($admin)->post('/admin/users', [
        'name' => 'Admin Baru',
        'email' => 'baru@mentengkos.id',
        'password' => 'rahasia123',
        'password_confirmation' => 'rahasia123',
        'is_super_admin' => false,
        'status' => 'ACTIVE',
    ])->assertRedirect();

    $newAdmin = User::where('email', 'baru@mentengkos.id')->firstOrFail();
    $this->actingAs($admin)->put("/admin/users/{$newAdmin->id}", [
        'name' => 'Admin Editan',
        'email' => 'editan@mentengkos.id',
        'is_super_admin' => false,
        'status' => 'SUSPENDED',
    ])->assertRedirect();

    $this->actingAs($admin)->delete("/admin/users/{$newAdmin->id}")->assertRedirect();

    $this->assertDatabaseHas('users', ['id' => $tenant->id, ...$snapshot]);
    $this->assertDatabaseHas('tenancies', [
        'user_id' => $tenant->id,
        'property_id' => $property->id,
        'status' => 'ACTIVE',
    ]);
    $this->assertDatabaseHas('properties', ['id' => $property->id, 'status' => 'OCCUPIED']);
    expect(User::where('role', 'TENANT')->count())->toBe(1);
});
