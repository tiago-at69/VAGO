<?php

use Illuminate\Support\Facades\Route;

// O front (public/index.html) é servido na raiz.
Route::get('/', fn () => response()->file(public_path('index.html')));
