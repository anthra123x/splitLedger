<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class InvoiceItem extends Model
{
    protected $table = 'invoice_items';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'item_index' => 'integer',
        'quantity' => 'float',
        'unit_price' => 'float',
        'discount_amount' => 'float',
        'base_amount' => 'float',
        'tax_rate' => 'float',
        'tax_amount' => 'float',
        'total_amount' => 'float',
        'bounding_box' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->created_at)) {
                $model->created_at = now();
            }
        });
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }
}
