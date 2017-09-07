'use strict';
import { EVENTS as e, protocol } from './conf.js';
import { eventSys, PublicAPI } from './global.js';

export const netVal = {
	connection: null,
	updateInterval: null
};

export const net = {
	protocol: null,
	isConnected: isConnected,
	connect: connect
};

PublicAPI.net = net;

function isConnected() {
	return net.protocol !== null && net.protocol.isConnected();
}

function updatePixel(x, y, color) {
	var fl = Math.floor;
	var key = fl(x / 256) + ',' + fl(y / 256);
	var chunk = this.chunks[key];
	var crgb = this.getPixel(x, y);
	if (chunk) {
		crgb = u16_565(crgb[2], crgb[1], crgb[0]);
		var rgb = u16_565(color[2], color[1], color[0]);
		if (this.net.isConnected() && crgb !== rgb && this.net.placeBucket.canSpend(1)) {
			chunk.update(x & 0xFF, y & 0xFF, color);
			var array = new ArrayBuffer(11);
			var dv = new DataView(array);
			dv.setInt32(0,  x, true);
			dv.setInt32(4,  y, true);
			dv.setUint16(8, rgb, true);
			//dv.setUint8(10, 255);
			this.net.connection.send(array);
			this.renderer.requestRender(2); /* Request world re-render */
			return true;
		}
	}
	return false;
}

function sendUpdates() {
	var worldx = this.mouse.worldX;
	var worldy = this.mouse.worldY;
	var lastx = this.mouse.lastWorldX;
	var lasty = this.mouse.lastWorldY;
	var selrgb = this.palette[this.paletteIndex];
	var oldrgb = this.lastColor;
	if (isConnected() && (worldx != lastx || worldy != lasty
	|| this.toolSelected != this.lastTool || !(selrgb[0] == oldrgb[0] && selrgb[1] == oldrgb[1] && selrgb[2] == oldrgb[2]))) {
		this.mouse.lastWorldX = worldx;
		this.mouse.lastWorldY = worldy;
		this.lastTool = this.toolSelected;
		this.lastColor = selrgb;
		// Send mouse position
		var array = new ArrayBuffer(12);
		var dv = new DataView(array);
		dv.setInt32(0, worldx, true);
		dv.setInt32(4, worldy, true);
		dv.setUint16(8, u16_565(selrgb[2], selrgb[1], selrgb[0]), true);
		dv.setUint8(10, this.toolSelected);
		this.net.connection.send(array);
	}
}

function connect(server, worldName) {
	eventSys.emit(e.net.connecting, server);
	net.connection = new WebSocket(server.url);
	net.connection.binaryType = "arraybuffer";
	net.protocol = new server.proto.class(net.connection, worldName);
}
