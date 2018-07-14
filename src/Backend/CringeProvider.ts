import * as sockjs from "sockjs"
import { Server } from "http";
import fs = require('fs');
import { settings } from "./settings";

class CringeProvider {
    clients: sockjs.Connection[] = [];
    cringeserver: sockjs.Server;
    ncringes: number;
    constructor() {
        this.ncringes = fs.readdirSync(`${settings.ressources}/public/cringec`).length;
        this.cringeserver = sockjs.createServer({ sockjs_url: "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.1.5/sockjs.min.js" });
        this.cringeserver.on('connection', (conn: sockjs.Connection) => {
            this.clients.push(conn);
            conn.on('close', () => {
                let idx = this.clients.findIndex(cli => cli.id == conn.id);
                idx >= 0 && this.clients.splice(idx, 1);
            });
            conn.write(JSON.stringify(this.ncringes));
        });
    }

    pushNewCringe(c: number) {
        this.ncringes = c;
        for(let conn of this.clients)
            conn.write(JSON.stringify(this.ncringes));
    }

    install(server: Server) {
        this.cringeserver.installHandlers(server, { prefix: '/cringep' });
    }
}

export let Cringer = new CringeProvider;