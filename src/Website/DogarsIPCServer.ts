import * as sockjs from "sockjs"
import { Server } from "http";
import fs = require('fs');
import { settings } from "../Backend/settings";
import { registerChampResult } from "../Backend/mongo";
import { champ } from "../Shoedrip/shoedrip";
import { CringeCompilation } from "../Backend/CringeCompilation";
import { cookieCompare } from "tough-cookie";

class DogarsIPCServer {
    clients: sockjs.Connection[] = [];
    ipcserver: sockjs.Server;
    auth: boolean[] = [];
    cringes: { [k: string]: CringeCompilation | undefined } = {};

    constructor() {
        this.ipcserver = sockjs.createServer({ sockjs_url: "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.1.5/sockjs.min.js" });
        this.ipcserver.on('connection', (conn: sockjs.Connection) => {
            this.clients.push(conn);
            conn.on('data', async (m) => {
                let req = JSON.parse(m);
                let res;
                if (req.method == 'registerChampResult')
                    res = await registerChampResult.apply(null, req.args);
                else if (req.method == 'snap') {
                    let cc = this.cringes[conn.id];
                    if (cc) {
                        await cc.snap();
                    }
                } else if (req.method == 'close') {
                    let cc = this.cringes[conn.id];
                    if (cc)
                        await cc.done();
                } else if (req.method == 'prepare') {
                    let url = req.args[0];
                    let cc = new CringeCompilation(url);
                    await cc.init();
                    this.cringes[conn.id] = cc;
                }

                if (req.method)
                    conn.write(JSON.stringify({ id: req.id, response: res }));
            });
            conn.on('close', () => {
                let idx = this.clients.findIndex(cli => cli.id == conn.id);
                idx >= 0 && this.clients.splice(idx, 1);
            });
        });
    }

    askMonitor() {
        const cmd = JSON.stringify({
            command: 'monitor',
            champ: champ
        });
        this.clients.forEach(c => c.write(cmd));
    }

    install(server: Server) {
        this.ipcserver.installHandlers(server, { prefix: '/ipc' });
    }
}

export let IPCServer = new DogarsIPCServer;