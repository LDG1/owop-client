/*
 * TODO:
 *   Mabye bookmarks
 *   IE support by adding .cur cursors
 */
 /* NOTE: Changed colors storing format to 0xAARRGGBB (arrays: [B, G, R]) */
"use strict";
import { CHUNK_SIZE, EVENTS as e } from './conf.js';
import { Bucket } from './util/Bucket.js';
import { escapeHTML, getTime, getCookie, cookiesEnabled } from './util/misc.js';

import { eventSys, PublicAPI } from './global.js';
import { options } from './conf.js';
import { World } from './World.js';
import { camera, renderer, moveCameraBy } from './canvas_renderer.js';
import { net } from './networking.js';
import { updateClientFx, player } from './player.js';

export { showDevChat };

export const keysDown = {};

export const mouse = {
	x: 0, /* pageX */
	y: 0, /* pageY */
	lastX: 0,
	lastY: 0,
	worldX: 0,
	worldY: 0,
	lastWorldX: 0,
	lastWorldY: 0,
	validClick: false,
	validTile: false,
	insideViewport: true,
	touches: []
};

export const elements = {
	viewport: null,
	xyDisplay: null,
	chatInput: null,
	chat: null,
	devChat: null
};

/* Objects */
PublicAPI.events = eventSys;
PublicAPI.elements = elements;

export const misc = {
	urlWorldName: null,
	connecting: false,
	tickInterval: null,
	lastCleanup: 0,
	world: null,
	guiShown: false,
	cookiesEnabled: cookiesEnabled(),
	/* TODO: Make nag appear if this is set, and reCaptcha is going to be loaded (not after) */
	showEUCookieNag: cookiesEnabled() && getCookie("nagAccepted") !== "true"
};

PublicAPI.misc = misc;

function updateCamera() {
	var time = getTime();
	if (misc.world !== null && time - misc.lastCleanup > 1000) {
		misc.lastCleanup = time;
		misc.world.unloadFarChunks();
	}

	renderer.updateCamera();
}

function receiveMessage(text) {
	var message = document.createElement("li");
	var span = document.createElement("span");
	/*if (options.oldserver) {*/
	console.log(text);
	text = escapeHTML(text);
	/*} else {
		var elem = htmlToElement(text);
		if (elem.style) {
			console.log("%c" + elem.innerText, elem.style.cssText);
		} else {
			console.log(text);
		}
	}*/
	span.innerHTML = text;
	message.appendChild(span);
	elements.chatMessages.appendChild(message);
	elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function receiveDevMessage(text) {
	var message = document.createElement("li");
	var span = document.createElement("span");
	span.innerHTML = text;
	message.appendChild(span);
	elements.devChatMessages.appendChild(message);
	elements.devChatMessages.scrollTop = elements.devChatMessages.scrollHeight;
};

function clearChat() {
	elements.chatMessages.innerHTML = "";
	elements.devChatMessages.innerHTML = "";
}


function tick() {
	var offX = 0;
	var offY = 0;
	var offZoom = 0;
	if (keysDown[107] || keysDown[187]) { /* numpad + || equal sign + */
		offZoom += 1;
		keysDown[107] = keysDown[187] = false;
	}
	if (keysDown[109] || keysDown[189]) {
		offZoom -= 1;
		keysDown[109] = keysDown[189] = false; /* Only register keydown */
	}
	if (keysDown[38]) { // Up
		offY -= options.movementSpeed / options.tickSpeed;
	}
	if (keysDown[37]) { // Left
		offX -= options.movementSpeed / options.tickSpeed;
	}
	if (keysDown[40]) { // Down
		offY += options.movementSpeed / options.tickSpeed;
	}
	if (keysDown[39]) { // Right
		offX += options.movementSpeed / options.tickSpeed;
	}
	if (offX !== 0 || offY !== 0 || offZoom !== 0) {
		moveCameraBy(offX, offY);
		camera.zoom = camera.zoom + offZoom;
		movedMouse(mouse.x, mouse.y, mouse.validClick ? 1 : 0);
	}
}

function movedMouse(x, y, btns) {
	mouse.x = x;
	mouse.y = y;
	mouse.worldX = camera.x * 16 + mouse.x / (camera.zoom / 16);
	mouse.worldY = camera.y * 16 + mouse.y / (camera.zoom / 16);
	
	var tileX = Math.floor(mouse.worldX / 16);
	var tileY = Math.floor(mouse.worldY / 16);
	
	if (updateClientFx()) {
		updateXYDisplay(tileX, tileY);
	}

	if (btns && mouse.validClick) {
		player.tool.click(x, y, btns, true);
	}
}

function openChat() {
	elements.chat.className = "active selectable";
	elements.devChat.className = "active selectable";
}

function closeChat() {
	elements.chat.className = "";
	elements.devChat.className = "";
}

function showDevChat(bool) {
	elements.devChat.style.display = bool ? "" : "none";
}

function updateXYDisplay(x, y) {
	elements.xyDisplay.innerHTML = "X: " + x + ", Y: " + y;
}

function updatePlayerCount(count) {
	elements.playerCountDisplay.innerHTML = count + ' cursor' + (count !== 1 ? 's online' : ' online');
}

/*function openServerSelector() {
	windowsys.addWindow(new GUIWindow(0, 0, 250, 60, "Select a server", {
			centered: true
		}, function(wdow) {

		wdow.addObj(mkHTML("button", {
			innerHTML: "Original server",
			style: "width: 100%; height: 50%",
			onclick: function() {
				w.options.serverAddress = "ws://ourworldofpixels.com:443";
				w.net.connect();
				win.wm.delWindow(win);
				w.options.oldserver = true;
			}.bind({w: this, win: wdow})
		}));
		wdow.addObj(mkHTML("button", {
			innerHTML: "Beta server",
			style: "width: 100%; height: 50%",
			onclick: function() {
				w.options.serverAddress = "ws://vanillaplay.ddns.net:25565";
				w.net.connect();
				win.wm.delWindow(win);
			}.bind({w: this, win: wdow})
		}));
		wdow.addObj(mkHTML("button", {
			innerHTML: "Localhost",
			style: "width: 100%; height: 50%",
			onclick: function() {
				w.options.serverAddress = "ws://localhost:25565";
				w.net.connect();
				win.wm.delWindow(win);
			}.bind({w: this, win: wdow})
		}));
		wdow.addObj(mkHTML("button", {
			innerHTML: "Custom server",
			style: "width: 100%; height: 50%",
			onclick: function() {
				var i = win.wm.addWindow(
					new UtilInput("Enter server address", "Type here...", "text", function(addr) {
						w.options.serverAddress = addr;
						w.net.connect();
						win.close();
					}.bind({w: w, win: win}))
				);
				win.onclose = function() {
					i.getWindow().close();
				}
			}.bind({w: this, win: wdow})
		}));
	}.bind(this)));
}.bind(WorldOfPixels);*/

function logoMakeRoom(bool) {
	elements.loadUl.style.transform = bool ? "translateY(-75%) scale(0.5)" : "";
}

function showWorldUI(bool) {
	misc.guiShown = !misc.guiShown;
	elements.xyDisplay.style.transform = bool ? "initial" : "";
	elements.playerCountDisplay.style.transform = bool ? "initial" : "";
	elements.palette.style.transform = bool ? "translateY(-50%)" : "";
	elements.chat.style.transform = bool ? "initial" : "";
	elements.chatInput.disabled = !bool;
}

function showLoadScr(bool, showOptions) {
	elements.loadOptions.className = showOptions ? "framed" : "hide";
	if (!bool) {
		elements.loadScr.style.transform = "translateY(-110%)"; /* +10% for shadow */
		setTimeout(() => elements.loadScr.className = "hide", 2000);
	} else {
		elements.loadScr.className = "";
		elements.loadScr.style.transform = "";
	}
}

function statusMsg(showSpinner, message) {
	const statusShown = elements.status.isConnected;
	if (message === null) {
		elements.status.style.display = "none";
		return;
	} else  {
		elements.status.style.display = "";
	}
	elements.statusMsg.innerHTML = message;
	elements.spinner.style.display = showSpinner ? "" : "none";
}

function inGameDisconnected() {
	showWorldUI(false);
	showLoadScr(true, true);
	statusMsg(false, "Lost connection with the server.");
	misc.world = null;
}

function retryingConnect(worldName) {
	if (misc.connecting && !net.isConnected()) { /* We're already connected/trying to connect */
		return;
	}
	let server = options.serverAddress.find(sv => sv.default);
	misc.connecting = true;
	const tryConnect = (tryN) => {
		eventSys.once(e.net.connecting, () => {
			statusMsg(true, "Connecting...");
			showLoadScr(true, false);
		});
		net.connect(server.url, worldName);
		const disconnected = () => {
			++tryN;
			statusMsg(true, `Could not connect to server, retrying... (${tryN})`);
			setTimeout(tryConnect, Math.min(tryN * 2000, 10000), tryN);
			eventSys.removeListener(e.net.connected, connected);
		};
		const connected = () => {
			statusMsg(false, "Connected!");
			eventSys.removeListener(e.net.disconnected, disconnected);
			eventSys.once(e.net.disconnected, inGameDisconnected);
			misc.connecting = false;
		};

		eventSys.once(e.net.connected, connected);
		eventSys.once(e.net.disconnected, disconnected);
	};
	tryConnect(0);
}

function init() {
	/* Multi Browser Support */
	window.requestAnimationFrame =
		window.requestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function(f) {
			setTimeout(f, 1000 / options.fps);
		};
	HTMLCanvasElement.prototype.toBlob = HTMLCanvasElement.prototype.msToBlob || HTMLCanvasElement.prototype.toBlob;

	/* I don't think this is useful anymore,
	 * since too much stuff used doesn't work on very old browsers.
	 ***/
	if (typeof Uint8Array.prototype.join === "undefined") {
		Uint8Array.prototype.join = function(e) {
			if (typeof e === "undefined") {
				e = ',';
			} else if (typeof e !== "string") {
				e = e.toString();
			}
			var str = "";
			var i = 0;
			do {
				str += this[i] + e;
			} while (++i < length - 1);
			return str + this[i];
		};
	}
	
	var viewport = elements.viewport;
	var chatinput = elements.chatInput;

	misc.lastCleanup = 0;
	
	viewport.oncontextmenu = () => false;

	viewport.addEventListener("mouseenter", function() {
		mouse.insideViewport = true;
		updateClientFx(true);
	});
	viewport.addEventListener("mouseleave", function() {
		mouse.insideViewport = false;
		updateClientFx(true);
	});

	chatinput.addEventListener("keyup", function(event) {
		if (event.keyCode == 13) {
			chatinput.blur();
			net.protocol.sendMessage(chatinput.value);
			chatinput.value = '';
			closeChat();
			event.stopPropagation();
		}
	});
	chatinput.addEventListener("focus", function(event) {
		if (!mouse.validClick) {
			openChat();
		} else {
			chatinput.blur();
		}
	});
	
	window.addEventListener("keydown", function(event) {
		var keyCode = event.which || event.keyCode;
		if (document.activeElement.tagName !== "INPUT" && misc.world !== null) {
			keysDown[keyCode] = true;
			switch (keyCode) {
				case 16: /* Shift */
					selectTool(1);
					break;

				case 90: /* Ctrl + Z */
					if (!event.ctrlKey || undoHistory.length === 0) {
						break;
					}
					var undo = undoHistory.pop();
					if (!net.updatePixel(undo[0], undo[1], undo[2])) {
						undoHistory.push(undo);
					}
					event.preventDefault();
					break;

				case 70: /* F */
					var nrgb = [];
					var valid = true;
					var first = true;
					var prmpt = true;
					for(var i = 0; i < 3; i++){
						if (prmpt) {
							nrgb[i] = prompt("Custom color\n" + ["Red", "Green", "Blue"][i] + " value: (0-255)" + (first ? "\n(Or just type three values separated by a comma: r,g,b)\n(...or the hex string: #RRGGBB)" : ""));
						}
						if (first && nrgb[i]) {
							var tmp = nrgb[i].split(',');
							if (tmp.length == 3) {
								nrgb = tmp;
								prmpt = false;
							} else if (nrgb[i][0] == '#' && nrgb[i].length == 7) {
								var colr = parseInt(nrgb[i].replace('#', '0x'));
								nrgb = [colr & 0xFF, colr >> 8 & 0xFF, colr >> 16 & 0xFF];
								prmpt = false;
							}
						}
						first = false;
						nrgb[i] = parseInt(nrgb[i]);
						if(!(Number.isInteger(nrgb[i]) && nrgb[i] >= 0 && nrgb[i] < 256)){
							break; /* Invalid color */
						}
					}
					player.selectedColor = nrgb;
					break;

				case 71: /* G */
					renderer.showGrid(!renderer.gridShown);
					break;

				case 112: /* F1 */
					/* BUG: opening chat while GUI is hidden will mess up the page */
					showWorldUI(!misc.guiShown);
					event.preventDefault();
					break;

				default:
					return true;
					break;
			}
			return false;
		}
	});
	window.addEventListener("keyup", function(event) {
		var keyCode = event.which || event.keyCode;
		delete keysDown[keyCode];
		if (document.activeElement.tagName !== "INPUT") {
			if (keyCode == 13) {
				elements.chatInput.focus();
			} else if (keyCode == 16) {
				selectTool(0);
			}
		}
	});
	viewport.addEventListener("mousedown", function(event) {
		closeChat();
		mouse.lastX = mouse.x;
		mouse.lastY = mouse.y;
		mouse.x = event.pageX;
		mouse.y = event.pageY;
		mouse.validClick = true;

		player.tool.click(event.pageX, event.pageY, event.buttons, false);
	});
	window.addEventListener("mouseup", function(event) {
		mouse.validClick = false;
	});

	window.addEventListener("mousemove", function(event) {
		movedMouse(event.pageX, event.pageY, event.buttons);
		/*if (mouse.validClick) { // Prevents selection of the chat input placeholder - performance issues?
			event.preventDefault();
		}*/
	});

	const mousewheel = function(event) {
		var delta = Math.max(-1, Math.min(1, (event.deltaY || event.detail)));
		var pIndex = player.paletteIndex;
		if (delta > 0) {
			pIndex++;
		} else {
			pIndex--;
		}
		player.paletteIndex = pIndex;
	};

	viewport.addEventListener("mousewheel", mousewheel, { passive: true });
	viewport.addEventListener("DOMMouseScroll", mousewheel); /* Firefox */
	
	// Touch support
	viewport.addEventListener("touchstart", function(event) {
		player.tool.touch(event.changedTouches, 0);
		var moved = event.changedTouches[0];
		if (moved) {
			movedMouse(moved.pageX, moved.pageY, 0);
		}
	}, { passive: true });
	viewport.addEventListener("touchmove", function(event) {
		player.tool.touch(event.changedTouches, 1);
		var moved = event.changedTouches[0];
		if (moved) {
			movedMouse(moved.pageX, moved.pageY, 0);
		}
	}, { passive: true });
	viewport.addEventListener("touchend", function(event) {
		player.tool.touch(event.changedTouches, 2);
	}, { passive: true });
	viewport.addEventListener("touchcancel", function(event) {
		player.tool.touch(event.changedTouches, 3);
	}, { passive: true });
	
	// Some cool custom css
	console.log("%c" +
		" _ _ _         _   _    _____ ___    _____ _         _     \n" +
		"| | | |___ ___| |_| |  |     |  _|  |  _  |_|_ _ ___| |___ \n" +
		"| | | | . |  _| | . |  |  |  |  _|  |   __| |_'_| -_| |_ -|\n" +
		"|_____|___|_| |_|___|  |_____|_|    |__|  |_|_,_|___|_|___|",
		"font-size: 15px; font-weight: bold;"
	);
	console.log("%cWelcome to the developer console!", "font-size: 20px; font-weight: bold; color: #F0F;");
	
	//this.windowsys.addWindow(new OWOPDropDown());
	
	/* Calls other initialization functions */
	eventSys.emit(e.init);

	updateXYDisplay(0, 0);

	misc.urlWorldName = decodeURIComponent(window.location.pathname).replace(/^(\/beta(?:\/)|\/)/g, "");
	
	retryingConnect(misc.urlWorldName);

	elements.reconnectBtn.onclick = () => retryingConnect(misc.urlWorldName);

	misc.tickInterval = setInterval(tick, 1000 / options.tickSpeed);
}

eventSys.once(e.loaded, () => statusMsg(true, "Initializing..."));
eventSys.once(e.misc.logoMakeRoom, () => {
	statusMsg(false, null);
	logoMakeRoom();
});

eventSys.on(e.loaded, init);
eventSys.on(e.net.playerCount, updatePlayerCount);

eventSys.on(e.net.chat, receiveMessage);
eventSys.on(e.net.devChat, receiveDevMessage);

eventSys.on(e.misc.windowAdded, window => {
	if (misc.world === null) {
		statusMsg(false, null);
		logoMakeRoom(true);
	}
});

eventSys.on(e.net.world.joining, name => {
	logoMakeRoom(false);
	console.log(`Joining world: ${name}`);
});

eventSys.on(e.net.world.join, world => {
	showLoadScr(false, false);
	showWorldUI(true);
	misc.world = new World(world);
	eventSys.emit(e.misc.worldInitialized);
});

eventSys.on(e.net.connected, function() {
	clearChat();
});

window.addEventListener("error", function(e) {
	showDevChat(true);
	var errmsg = e ? e.error && (e.error.stack || e.message || e.error.message) : "Unknown error occurred";
	errmsg = escapeHTML(errmsg);
	errmsg = errmsg.split('\n');
	for (var i = 0; i < errmsg.length; i++) {
		/* Should be some kind of dissapearing notification instead */
		receiveDevMessage(errmsg[i]);
	}
	if (!misc.isAdmin) { /* TODO */
		setTimeout(() => showDevChat(false), 5000);
	}
});

window.addEventListener("load", function() {
	if (window.location.hostname.indexOf("cursors.me") != -1 ||
		window.location.hostname.indexOf("yourworldofpixels.com") != -1) {
		// Redirects to the main url if played on an alternative url.
		window.location.href = "http://www.ourworldofpixels.com/";
		return;
	}

	elements.loadScr = document.getElementById("load-scr");
	elements.loadUl = document.getElementById("load-ul");
	elements.loadOptions = document.getElementById("load-options");
	elements.reconnectBtn = document.getElementById("reconnect-btn");
	elements.spinner = document.getElementById("spinner");
	elements.statusMsg = document.getElementById("status-msg");
	elements.status = document.getElementById("status");
	elements.logo = document.getElementById("logo");

	elements.xyDisplay = document.getElementById("xy-display");
	elements.devChat = document.getElementById("dev-chat");
	elements.chat = document.getElementById("chat");
	elements.devChatMessages = document.getElementById("dev-chat-messages");
	elements.chatMessages = document.getElementById("chat-messages");
	elements.playerCountDisplay = document.getElementById("playercount-display");

	elements.palette = document.getElementById("palette");
	elements.paletteColors = document.getElementById("palette-colors");
	elements.paletteCreate = document.getElementById("palette-create");
	elements.toolSelect = document.getElementById("tool-select");
	
	elements.animCanvas = document.getElementById("animations");
	elements.clusterDiv = document.getElementById("clusters");

	elements.viewport = document.getElementById("viewport");
	elements.windows = document.getElementById("windows");

	elements.chatInput = document.getElementById("chat-input");

	eventSys.emit(e.loaded);
});