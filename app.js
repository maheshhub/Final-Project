//Load the node modulesvar express = require('express')util = require('util'),url = require('url'),hdb = require('hdb')emojiStrip = require('emoji-strip'),tweets = require('node-tweet-stream');//Load the config.js filevar config = require('./config.js');//Configure the HANA connection information using data from config.jsvar hdb = hdb.createClient({host : config.hana.host,port : config.hana.port,user : config.hana.user,password : config.hana.password});var hdb_schema = config.hana.hdb_schema;//Connect to HANA. If an error occurs it will be written to the console.hdb.connect(function (err) {if (err) {return console.error('HDB connect error:', err);}});//Configure the Twitter connection objectvar stream = new tweets({consumer_key: config.twitter.consumer_key,consumer_secret: config.twitter.consumer_secret,token: config.twitter.token,token_secret: config.twitter.token_secret});//Create the application object using the express.js node modulevar app = express();//Add paramters to the response header that allows cross-domain requestsapp.all('*', function(req, res, next) {res.header("Content-Type", "text/plain");res.header("Access-Control-Allow-Origin", "*");next();});//Route that matches http://localhost:8888 used to test if server is functioningapp.get('/', function(req, res, next){res.send("Listening...");});//Route that starts tracking twitter stream//It takes to parameters: table (the table in HANA) and track (the keyword to track)app.get('/do/start', function(req, res, next) {var table = req.param('table');var track = req.param("track");//If the user doesn't provide the table name, use Tweetsif(table === undefined) {table = "Tweets";}//If a keyword is provided, write it to the log, send it to the browser//and start trackingif (track !== undefined) {console.log('Start tracking ' + track);res.send('Start Tracking ' + track);//Each time a tweet is captured, the callback function will execute inserting//the data into the table in HANAstream.on('tweet', function(data){var myDate = new Date(Date.parse(data.created_at.replace(/( +)/,'UTC$1')));var createdAt = myDate.getFullYear() + '-' + eval(myDate.getMonth() + 1) + '-'+ myDate.getDate() + ' ' + myDate.getHours() + ':' + myDate.getMinutes() + ':' + myDate.getSeconds();var replyUser = '';if (data.in_reply_to_screen_name !== null) {replyUser = data.in_reply_to_screen_name}var retweetedUser = '';if (typeof data.retweeted_status !== 'undefined') {retweetedUser = data.retweeted_status.user.screen_name;}var lat = null;var lon = null;if (data.geo !== null) {lat = data.geo.coordinates[0];lon = data.geo.coordinates[1];}//console.log('Tweet:', data.id_str, data.lang, createdAt,data.user.screen_name, data.text, replyUser, retweetedUser, lat, lon);var sql = 'INSERT INTO "' + hdb_schema + '"."' + table + '"("id","created","text","lang","user","replyUser","retweetedUser"';if (data.geo !== null) {sql += ',"lat","lon"';}sql += ') VALUES(\'' + data.id_str + '\',\'' + createdAt + '\',\'' +emojiStrip(data.text.replace(/\'/g, " ")) + '\',\'' + data.lang + '\',\'' + data.user.screen_name + '\',\'' + replyUser +'\',\'' + retweetedUser + '\'';if (data.geo !== null) {sql += ',' + lat + ',' + lon;}sql += ')';hdb.exec(sql, function (err, affectedRows) {if (err) {console.log('Error:', err);console.log('SQL:', sql);return console.error('Error:', err);}//When a tweet is inserted, write to the consoleconsole.log('Tweet inserted:', data.id_str, createdAt,affectedRows);});});//Start tracking the keywordstream.track(track);} else {res.send('Nothing to track');}});//Route to stop trackingapp.get('/do/stop', function(req, res, next){if(stream){stream.abort();console.log('Stop');res.send('Stop');}});//Starts the server and waitsvar server = app.listen(8888, function() {console.log('Listening on port %d', server.address().port);console.log('Press Ctrl-C to terminate');});