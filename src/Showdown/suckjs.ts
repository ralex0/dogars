let randn = (n: number) => ~~(Math.random() * n);
let glyphs = '0123456789abcdefghijklmnopqrstuvwxyz';
let rands = (n: number) => [...new Array(n)].map((e, i) => glyphs[randn(glyphs.length)]).join('');
let randds = (n: number) => [...new Array(n)].map((e, i) => glyphs[randn(glyphs.length % 10)]).join('');

import ws = require('ws');
import { EventEmitter } from 'events';

export type MessageEvent = { data: string };
import sjs = require ('sockjs-client');
export let SuckJS = sjs;