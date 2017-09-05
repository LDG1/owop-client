'use strict';
import { Protocol } from './Protocol.js';
import { EVENTS as e, RANK } from './../conf.js';
import { eventSys } from './../global.js';
import { Chunk } from './../World.js';
import { Bucket } from './../util/Bucket.js';
import { loadAndRequestCaptcha } from './../captcha.js';

export const captchaState = {
	CA_WAITING: 0,
	CA_VERIFYING: 1,
	CA_VERIFIED: 2,
	CA_OK: 3,
	CA_INVALID: 4
};

export const OldProtocol = {
    class: null,
    chunkSize: 16,
    clusterChunkAmount: 64,
    maxWorldNameLength: 24,
    worldBorder: 0xFFFFF,
    chatBucket: [4, 6],
    placeBucket: [32, 4],
    opCode: {
        client: {
            worldVerification: 1337,
            chatVerification: 10
        },
        server: {
            setId: 0,
            worldUpdate: 1,
            chunkLoad: 2,
            teleport: 3,
            setAdmin: 4,
            captcha: 5
        }
    }
};

function stoi(string, max) {
	var ints = [];
	var fstring = "";
	string = string.toLowerCase();
	for (var i = 0; i < string.length && i < max; i++) {
		var charCode = string.charCodeAt(i);
		if ((charCode < 123 && charCode > 96)
		|| (charCode < 58 && charCode > 47)
		|| charCode == 95 || charCode == 46) {
			fstring += String.fromCharCode(charCode);
			ints.push(charCode);
		}
	}
	return [ints, fstring];
}

class OldProtocolImpl extends Protocol {
    constructor(ws, worldName) {
        super(ws);
        super.hookEvents(this);
        this.playercount = 1;
        this.worldName = worldName ? worldName : "main";
        this.players = {};
        this.chunksLoading = {}; /* duplicate */
        this.id = null;

        var params = OldProtocol.chatBucket;
        this.chatBucket = new Bucket(params[0], params[1]);
        params = OldProtocol.placeBucket;
        this.placeBucket = new Bucket(params[0], params[1]);
    }

    openHandler() {
        super.openHandler();
    }

    messageHandler(message) {
		message = message.data;
		if (typeof message === "string") {
			if (message.indexOf("DEV") == 0) {
				eventSys.emit(e.net.devChat, message.slice(3));
			} else {
				eventSys.emit(e.net.chat, message);
			}
			return;
        }
        
        var dv = new DataView(message);
        var oc = OldProtocol.opCode.server;
		switch (dv.getUint8(0)) {
			case oc.setId: // Get id
                let id = dv.getUint32(1, true);
                this.id = id;
                eventSys.emit(e.net.world.join, this.worldName);
                eventSys.emit(e.net.world.setId, id);
                eventSys.emit(e.net.playerCount, this.playercount);
				eventSys.emit(e.net.chat, "[Server] Joined world: \"" + this.worldName + "\", your ID is: " + id + "!");
				break;

            case oc.worldUpdate: // Get all cursors, tile updates, disconnects
				var shouldrender = 0;
                // Cursors
                var updated = false;
                var updates = {};
				for (var i = dv.getUint8(1); i--;) {
                    updated = true;
  					var pid = dv.getUint32(2 + i * 16, true);
	  				var pmx = dv.getInt32(2 + i * 16 + 4, true);
	  				var pmy = dv.getInt32(2 + i * 16 + 8, true);
	  				var pr = dv.getUint8(2 + i * 16 + 12);
	  				var pg = dv.getUint8(2 + i * 16 + 13);
	  				var pb = dv.getUint8(2 + i * 16 + 14);
	  				var ptool = dv.getUint8(2 + i * 16 + 15);
                    updates[pid] = {
                        x: pmx,
                        y: pmy,
                        rgb: [pr, pg, pb],
                        tool: ptool
                    };
	  				if (pid !== this.id && !this.players[pid]) {
						++this.playercount;
						eventSys.emit(e.net.playerCount, this.playercount);
	  					this.players[pid] = true;
	  				}
					/*if (this.isVisible(pmx / 16, pmy / 16, 4, 4)
					|| (player && this.isVisible(player.x / 16, player.y / 16, 4, 4))) {
						shouldrender |= 1; /* Re-render players and fx
                    }*/
                }
                if (updated) {
                    eventSys.emit(e.net.world.playersMoved, updates);
                }
	  			var off = 2 + dv.getUint8(1) * 16;
                // Tile updates
                updated = false;
                updates = [];
	  			for (var j = dv.getUint16(off, true); j--;) {
                    updated = true;
	  				var bpx = dv.getInt32(2 + off + j * 11, true);
	  				var bpy = dv.getInt32(2 + off + j * 11 + 4, true);
	  				var br = dv.getUint8(2 + off + j * 11 + 8);
	  				var bg = dv.getUint8(2 + off + j * 11 + 9);
	  				var bb = dv.getUint8(2 + off + j * 11 + 10);
                    var bbgr = bb << 16 | bg << 8 | br;
                    updates.push({
                        x: bpx,
                        y: bpy,
                        rgb: bbgr
                    });
                }
                if (updated) {
                    eventSys.emit(e.net.world.tilesUpdated, updates);
                }
	  			off += dv.getUint16(off, true) * 11 + 2;
                // Disconnects
                var decreased = false;
                updated = false;
                updates = [];
	  			for (var k = dv.getUint8(off); k--;) {
                    updated = true;
                    var dpid = dv.getUint32(1 + off + k * 4, true);
                    updates.push(dpid);
                    if (this.players[dpid] && this.playercount > 1) {
                        decreased = true;
                        --this.playercount;
                        delete this.players[dpid];
                    }
	  			}
				if (updated) {
                    eventSys.emit(e.net.world.playersLeft, updates);
                    if (decreased) {
                        eventSys.emit(e.net.playerCount, this.playercount);
                    }
                }
                break;
                
			case oc.chunkLoad: // Get chunk
				var chunkX = dv.getInt32(1, true);
				var chunkY = dv.getInt32(5, true);
                var u8data = new Uint8Array(message, 9, message.byteLength - 9);
                var key = [chunkX, chunkY].join();
				if (!this.chunksLoading[key]) {
                    eventSys.emit(e.net.chunk.clear, chunkX, chunkY);
				} else {
                    delete this.chunksLoading[key];
                    var u32data = new Uint32Array(OldProtocol.chunkSize * OldProtocol.chunkSize);
                    for (var i = 0, u = 0; i < u8data.length; i += 3) { /* Need to make a copy ;-; */
                        u32data[u++] = 0xFF000000 | u8data[i + 2] << 16
                                        | u8data[i + 1] << 8
                                        | u8data[i];
                    }
					var chunk = new Chunk(chunkX, chunkY, u32data);
					eventSys.emit(e.net.chunk.load, chunk);
				}
                break;
                
			case oc.teleport: // Teleport
				let x = dv.getInt32(1, true) - (window.innerWidth / this.camera.zoom / 2.5);
                let y = dv.getInt32(5, true) - (window.innerHeight / this.camera.zoom / 2.5);
                eventSys.emit(e.net.world.teleported, x, y);
                break;
                
            case oc.setAdmin: // Got admin
                eventSys.emit(e.net.sec.rank, RANK.ADMIN);
                break;
                
            case oc.captcha: // Captcha
                switch (dv.getUint8(1)) {
                    case captchaState.CA_WAITING:
                        loadAndRequestCaptcha();
                        break;

                    case captchaState.CA_OK:
                       this.worldName = this.joinWorld(this.worldName);
                }
				break;
		}
    }

    joinWorld(name) {
        var nstr = stoi(name, OldProtocol.maxWorldNameLength);
        eventSys.emit(e.net.world.joining, name);
        var array = new ArrayBuffer(nstr[0].length + 2);
        var dv = new DataView(array);
        for (var i = nstr[0].length; i--;) {
            dv.setUint8(i, nstr[0][i]);
        }
        dv.setUint16(nstr[0].length, OldProtocol.opCode.client.worldVerification, true);
        this.ws.send(array);
        return nstr[1];
    }
        
    requestChunk(x, y) {
        let wb = OldProtocol.worldBorder;
        var key = [x, y].join();
        if (x > wb || y > wb || x < ~wb || y < ~wb || this.chunksLoading[key]) {
            return;
        }
        this.chunksLoading[key] = true;
        var array = new ArrayBuffer(8);
        var dv = new DataView(array);
        dv.setInt32(0, x, true);
        dv.setInt32(4, y, true);
        this.ws.send(array);
    }
        
    updatePixel(x, y, rgb) {
        
    }
        
    sendUpdates() {
    
    }
        
    sendMessage(str) {
        if (str.length && this.id !== null) {
            if (this.chatBucket.canSpend(1)) {
                this.ws.send(str + String.fromCharCode(10));
                return true;
            } else {
                eventSys.emit(e.net.chat, "Slow down! You're talking too fast!");
                return false;
            }
        }
    }
}

OldProtocol.class = OldProtocolImpl;