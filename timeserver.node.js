var dgram = require("dgram");
var server = dgram.createSocket("udp4");
var dns = require("dns");
var time_server_domain = "pool.ntp.org";
var time_diff = -1;
var client_pool = [];
var time_server_ip = '';
var prev_checktime = 0;
var ttl = 10000;
var ntp_port = 123;

function stamp() {
 return("[" + (new Date()).toISOString("en-US") + "] ");
}
server.on("message", function(msg, rinfo) {
	var serverMessageHandler = function() {
		console.log(stamp() + ["message from ", rinfo.address, ":", rinfo.port].join(''));
		if (rinfo.address != time_server_ip) { //time sync request from client
			console.log(rinfo.address + ' is different from ' + time_server_ip + ": this ia a client request");
			client_pool.push({
				address: rinfo.address,
				port: rinfo.port
			});
			server.send(msg, 0, msg.length, ntp_port, time_server_ip, function(err, bytes) {
				if (err) throw err;
				console.log(stamp() + 'request sent to server ' + time_server_domain);
			});
		} else {
			var time_standard = msg.readUInt32BE(32);
			msg.writeUInt32BE(time_standard + time_diff, msg.length - 16);
			msg.writeUInt32BE(time_standard + time_diff, msg.length - 8);
			while (client_pool.length != 0) { (function(to_ip, to_port) {
					server.send(msg, 0, msg.length, to_port, to_ip, function(err, bytes) {
						if (err) throw err;
						console.log(stamp() + 'response to ' + to_ip + ':' + to_port);
					});
				})(client_pool[0].address, client_pool[0].port);
				client_pool.splice(0, 1);
			}
		}
	};
	if (prev_checktime + ttl < (new Date()).getTime()) { //TTL 3 hours
		console.log('\n\nTTL Expired '+prev_checktime+' '+(new Date()).getTime()+'. Relookup ' + time_server_domain);
		dns.lookup(time_server_domain, 4, function(err, ip, ipv) {
			if (err) {
				console.log('Error in DNS Lookup');
				console.log(err);
				return
			}
			time_server_ip = ip;
			prev_checktime = (new Date()).getTime();
			console.log('Previous Checktime was '+ prev_checktime);
			console.log('Got ip address: '+ ip);
			serverMessageHandler();
		});
	} else {
		serverMessageHandler();
	}
});
server.on("listening", function() {
	var address = server.address();
	console.log("NTP pool: " + time_server_domain);
	if(time_diff != 0)
	 console.log("Artificial time difference given to client: " + (time_diff>0?"+":"") + time_diff + "s");
	console.log("Server listening on " + address.address + ":" + address.port);
});

server.bind(ntp_port);

