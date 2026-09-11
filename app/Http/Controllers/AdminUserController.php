<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class AdminUserController extends Controller
{
    /**
     * Manajemen akun Admin / User.
     *
     * Nilai role disimpan sebagai 'ADMIN' (colom role ber-constraint
     * ADMIN|TENANT); perbedaan Super Admin diwakili kolom is_super_admin.
     * Baris TENANT tidak pernah disentuh di controller ini.
     */
    public function index(): Response
    {
        $users = User::query()
            ->notDeleted()
            ->where('role', User::ROLE_ADMIN)
            ->orderByDesc('id')
            ->get();

        return Inertia::render('Admin/Users', [
            'users' => $users,
            'counts' => [
                'total' => $users->count(),
                'active' => $users->where('status', User::STATUS_ACTIVE)->count(),
                'inactive' => $users->where('status', User::STATUS_SUSPENDED)->count(),
            ],
        ]);
    }

    /**
     * Tambah Admin baru.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', Password::default(), 'confirmed'],
            'is_super_admin' => ['required', 'boolean'],
            'status' => ['required', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
        ])->validate();

        User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => User::ROLE_ADMIN,
            'is_super_admin' => $data['is_super_admin'],
            'status' => $data['status'],
            'email_verified_at' => now(),
        ]);

        return back()->with('success', 'Admin berhasil ditambahkan.');
    }

    /**
     * Edit data Admin.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        abort_if($user->deleted_at !== null, 404);
        abort_unless($user->role === User::ROLE_ADMIN, 404);

        $data = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'is_super_admin' => ['required', 'boolean'],
            'status' => ['required', Rule::in([User::STATUS_ACTIVE, User::STATUS_SUSPENDED])],
            'password' => ['nullable', 'string', Password::default(), 'confirmed'],
        ])->validate();

        $isSuperAfter = (bool) $data['is_super_admin'];

        // Proteksi 1: tidak boleh menurunkan hak Super Admin / menonaktifkan akun diri sendiri.
        $isSelf = $user->id === $request->user()->id;
        if ($isSelf && ($user->is_super_admin !== $isSuperAfter || $data['status'] !== $user->status)) {
            return back()->withErrors([
                '_form' => 'Anda tidak dapat mengubah hak akses atau status akun diri sendiri.',
            ])->withInput();
        }

        // Proteksi 2: satu-satunya Super Admin tidak boleh diturunkan haknya.
        if ($user->is_super_admin && ! $isSuperAfter && $this->isOnlySuperAdmin($user)) {
            return back()->withErrors([
                '_form' => 'Tidak dapat menurunkan satu-satunya Super Admin.',
            ])->withInput();
        }

        // Proteksi 3: setelah perubahan, sistem wajib masih punya minimal satu admin aktif.
        if (! $this->keepsAnActiveAdmin($user, $data['status'])) {
            return back()->withErrors([
                'status' => 'Sistem harus selalu memiliki setidaknya satu akun admin aktif.',
            ])->withInput();
        }

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->is_super_admin = $isSuperAfter;
        $user->status = $data['status'];
        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }
        $user->save();

        return back()->with('success', 'Data admin berhasil diperbarui.');
    }

    /**
     * Hapus Admin (soft delete — baris users dipertahankan untuk audit & relasi).
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($user->deleted_at !== null, 404);
        abort_unless($user->role === User::ROLE_ADMIN, 404);

        // Proteksi 1: tidak boleh menghapus akun diri sendiri.
        if ($user->id === $request->user()->id) {
            return back()->withErrors([
                '_form' => 'Anda tidak dapat menghapus akun diri sendiri.',
            ]);
        }

        // Proteksi 2: satu-satunya Super Admin tidak boleh dihapus.
        if ($this->isOnlySuperAdmin($user)) {
            return back()->withErrors([
                '_form' => 'Tidak dapat menghapus satu-satunya Super Admin.',
            ]);
        }

        // Proteksi 3: akun terakhir yang membuat sistem tetap punya admin aktif.
        if ($user->status === User::STATUS_ACTIVE && ! $this->hasOtherActiveAdmin($user)) {
            return back()->withErrors([
                '_form' => 'Sistem harus selalu memiliki setidaknya satu akun admin aktif.',
            ]);
        }

        $user->forceFill(['deleted_at' => now()])->save();

        return back()->with('success', 'Admin berhasil dihapus.');
    }

    /**
     * True when the target is the only remaining Super Admin account.
     */
    protected function isOnlySuperAdmin(User $target): bool
    {
        return ! User::query()
            ->notDeleted()
            ->where('is_super_admin', true)
            ->where('id', '!=', $target->id)
            ->exists();
    }

    /**
     * True when at least one other ACTIVE admin account (besides the target)
     * exists — used before removing/deleting an account.
     */
    protected function hasOtherActiveAdmin(User $target): bool
    {
        return User::query()
            ->notDeleted()
            ->where('role', User::ROLE_ADMIN)
            ->where('status', User::STATUS_ACTIVE)
            ->where('id', '!=', $target->id)
            ->exists();
    }

    /**
     * True when the system still has at least one ACTIVE admin after the target
     * is changed to the given status.
     */
    protected function keepsAnActiveAdmin(User $target, string $newStatus): bool
    {
        $count = User::query()
            ->notDeleted()
            ->where('role', User::ROLE_ADMIN)
            ->where('status', User::STATUS_ACTIVE)
            ->count();

        $targetActiveNow = $target->status === User::STATUS_ACTIVE;
        $targetActiveAfter = $newStatus === User::STATUS_ACTIVE;

        return $count - ($targetActiveNow ? 1 : 0) + ($targetActiveAfter ? 1 : 0) >= 1;
    }
}
