# OpenLayers offline demo

This small code example how to extend OpenLayers with offline storage.

Currently only WMS and WFS Layers are supported.

To keep the code base small only only one storage class is provided.

The provided OpenLayers.Offline class does the Offline magic.

# How to run this demo

Make sure your apache can run php script files (needed for the proxy script).

On a mac clone this repository to *~/Sites*:

    cd ~/Sites
    git clone git@github.com:liip/OpenLayersOfflineDemo.git

Then change into the new directory and change the permissions of the tiles folder with:

    cd OpenLayersOfflineDemo
    chmod 777 tiles

Please change the location of the proxy script:

    echo "// configure proxy host" > proxy.js
    echo 'OpenLayers.ProxyHost="http://127.0.0.1/~'$(whoami)'/'${PWD##*/}'/proxy.php?url="' >> proxy.js

You should now be ready to open the *local.html* file in your browser:

    open http://127.0.0.1/~$(whoami)/${PWD##*/}/local.html

