<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class GeocodificarEnderecoService
{
    public function executar(string $endereco): ?array
    {
        if (! config('services.geocode.enabled') || trim($endereco) === '') {
            return null;
        }

        try {
            return config('services.google.maps_key')
                ? $this->peloGoogle($endereco)
                : $this->peloNominatim($endereco);
        } catch (\Throwable) {
            return null;
        }
    }

    private function peloGoogle(string $endereco): ?array
    {
        $json = Http::connectTimeout(3)->timeout(6)->acceptJson()->get('https://maps.googleapis.com/maps/api/geocode/json', [
            'address' => $endereco,
            'key' => config('services.google.maps_key'),
            'language' => 'pt-BR',
        ])->throw()->json();

        $loc = $json['results'][0]['geometry']['location'] ?? null;

        return $this->par($loc['lat'] ?? null, $loc['lng'] ?? null);
    }

    private function peloNominatim(string $endereco): ?array
    {
        $json = Http::connectTimeout(3)->timeout(6)
            ->withHeaders(['User-Agent' => 'VAGO/1.0 (mapa de restaurantes)'])
            ->acceptJson()
            ->get('https://nominatim.openstreetmap.org/search', [
                'q' => $endereco,
                'format' => 'json',
                'limit' => 1,
            ])->throw()->json();

        return $this->par($json[0]['lat'] ?? null, $json[0]['lon'] ?? null);
    }

    private function par(mixed $lat, mixed $lng): ?array
    {
        if ($lat === null || $lng === null || ! is_numeric($lat) || ! is_numeric($lng)) {
            return null;
        }

        return ['latitude' => round((float) $lat, 7), 'longitude' => round((float) $lng, 7)];
    }
}
