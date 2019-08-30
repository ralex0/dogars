let randn = (n: number) => ~~(Math.random() * n);
let glyphs = '0123456789abcdefghijklmnopqrstuvwxyz';
let rands = (n: number) => [...new Array(n)].map((e, i) => glyphs[randn(glyphs.length)]).join('');
let randds = (n: number) => [...new Array(n)].map((e, i) => glyphs[randn(glyphs.length % 10)]).join('');

import ws = require('ws');
import { EventEmitter } from 'events';

import { Agent } from 'https';

export type MessageEvent = { data: string };

export class SuckJS extends EventEmitter {
    sock: ws;

    onopen?: () => void;
    onmessage?: (d: MessageEvent) => void;
    onclose?: (d?: any) => void;
    onerror?: (d?: any) => void;

    constructor(url: string, agent?: Agent) {
        super();
        let sockurl = `${url.replace('http', 'ws')}/${randn(1000)}/${rands(8)}/websocket`;
        this.sock = new ws(sockurl, { agent: agent });
        this.sock.onmessage = (e) => this._onmessage(e);
        this.sock.onerror = (e) => { 
            console.log('chaught error', e);
            this.onerror && this.onerror(e);
        }
        this.sock.onclose = () => this.onclose && this.onclose();
    }

    send(data: Parameters<ws['send']>[0]) {
        this.sock.send('[' + JSON.stringify(data) + ']');
    }

    private _open() {
        this.onopen && this.onopen();
    }

    private postMessage(e: any) {
        this.onmessage && this.onmessage({ data: e });
    }

    close() {
        this.sock.close();
    }

    private _onmessage(event: Parameters<ws['onmessage']>[0]) {
        let data = event.data;
        let type = data.slice(0, 1);
        switch (type) {
            case 'o':
                this._open();
                return;
            case 'h':
                return;
        }

        let payload = JSON.parse(data.slice(1).toString());
        switch (type) {
            case 'a':
                if (Array.isArray(payload)) {
                    let par = payload as any[];
                    par.forEach((e: any) => this.postMessage(e));
                }
                return;
            case 'm':
                this.postMessage(payload);
                return;
            case 'c':
                this.close();
        }
    }
}