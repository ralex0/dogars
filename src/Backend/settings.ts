import fs = require('fs');
import path = require('path');
import { ConnectionOptions } from 'typeorm';

let curdir = __dirname;
let file = '/settings.json';
while (!fs.existsSync(path.join(curdir, file))) {
    curdir = path.dirname(curdir);
    if (curdir == '/')
        throw "settings.json not found";
}

export let settings: {
    db: {
        type?: ConnectionOptions["type"],
        port?: number,
        host: string,
        user: string,
        database: string,
        password: string,
        charset: string
    },
    showdown: {
        user: string,
        pass: string
    },
    botkey: string,
    admin_pass: string,
    secret: string,
    ressources: string,
    frontend: string,
    admin_mail: string,
    proxy: string
} = JSON.parse(fs.readFileSync(path.join(curdir, file)).toString());
