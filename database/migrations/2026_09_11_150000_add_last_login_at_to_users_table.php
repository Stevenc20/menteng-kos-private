<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive: records the last successful login timestamp for admin accounts
     * and a boolean flag marking a Super Admin.
     * role/status columns already exist on users and are reused as-is.
     * (The role column CHECK constraint only allows ADMIN|TENANT, so super
     * admin status is stored via the separate boolean instead.)
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_super_admin')->default(false)->after('status');
            $table->timestamp('last_login_at')->nullable()->after('is_super_admin');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_super_admin', 'last_login_at']);
        });
    }
};
