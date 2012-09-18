// define CH1903
Proj4js.defs["EPSG:21781"] = "+title=CH1903 / LV03 +proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs";

// Set default projection
OpenLayers.Projection.defaults['EPSG:21781'] = {
    units: "degrees",
    maxExtent: [-180, -90, 180, 90],
    yx: false
};

// some more globals for easy access
var map;
var center;

// OSMCH map object
var OSMCH = {};

// Setup projection for later reuse
OSMCH.epsg21781 = new OpenLayers.Projection("EPSG:21781"); // CH1903
OSMCH.epsg4326 = new OpenLayers.Projection("EPSG:4326");

// Setup bounding boxes for maxExtent
// whole switzerland
// OSMCH.extent = new OpenLayers.Bounds(420000,30000,900000,350000);
// Bern
OSMCH.extent = new OpenLayers.Bounds();
OSMCH.extent.extend(new OpenLayers.LonLat(7.4204907511500515, 46.97504028780474));
OSMCH.extent.extend(new OpenLayers.LonLat(7.4852566198523265, 46.90714771424042));
// bounds.toBBOX(); // 7.420491,46.907148,7.485257,46.97504
OSMCH.extent.transform(OSMCH.epsg4326, OSMCH.epsg21781);

// Configure some map layer options
OSMCH.options = {
    wmsZoom: {min: 2, max: 7},
    wmsName: "osm-ch",
    wmsUrl: "http://tiles.qgiscloud.com/osm-ch/wms",
    wmsParams: {
        version: '1.3.0',
        layers: ['osm-ch']
    },
    wmsOptions: {
        scales: [186427.62471401572, 93213.81235700786, 46606.90617850393, 23303.453089251965, 11651.726544625983, 5825.863272312991, 2912.9316361564956, 1456.4658180782478],
        isBaseLayer: true,
        projection: OSMCH.epsg21781,
        maxExtent: OSMCH.extent,
        units: 'm',
        transitionEffect: 'resize',
        tileClass: OpenLayers.Tile.Image.Offline,
        tileSize: new OpenLayers.Size(1024, 1024) // larger tile size for less HTTP requests during offline download
    }
};

// configure maps for downloading
OSMCH.WMS = new OpenLayers.Layer.WMS(OSMCH.options.wmsName, OSMCH.options.wmsUrl, OSMCH.options.wmsParams, OSMCH.options.wmsOptions);
OSMCH.WMS.initResolutions();

// Create custom map class
OSMCH.Map = OpenLayers.Class({

    // OpenLayers.Map
    map: null,

    // wms layer
    wmsLayer: null,

    // a simple click handler
    clickHandler: null,

    // callback used to limit zoom levels
    zoomHandler: function (ev) {
        if (this.map.getZoom() > OSMCH.options.wmsZoom.max) {
            this.map.zoomTo(OSMCH.options.wmsZoom.max);
        }
        if (this.map.getZoom() < OSMCH.options.wmsZoom.min) {
            this.map.zoomTo(OSMCH.options.wmsZoom.min);
        }
    },

    // callback used to update download progress
    updateProgress: function(progress) {
        var button = document.getElementById("download");
        button.value = "Downloading: " + progress + "% done";
        // change the on click function
        button.onclick = function(ev){
            console.log("here we would remove the downloaded tiles", ev)
        }
    },

    // callback used when map has finished downloading
    downloadFinished: function () {
        var button = document.getElementById("download");
        button.value = "Download done";
    },

    // callback used to initialize map download
    startDownload: function () {
        var download, interval;
        // fake WMS map for download
        if (!OSMCH.WMS.map) {
            OSMCH.WMS.map = {fractionalZoom: false, getProjectionObject: function () { return OSMCH.epsg21781; }};
        }
        download = new OpenLayers.Offline.Download.Layer({layer: OSMCH.WMS, bounds: OSMCH.extent, zoomMin: OSMCH.options.wmsZoom.min, zoomMax: OSMCH.options.wmsZoom.max});
        download.start();
        // wait for the download to finish
        interval = window.setInterval(function () {
            var progress = download.getProgress();
            if (progress === 100) {
                // remove interval
                window.clearInterval(interval);
                // proceed
                map.downloadFinished();
            } else {
                map.updateProgress(progress);
            }
        }, 1000);
    },

    initialize: function (options) {
        // create map
        this.map = new OpenLayers.Map(options);
        // define wms layer
        this.wmsLayer = new OpenLayers.Layer.WMS(OSMCH.options.wmsName, OSMCH.options.wmsUrl, OSMCH.options.wmsParams, OSMCH.options.wmsOptions);
        // attach wms layer to the map
        this.map.addLayers([this.wmsLayer]);
        // register zoom handler
        this.map.events.register("zoomend", this, this.zoomHandler);
        // coordinate click handler
        this.clickHandler = new OpenLayers.Handler.Click(
            { 'map': this.map },
            {
                'click': function(evt) {
                    //get ur coords
                    var lonlat = this.map.getLonLatFromViewPortPx(evt.xy);
                    lonlat.transform(OSMCH.epsg21781, OSMCH.epsg4326);
                    //do what u want with them
                    document.getElementById("lon").value = lonlat.lon;
                    document.getElementById("lat").value = lonlat.lat;
                }
            }
        );
        this.clickHandler.activate();
        // attach click event on the download button
        var button = document.getElementById("download");
        button.onclick = this.startDownload;
    }
});

// function used to setup the map
function init() {

    //Initialise the 'map' object
    map = new OSMCH.Map({
        div: 'map',
        fractionalZoom: false,
        controls: [
            new OpenLayers.Control.TouchNavigation(),
            new OpenLayers.Control.ArgParser(),
            new OpenLayers.Control.Attribution(),
            new OpenLayers.Control.ZoomPanel()
        ],
        restrictedExtent: OSMCH.extent
    });

    // Swisstopo
    center = new OpenLayers.LonLat(7.452056, 46.932008);
    // Bahnhof Bern
    center = new OpenLayers.LonLat(7.440775, 46.9384);
    // transform to CH1903
    center.transform(OSMCH.epsg4326, OSMCH.epsg21781);

    // set center
    map.map.setCenter(center, 0);

    // zoom
    map.map.zoomTo(OSMCH.options.wmsZoom.min);
}
