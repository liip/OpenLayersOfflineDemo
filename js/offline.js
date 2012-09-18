/*jslint windows: true, sloppy: true, bitwise: true, eqeq: false, plusplus: true, newcap: true, nomen: true, regexp: true, undef: true, indent: 4*/
/*global Ext, OpenLayers, window */
OpenLayers.Offline = {
    queued: 0,
    total: 0,
    count: 0,
    start: null,

    storage: new OpenLayers.Storage.WebSQL('Offline'),

    get: function (key, callback) {
        OpenLayers.Offline.storage.get(key, function (results) {
            var that = this, key = that.key;
            if ("undefined" !== typeof results) {
                callback(results);
            } else {
                callback(key);
            }
        });
    },

    remove: function (key) {
        OpenLayers.Offline.storage.remove(key);
    },

    /* helper to get value of a key separated with & */
    getValueForKey: function (data, key) {
        var value = null, pattern, re, res;

        pattern = key + "=([^\u0026]*)\u0026{0,1}";
        re = new RegExp(pattern);
        res = re.exec(data);

        if (res && res[1]) {
            value = res[1];
        }
        return value;
    },

    /* helper to add or replace querystring search or hashstring key=value pair */
    addReplaceKeyValuePair: function (url, queryKey, queryValue) {
        var pattern, re, res, keyValue;
        queryValue = queryValue || '';

        if ('undefined' !== typeof queryKey) {
            keyValue = queryKey + "=" + queryValue;
            // check if queryKey is already present in the url
            pattern = "([&]{0,1}" + queryKey + "=[^&]*)";
            re = new RegExp(pattern);
            res = re.exec(url);
            if (res && res[1]) {
                // if so replace it,
                if ("&" === res[1].charAt(0)) {
                    url = url.replace(re, "&" + keyValue);
                } else {
                    url = url.replace(re, keyValue);
                }
            } else {
                // otherwise add the queryKey=queryValue to the url
                if (url.length > 1 && "&" !== url[url.length - 1]) {
                    url += "&" + keyValue;
                } else {
                    // catches also url.length = 1 but then url.charAt(0) should be "?" or "#"!
                    url += keyValue;
                }
            }
        }
        return url;
    },

    /**
     * helper to normalice url:
     * it removed the last digit from each bbox value so we don't rounding issues
     * @param url String the generated tile url which contains a BBOX param
     * @return {*} String updated url
     */
    normalizeUrl: function (url) {
        var bbox, newBbox, bboxValues;
        bbox = this.getValueForKey(url, 'BBOX');
        bboxValues = bbox.split(',');
        newBbox = bboxValues[0].slice(0, -2) + ',' + bboxValues[1].slice(0, -2) + ',' + bboxValues[2].slice(0, -2) + ',' + bboxValues[3].slice(0, -2);
        return this.addReplaceKeyValuePair(url, 'BBOX', newBbox);
    }
};

OpenLayers.Offline.Download = {};

/**
 * var download = new OpenLayers.Offline.Download.Layer({layer: layer, bounds: bounds, zoomMin: 0, ZoomMax: 7});
 * download.start();
 */
OpenLayers.Offline.Download.Layer = OpenLayers.Class({

    layer: null,
    bounds: null,
    zoomMin: 0,     // default value for min zoom level
    zoomMax: 7,     // default value for max zoom level
    total: 0,       // holds the total amount of urls to download
    count: 0,       // counts the number of downloaded tiles
    async: true,    // should we download the tiles asynchronous and give the caller a chance to react on progress
    timeout: 70,    // timeout amount in ms for asynchronous downloads
    queue: [],      // array stores all urls to be downloaded

    initialize: function (options) {
        OpenLayers.Util.extend(this, options);
    },

    /**
     * start the download of the tiles for the configured zoom levels
     */
    start: function () {
        var i;
        for (i = this.zoomMin; i <= this.zoomMax; i++) {
            this.prepare(i);
        }
        // start downloading of the queued images
        this.processNextInQueue();
    },

    /** 
     * Removes all downloaded tiles
     */
    remove: function () {
        var i;
        for (i = this.zoomMin; i <= this.zoomMax; i++) {
            this.prepare(i, 'remove');
        }
    },

    /**
     * Prepares the download or removement of tiles
     */
    prepare: function (zoom, type) {
        var origin, resolution, tileLayout, tileoffsetx, tileoffsety, tileoffsetlon, tileoffsetlat, tilelon, tilelat, startX, startLon, rowidx, grid, i, row, colidx, tileBounds, tile, url, mapZoom;
        origin = this.layer.getTileOrigin();
        resolution = this.layer.getResolutionForZoom(zoom);
        tileLayout = this.layer.calculateGridLayout(this.bounds, origin, resolution);
        tileoffsetx = Math.round(tileLayout.tileoffsetx); // heaven help us
        tileoffsety = Math.round(tileLayout.tileoffsety);
        tileoffsetlon = tileLayout.tileoffsetlon;
        tileoffsetlat = tileLayout.tileoffsetlat;
        tilelon = tileLayout.tilelon;
        tilelat = tileLayout.tilelat;
        startX = tileoffsetx;
        startLon = tileoffsetlon;
        rowidx = 0;
        grid = [];
        i = 0;
        do {
            row = grid[rowidx++];
            if (!row) {
                row = [];
                grid.push(row);
            }

            tileoffsetlon = startLon;
            tileoffsetx = startX;
            colidx = 0;

            do {
                tileBounds = new OpenLayers.Bounds(tileoffsetlon, tileoffsetlat, tileoffsetlon + tilelon, tileoffsetlat + tilelat);
                tile = row[colidx++];
                if (!tile) {

                    // override map.zoom, because getURL uses it
                    mapZoom = this.layer.map.zoom;
                    this.layer.map.zoom = zoom;
                    url = this.layer.getURL(tileBounds);
                    // restore map.zoom
                    this.layer.map.zoom = mapZoom;
                    // Download or remove image
                    if (type === 'remove') {
                        this.doRemove(url);
                    } else {
                        this.add2Queue(url);
                    }
                    row.push(true);
                }
                tileoffsetlon += tilelon;
                tileoffsetx += this.layer.tileSize.w;
            } while (tileoffsetlon <= this.bounds.right + tilelon);
            tileoffsetlat -= tilelat;
            tileoffsety += this.layer.tileSize.h;
        } while (tileoffsetlat >= this.bounds.bottom - tilelat);
    },

    /**
     * Adds an url to the download queue
     */
    add2Queue: function (url) {
        this.total++;
        this.queue.push(url);
    },

    /**
     * Process the next url inside the download queue asynchronous
     */
    processNextInQueue: function () {
        var url, that = this;
        if (this.queue.length > 0) {
            url = this.queue.shift();
            // console.log("queue length: " + this.queue.length + ", processing: " + url);
            if (this.async === false) {
                // download all urls synchronosly and dont return (in function start) until done
                this.download(url);
            } else {
                // download all urls asynchronosly and return early, caller can track progress
                window.setTimeout(function () {
                    that.download(url);
                }, this.timeout);
            }
        }
    },

    /**
     * Downloads and stores the images with that urls.
     * When done it calls processNextInQueue to process the next url
     * (sequencial download to save resources)
     */
    download: function (url) {
        OpenLayers.Request.GET({
            url: url,
            async: true,    // default true, false does load synchronous
            callback: OpenLayers.Function.bind(function (response) {
                OpenLayers.Offline.storage.set(OpenLayers.Offline.normalizeUrl(url), response.responseText);
                this.count++;
                // process with next entry
                this.processNextInQueue();
            }, this)
        });
    },

    /**
     * Removes stored image from the store
     */
    doRemove: function (url) {
        OpenLayers.Offline.storage.remove(OpenLayers.Offline.normalizeUrl(url));
    },

    /**
     * Get the progress of the download
     */
    getProgress: function () {
        if (this.total > 0) {
            return parseInt(this.count / this.total * 100, 10);
        }
        return 0;
    }
});

OpenLayers.Tile.Image.Offline = OpenLayers.Class(OpenLayers.Tile.Image, {

    /**
     * Method: renderTile
     * Internal function to actually initialize the image tile,
     *     position it correctly, and set its url.
     */
    renderTile: function () {
        this.layer.div.appendChild(this.getTile());

        // synchronous image requests get the url immediately.
        this.url = this.layer.getURL(this.bounds);

        var that = this;
        OpenLayers.Offline.storage.get(OpenLayers.Offline.normalizeUrl(this.url), function (results) {
            if ("undefined" !== typeof results) {
                // Offline image found
                console.log("Offline cache hit: " + that.url);
                // it's a data url, it should be save to set it directly
                that.getImage();
                that.setImgSrc(results);
                that.onImageLoad();
            } else {
                // load image from url
                console.log("Offline cache miss: " + that.url);
                that.initImage();
            }
        }, function () {
            // empty error callback
        });
    },

    CLASS_NAME: "OpenLayers.Tile.Image.Offline"
});

/**
 * var download = new OpenLayers.Offline.Download.WFS({protocol: protocol});
 * download.start();
 */
OpenLayers.Offline.Download.WFS = OpenLayers.Class({

    protocol: null,
    options: null,
    finished: false,

    initialize: function (options) {

        OpenLayers.Util.extend(this, options);
        this.options = {forceDownload: true, callback: OpenLayers.Function.bind(this.handle, this)};
        OpenLayers.Util.applyDefaults(this.options, this.protocol.options || {});
    },

    start: function () {
        this.protocol.read(this.options);
    },

    handle: function (response) {

        OpenLayers.Offline.storage.set(this.options.cacheIdentifier, response.priv.responseText);
        this.finished = true;
    },

    getProgress: function () {
        if (this.finished > 0) {
            return 1;
        }
        return 0;
    }
});


OpenLayers.Protocol.WFS.Offline = OpenLayers.Class(OpenLayers.Protocol.WFS.v1_1_0, {

    read: function (options) {
        // ignore forceDownload property in options for cacheIdentifier
        var cachedOptions = {};
        OpenLayers.Util.extend(cachedOptions, this.options);
        if ("undefined" !== cachedOptions.forceDownload) {
            delete cachedOptions.forceDownload;
        }
        // build identifier for the request and store it inside this class
        options.cacheIdentifier = JSON.stringify(cachedOptions);
        // check if data is already offline or fetch it from source
        OpenLayers.Offline.storage.get(options.cacheIdentifier, OpenLayers.Function.bind(function (results) {
            if (true !== options.forceDownload) {
                if ("undefined" !== typeof results) {
                    // found entry in database, use it
                    this.handleRead({priv: {status: 200, responseText: results}}, options);
                    return;
                }
            }
            // entry not found in data base, do a real request
            OpenLayers.Protocol.WFS.v1.prototype.read.call(this, options);
        }, this));
    }
});


