<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Additive, safe columns for room documentation media:
     *  - source           : where the file came from (PROPERTY / UPLOAD / CAMERA).
     *                       Legacy rows fall back to 'UPLOAD'.
     *  - property_media_id: reference to the property media row this snapshot
     *                       was copied from (nullable; PROPERTY source only).
     */
    public function up(): void
    {
        Schema::table('room_documentation_media', function (Blueprint $table) {
            $table->string('source')->default('UPLOAD')->after('file_type');
            $table->unsignedBigInteger('property_media_id')->nullable()->after('source');

            $table->foreign('property_media_id')
                ->references('id')
                ->on('property_media')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('room_documentation_media', function (Blueprint $table) {
            $table->dropForeign(['property_media_id']);
            $table->dropColumn(['property_media_id', 'source']);
        });
    }
};
