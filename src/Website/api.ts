import fs = require('fs');
let fsp = fs.promises;

import * as express from 'express';
import bodyParser = require('body-parser');
import multer = require('multer');
import cors = require('cors');
import compression = require('compression');
import { Collection } from 'mongodb';
import cp = require('child_process');
import tripcode = require('tripcode');

import { settings } from '../Backend/settings';
import * as db from '../Backend/mongo';
import { Sets } from '../Backend/Models/Sets';
import { Replay } from '../Backend/Models/Replay';
import { decompose, banners, getSetOfTheDay } from './utils';

let upload = multer({ dest: '/tmp' });

export let api = express();

api.use(cors());
api.set('env', 'production');
api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(compression());

async function paginate<T>(coll: Collection<T>, pspp: number, ppage: number, query: any = {}, sort: any = { id: -1 }): Promise<[number, T[]]> {
    if (ppage <= 0)
        ppage = 1;
    if (pspp <= 0)
        pspp = 15;
    let spp = pspp || 15;
    spp > 100 && (spp = 100);
    let page = ppage || 1;
    let total = await coll.count(query);
    if (total == 0)
        return [0, []];
    let npages = total / spp + +(total % spp != 0);
    page >= npages && (page = npages - 1);
    let nskip = spp * (page - 1);
    return [total, await coll.find(query).sort(sort).skip(nskip).limit(spp).toArray()];
}

api.get('/sets', async (request, response) => {
    let res = await paginate(db.SetsCollection, +request.query.spp, +request.query.page);
    response.json(res);
});

api.get('/fame', async (request, response) => {
    let res = await paginate(db.SetsCollection, +request.query.spp, +request.query.page, { has_custom: 1 }, { id: 1 });
    response.json(res);
});

api.post('/sets', async (request, response) => {
    try {
        let set = await db.createNewSet(request.body);
        response.json(set.id);
    } catch (e) {
        response.status(400).json(e);
    }
});

api.get('/sets/:id', async (request, response) => {
    try {
        let result = await db.SetsCollection.findOne({ id: +request.params.id });
        if (!result)
            response.status(404).end();
        else
            response.json(result);
    } catch (e) {
        response.status(400).json(e);
    }
});

api.put('/sets/:id', async (request, response) => {
    try {
        let result = await db.updateSet(+request.params.id,
            request.body.trip, request.body);
        response.json({ success: true });
    } catch (e) {
        response.status(400).json(e);
    }
});

api.delete('/sets/:id', async (request, response) => {
    try {
        await db.deleteSet(+request.params.id, request.body.trip);
        response.json({});
    } catch (e) {
        response.status(400).json(e);
    }
});

api.get('/champs', async (req, res) => {
    let r = await paginate(db.ChampsCollection, +req.query.spp, +req.query.page);
    res.json(r);
});

api.get('/replays', async (req, res) => {
    let r = await paginate(db.ReplaysCollection,
        +req.query.spp,
        +req.query.page, {
            manual: 1
        });
    res.json(r);
});

api.get('/replays/auto', async (req, res) => {
    let r = await paginate(db.ReplaysCollection,
        +req.query.spp,
        +req.query.page, {
            manual: 0
        });
    res.json(r);
});

api.post('/replays', async (req, res) => {
    if (/https?:\/\/replay.pokemonshowdown.com\/(.*)-[0-9]*/.test(req.body.link)) {
        let repl = new Replay(req.body.link,
            req.body.description, req.body.champ || '', req.body.trip || '', 1);
        await db.ReplaysCollection.insertOne(repl);
        res.json({});
    } else {
        res.status(400);
    }
});

api.get('/changelog', (req, res) => {
    res.json([]);
});

api.post('/contact', (req, res) => {
    try {
        let inputData = "Subject: " + req.body.sub + "\n";
        inputData += 'Content-Type: text/plain; charset="utf-8"\n';
        inputData += req.body.com + '\n';

        let child = cp.spawnSync('sendmail', [settings.admin_mail], {
            input: inputData
        });
    } catch (e) {
        res.status(400).json(e);
    }
});

api.post("/trip", (request, response) => {
    response.json(tripcode(request.body.v));
});

api.get("/day", async (request, response) => {
    let ranset = await getSetOfTheDay();
    response.json(ranset);
});

api.get("/random", async (request, response) => {
    let ranset = await db.getRandomSet();
    response.json(ranset[0].id);
});

api.get("/ban", (req, res) => {
    let len = banners.length;
    res.json(banners[~~(Math.random() * len)]);
})

api.get("/search", async (request, response) => {
    let page = request.query.page || 1;
    page < 1 && (page = 1);
    let spp = request.query.spp || 15;
    spp < 1 && (spp = 15);
    spp > 100 && (spp = 100);
    try {
        Object.keys(request.query)
            .filter(attr => request.query[attr] === '')
            .forEach(attr => { delete request.query[attr] });
        if (request.query.q) {
            let matching = ['name', 'item', 'species', ...[1, 2, 3, 4].map(e => `move_${e}`)];
            let results = await paginate(db.SetsCollection, spp, page, {
                $or: matching.map(k => {
                    return { [k]: new RegExp(request.query.q, 'i') };
                })
            }, { id: 1 });
            response.json(results);
        } else { // Advanced search
            let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
                'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
                'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
                'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
                'spd_iv', 'spe_iv', 'description'];
            Object.keys(request.query)
                .filter(v => !data.includes(v))
                .forEach(attr => { delete request.query[attr] });
            let results = await paginate(db.SetsCollection, spp, page, {
                $and: decompose(request.query).map(k => {
                    let prop = Object.keys(k)[0];
                    k[prop] = new RegExp(k[prop], 'i');
                    return k;
                })
            }, { id: 1 });
            response.json(results);
        }
    } catch (e) {
        response.status(400).json(e);
    }
});

api.get('/custom/:id', async (req, res) => {
    let exts = ['png', 'jpg', 'gif'];
    let id = req.params.id;
    let file = '';
    for (let ext of exts) {
        file = `${settings.ressources}/public/sets/${id}.${ext}`;
        if (fs.existsSync(file))
            return res.sendFile(file);
    }
    res.status(404).end();
});

api.use(function (request, response) {
    response.status(404);
});
