module.exports.StartServer = function () {
    var cfenv = require("cfenv");
    var restify = require('restify');
    var xmlBodyParser = require('express-xml-bodyparser');

    // get the environment: cloudfoundry or local
    var appEnv = cfenv.getAppEnv();

    // create the rest server
    var server = restify.createServer();
    server.use(xmlBodyParser());

    // create client for communicating with app server
    var client = restify.createJsonClient({
        version: '*',
        url: (process.env.APP_SERVER_URL ? process.env.APP_SERVER_URL : 'http://hack.ronky.net')
    });

    function addLink(data, rel, routeName, reqParams) {
        if (!data._links) {
            data._links = [];
        }
        data._links.push({rel: rel, href: server.router.render(routeName, reqParams)});
    }

    server.get('/', function(req,res) {
        var responseData = { name : 'seat-sensor-server'};
        addLink(responseData,'postSensorData','postdata');
        res.send(responseData);
    });

    server.post({name : 'postdata', path : '/data'}, function (req,res) {
        var sensorid = req.body.deveui_uplink.deveui[0];
        console.log('Received reading from sensor ' + sensorid);
        var sensorReadingHex = req.body.deveui_uplink.payload_hex[0];
        console.log('Hex value: ' + sensorReadingHex);
        var sensorReading = parseInt(sensorReadingHex, 16);
        console.log('Decimal value: ' + sensorReading);
        var luminosityThreshold = (process.env.LUMINOSITY_THRESHOLD ? process.env.LUMINOSITY_THRESHOLD : 950000);
        var isFree = (sensorReading ? sensorReading < luminosityThreshold : true);
        var data = {id : sensorid, free : isFree};
        var path = '/sensor/' + sensorid;
        console.log('sensor update to ' + client.url.href + path + ' with payload ' + JSON.stringify(data));
        client.put(path, data, function (err) {
            if (err) {
                res.send({code : err.statusCode, message : err.message});
            }
            console.log('sensor update successful');
            res.send(204);
        });
    });

    // start the server
    server.listen(appEnv.port, appEnv.bind, function () {
        console.log('%s listening at %s', appEnv.name, appEnv.url);
    });
};
