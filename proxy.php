<?php

define('CACHE_TILES', 1);           // cache tiles on disk
define('RESIZE_TILES', 0);          // resize tiles before caching and delifering
define('RESIZE_TILES_QUALITY', 30); // quality setting for resizing
define('STORE_BIG_TILES', 0);       // store tiles in original form if cached version is resized?

$url = isset($_GET['url']) ? $_GET['url'] : '';

// helper to download, cache and resize map tiles
function getCachedTile($url) {
    $type = '';
    if (strpos($url, 'http://tiles.qgiscloud.com/osm-ch/wms') === 0) {
        $type = 'osm-ch';
    }
    $cacheDir = __DIR__ . '/tiles/' . $type;
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }
    $cacheName = sha1($url);

    $image = '';
    // check if the tile is cached on the disk
    if (!file_exists($cacheDir . '/' . $cacheName)) {
        // tile does not exist in cache
        error_log("cache miss: " . $type . ", " . $cacheName);
        // load image, save and return it
        $image = file_get_contents($url);
        if ($image) {
            if (RESIZE_TILES) {
                if (STORE_BIG_TILES) {
                    // store original as well
                    file_put_contents($cacheDir . '/' . $cacheName . '_big', $image);
                }
                // resize the tile to 75% quality
                $im = imagecreatefromstring($image);
                imagejpeg($im, $cacheDir . '/' . $cacheName, RESIZE_TILES_QUALITY);
                $image = file_get_contents($cacheDir . '/' . $cacheName);
            } else {
                // cache tile on disk
                file_put_contents($cacheDir . '/' . $cacheName, $image);
            }
        }
    } else {
        // serve file from cache
        error_log("cache hit: " . $type . ", " . $cacheName);
        $image = file_get_contents($cacheDir . '/' . $cacheName);
    }
    return $image;
}

if (strpos($url, 'http://tiles.qgiscloud.com/osm-ch/wms') === 0) {
    // error_log("loading tile: " . $url);
    $image = getCachedTile($url);
    header('Content-Type: text/plain');
    echo 'data:image/jpeg;base64,' . base64_encode($image);

} elseif (strpos($url, 'http://fake/route') === 0) {
    header('Content-Type: application/xml');
    echo file_get_contents('wfsfixtrues/Routen.xml');

} else {
    header('HTTP/1.1 403 Forbidden');
    echo 'FORBIDDEN URL';
}
