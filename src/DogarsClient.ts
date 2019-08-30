import asyncify from 'callback-to-async-iterator';
import SockJS = require('sockjs-client');
import { Champ } from './Shoedrip/Champ';
import { settings } from './Backend/settings';
import { BattleData } from './Showdown/BattleData';
import { BattleURL } from './Backend/CringeCompilation';

export class DogarsIPCClient {
    pass: string;
    s = new SockJS('https://dogars.ml/ipc');
    message: AsyncIterableIterator<IPCCmd>;
    constructor(pass: string) {
        this.pass = pass;
        console.log(asyncify)
        let stream = asyncify(async (cb: (v: MessageEvent) => void) => {
            this.s.onmessage = message => cb(message)
        });

        let publish: (m: IPCCmd) => void;
        this.message = asyncify(async (cb: (v: IPCCmd) => void) => {
            publish = m => cb(m)
        });

        (async () => {
            for await (let mess of stream) {
                let msg = JSON.parse(mess.data);
                if (msg.id) {
                    this.awaitingreplies[msg.id.id](msg.response);
                    delete this.awaitingreplies[msg.id.id];
                } else {
                    publish!(msg as IPCCmd);
                }
            }
        })();
    }

    connect() {
        return new Promise(r => {
            this.s.onopen = r;
        })
    }

    messageStream() {
        return this.message;
    }

    send(t: Parameters<WebSocket['send']>[0]) {
        this.s.send(t);
    }

    awaitingreplies: ((fun: any) => void)[] = [];

    replyFor<T>(id: number) {
        return new Promise<T>((res, rej) => {
            this.awaitingreplies[id] = res;
        });
    }

    cmdn = 0;
    async command<T>(data: any) {
        data.id = this.cmdn++;
        this.send(JSON.stringify(data));
        return this.replyFor<T>(data.id);
    }

    async registerChampResult(data: BattleData, won: boolean) {
        return await this.command<void>({
            method: 'registerChampResult',
            args: [data, won]
        });
    }
    
    async refresh() {
        return await this.command<Champ>({
            method: 'refresh'
        });
    }
    
    async setbattle(url: BattleURL) {
        return await this.command<Champ>({
            method: 'setbattle',
            args: [url]
        });
    }

    async snap() {
        return await this.command<void>({
            method: 'snap',
            args: []
        });
    }

    async prepareCringe(u: BattleURL) {
        return await this.command<void>({
            method: 'prepare',
            args: [u]
        });
    }

    async closeCringe() {
        return await this.command<void>({
            method: 'close'
        });
    }
}

export interface MonitorCmd {
    command: 'monitor';
    champ: Champ;
}

export interface AckCmd {
    command: 'ack';
}

export type IPCCmd = MonitorCmd | AckCmd;

export let DogarsClient = new DogarsIPCClient(settings.admin_pass);