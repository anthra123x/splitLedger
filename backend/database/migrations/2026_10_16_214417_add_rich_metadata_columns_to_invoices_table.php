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
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('payment_method')->nullable()->after('currency');
            $table->string('iban')->nullable()->after('payment_method');
            $table->string('supplier_postal_code', 20)->nullable()->after('supplier_address');
            $table->string('supplier_city', 100)->nullable()->after('supplier_postal_code');
            $table->string('supplier_email', 150)->nullable()->after('supplier_city');
            $table->string('supplier_phone', 50)->nullable()->after('supplier_email');
            $table->string('customer_postal_code', 20)->nullable()->after('customer_address');
            $table->string('customer_city', 100)->nullable()->after('customer_postal_code');
            $table->string('customer_email', 150)->nullable()->after('customer_city');
            $table->string('customer_phone', 50)->nullable()->after('customer_email');
            $table->decimal('surcharge_total', 12, 2)->default(0)->after('tax_total');
            $table->json('extra_metadata')->nullable()->after('raw_ocr_text');
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->string('unit', 20)->default('uds')->after('quantity');
            $table->decimal('discount_amount', 10, 2)->default(0)->after('unit_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'payment_method',
                'iban',
                'supplier_postal_code',
                'supplier_city',
                'supplier_email',
                'supplier_phone',
                'customer_postal_code',
                'customer_city',
                'customer_email',
                'customer_phone',
                'surcharge_total',
                'extra_metadata',
            ]);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn(['unit', 'discount_amount']);
        });
    }
};
