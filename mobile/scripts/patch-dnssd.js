const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../node_modules/dnssd-advertise/dist/dnssd-advertise.js');

if (!fs.existsSync(targetPath)) {
  console.log('[patch-dnssd] dnssd-advertise not found, skipping.');
  process.exit(0);
}

const content = fs.readFileSync(targetPath, 'utf8');

if (content.includes('DNSSD_SAFE_STUB_V2')) {
  console.log('[patch-dnssd] Already patched.');
  process.exit(0);
}

// Expo's Bonjour.js calls:
//   dnssd.advertise({ name, type, protocol, hostname, port, stack, txt })
// which must return an async stop function.
const stub = `// DNSSD_SAFE_STUB_V2 - safe no-op replacement for broken dnssd-advertise
// Prevents: RangeError: Maximum call stack size exceeded
// Prevents: Error [ERR_STREAM_UNABLE_TO_PIPE]
'use strict';

function advertise(options) {
  return async function stop() {};
}

function browse(options) {
  const EventEmitter = require('events');
  const emitter = new EventEmitter();
  emitter.stop = async function() {};
  return emitter;
}

function createAdvertiser() { return { start: async () => {}, stop: async () => {} }; }
function createBrowser() { return { start: async () => {}, stop: async () => {} }; }
function tcp(n) { return { name: n, protocol: 'tcp' }; }
function udp(n) { return { name: n, protocol: 'udp' }; }

module.exports = { advertise, browse, createAdvertiser, createBrowser, tcp, udp };
exports.advertise = advertise;
exports.browse = browse;
exports.createAdvertiser = createAdvertiser;
exports.createBrowser = createBrowser;
exports.tcp = tcp;
exports.udp = udp;
`;

fs.writeFileSync(targetPath, stub, 'utf8');
console.log('[patch-dnssd] Successfully patched dnssd-advertise!');
