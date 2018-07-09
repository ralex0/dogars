import fs = require('fs');
import { settings } from '../Backend/settings';
import { Sets } from '../Backend/Models/Sets';
import { getRandomSet } from '../Backend/mongo';

export let banners = fs.readdirSync(settings.ressources + '/public/ban');

let ranset: Sets | null = null;

export let match = (base: any, pattern: any): boolean => Object.keys(pattern).every(p => (base[p] !== undefined) && (base[p] === pattern[p]));

export const fileCache: { [idx: string]: string } = {};

fs.watch(settings.ressources + '/public/ban', { persistent: false }, (e, n) => {
    fs.readdir(settings.ressources + '/public/ban', (e, banfiles) => {
        banners = banfiles;
    });
})

export const extend = (d: any, s: any) => {
    let ret = d;
    for (let i in s)
        d[i] = s[i];
    return d;
}

setInterval(() => {ranset = null}, 1000 * 3600 * 24);

export const getSetOfTheDay = async () => {
    if (ranset)
        return ranset as Sets;
    let a = new Date();
    let seed = (((a.getMonth() + 1) * (a.getDay() + 1) * (a.getFullYear()) + 1));
    ranset = (await getRandomSet(seed))[0];
    return ranset;
}

export let levenshtein = (a: string, b: string) => {
    var tmp;
    a = a || '';
    b = b || '';
    if (a.length === 0) { return b.length; }
    if (b.length === 0) { return a.length; }
    if (a.length > b.length) { tmp = a; a = b; b = tmp; }

    var i, j, res, alen = a.length, blen = b.length, row = Array(alen);
    for (i = 0; i <= alen; i++) { row[i] = i; }

    for (i = 1; i <= blen; i++) {
        res = i;
        for (j = 1; j <= alen; j++) {
            tmp = row[j - 1];
            row[j - 1] = res;
            res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1,
                Math.min(res + 1, row[j] + 1));
        }
    }
    return res;
}

export let decompose = (obj: { [k: string]: any }): { [k: string]: any }[] => {
    let ret = [];
    for (let i in obj)
        ret.push({ [i]: obj[i] });
    return ret;
}

export let toId = (text: any) => {
    // this is a duplicate of Dex.getId, for performance reasons
    if (text && text.id) {
        text = text.id;
    } else if (text && text.userid) {
        text = text.userid;
    }
    if (typeof text !== 'string' && typeof text !== 'number') return '';
    return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export let snooze = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export let suck = (d: string) => JSON.parse(d.substr(1))[0];

export let clamp = (min: number, val: number, max: number) => {
    if (val < min)
        return min;
    if (val > max)
        return max;
    return val;
}

export let inverse = (o: any) => {
    let r: any = {};
    for (var k in o)
        r[o[k]] = k;
    return r;
}