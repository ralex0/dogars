import fs = require('fs');
import cp = require('child_process');
import http = require('http');

import { connection } from './Showdown/PSConnection';

import { shoestart } from './Shoedrip/shoedrip';

import { router } from './Website/routes';

import * as mongo from './Backend/mongo';
import { settings } from './Backend/settings';
import { Cringer } from './Backend/CringeProvider';

setInterval(async () => {
    let backup = `${settings.ressources}/public/backup.tar.gz`;
    await cp.spawnSync('mongodump', ['--db', settings.db.database, '--gzip', '-o', `${settings.ressources}/public`]);
    await cp.spawnSync('tar', ['-czf', backup, `${settings.ressources}/public/${settings.db.database}`]);
}, 3600 * 1000);

console.log('Starting web server...');

let server = http.createServer(router);
Cringer.install(server);
server.listen(+process.argv[2] || 1234, '0.0.0.0', async () => {
    console.log('Web server started, initializing database connection...');
    await mongo.init();
    console.log('Database connection started, initializing showdown connection...');
    await connection.connect();
    console.log('Showdown connection started, initializing showderp watch service...');
    shoestart();
});
