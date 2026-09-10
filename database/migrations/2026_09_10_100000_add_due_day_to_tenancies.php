<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenancies', function (Blueprint $table) {
            $table->unsignedTinyInteger('due_day')->nullable()->after('move_in_date');
        });
    }

    public function down(): void
    {
        Schema::table('tenancies', function (Blueprint $table) {
            $table->dropColumn('due_day');
        });
    }
};