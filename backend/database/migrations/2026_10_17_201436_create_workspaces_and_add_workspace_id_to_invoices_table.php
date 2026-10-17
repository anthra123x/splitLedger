<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('workspaces', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('color', 30)->default('#ffffff');
            $table->string('icon', 50)->default('folder');
            $table->boolean('is_archived')->default(false);
            $table->timestamps();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->uuid('workspace_id')->nullable()->index()->after('id');
            $table->foreign('workspace_id')
                  ->references('id')
                  ->on('workspaces')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->dropColumn('workspace_id');
        });

        Schema::dropIfExists('workspaces');
    }
};
