<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Soft-deleted admin accounts no longer block reuse of their email.
     * The email column keeps its uniqueness, but only among non-deleted rows
     * (partial unique index). Table rebuild on sqlite preserves all data.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->change();
        });

        DB::statement('DROP INDEX IF EXISTS users_email_unique');
        DB::statement('DROP INDEX IF EXISTS users_email_unique_active');
        DB::statement('CREATE UNIQUE INDEX users_email_unique_active ON users (email) WHERE deleted_at IS NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS users_email_unique_active');
        DB::statement('CREATE UNIQUE INDEX users_email_unique ON users (email)');
    }
};
