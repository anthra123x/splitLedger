<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Workspace extends Model
{
    protected $table = 'workspaces';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $guarded = [];

    protected $casts = [
        'is_archived' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
            if (empty($model->slug)) {
                $base = Str::slug($model->name ?: 'workspace');
                $model->slug = $base . '-' . substr((string) Str::uuid(), 0, 8);
            }
        });
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'workspace_id')->orderBy('created_at', 'desc');
    }
}
