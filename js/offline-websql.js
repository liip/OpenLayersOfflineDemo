/*jslint windows: true, sloppy: true, bitwise: true, eqeq: false, plusplus: true, newcap: true, nomen: true, regexp: true, undef: true, indent: 4*/
/*global Ext, OpenLayers, window */
OpenLayers.Storage = OpenLayers.Storage || {};

/**
 * var storage = new OpenLayers.Storage.WebSQL('OpenLayersLayerOffline');
 * storage.set('foo', 'bar');
 * storage.get('foo', function (results) {
 *     console.log(results);
 * });
 */
OpenLayers.Storage.WebSQL = OpenLayers.Class({

    table: null,
    database: null,
    version: '1.0',
    size: 5 * 1024 * 1024,
    name: 'OpenLayersStorage',
    displayName: 'OpenLayers Storage',

    initialize: function (table) {
        var that = this;
        this.table = table;
        if (window.openDatabase) {
            this.database = window.openDatabase(this.name, this.version, this.displayName, this.size); // iOS doesn't like an inital value larger than 5MB
            this.database.transaction(function (tx) {
                return tx.executeSql('CREATE TABLE ' + that.table + ' (key unique, value)');
            });
        }
    },

    set: function (key, value) {
        var that = this;
        if (this.database) {
            return this.database.transaction(function (tx) {
                var res = tx.executeSql('INSERT INTO ' + that.table + ' (key, value) VALUES (?, ?)', [key, value]);
                // console.log("WebSQL set insert", res, key);
                return res;
            }, function (errorObj) {
                // check if quota reached
                if (errorObj && errorObj.code && errorObj.code === 4) {
                    console.log("quota reached on key: ", key, errorObj.code);
                }
                // insert failed, try update
                // console.log("WebSQL set insert error", errorObj);
                that.database.transaction(function (tx) {
                    var res = tx.executeSql('UPDATE ' + that.table + ' SET value = ? WHERE key = ?', [value, key]);
                    // console.log("WebSQL set update", key);
                    return res;
                }, function (foo) {
                    // console.log("WebSQL set update error", foo, key);
                }, function () {
                    // console.log("WebSQL set update success", key);
                });
            }, function () {
                // console.log("WebSQL set success", key);
            });
        }
    },

    remove: function (key) {
        var that = this;
        if (this.database) {
            return this.database.transaction(function (tx) {
                return tx.executeSql("DELETE FROM " + that.table + " WHERE key = ?", [key]);
            }, function (error) {
            });
        }
    },

    update: function (key, value) {
        var that = this;
        if (this.database) {
            return this.database.transaction(function (tx) {
                return tx.executeSql('UPDATE ' + that.table + ' SET value = ? WHERE key = ?', [value, key]);
            });
        }
    },

    /**
     * Parses the response. Returns the response string or undefined.
     * @param res String | undefined
     */
    parseResponse: function (response) {
        if ("undefined" !== typeof response && "undefined" !== typeof response.rows) {
            if ("undefined" !== typeof response.rows.length && response.rows.length > 0) {
                return response.rows.item(0).value;
            }
        }
        return undefined;
    },

    get: function (key, callback) {
        var that = this;
        if (this.database) {
            return this.database.transaction(
                function (tx) {
                    return tx.executeSql('SELECT * FROM ' + that.table + ' WHERE key = ?', [key], function (tx, results) {
                        callback(that.parseResponse(results));
                },
                function (tx, error) {
                    callback(undefined); // error
                });
            });
        } else {
            callback();
        }
    },

    getName: function () {
        return this.name;
    },

    getSize: function () {
        return this.size;
    },

    getVersion: function () {
        return this.version;
    },

    getDisplayName: function () {
        return this.displayName;
    },

    CLASS_NAME: "OpenLayers.Storage.WebSQL"
});
