import { MongoClient, Db, Collection } from 'mongodb';
import { settings } from './settings';
import * as request from 'request-promise-native';
import * as tripcode from 'tripcode';

import { ShowdownStat } from '../Showdown/ShowdownStats';
import { BattleData } from '../Showdown/BattleData';

import { toId } from '../Website/utils';
import { pokeUtils } from '../Website/poke-utils';

import { Champ } from './Models/Champ';
import { Sets } from './Models/Sets';
import { Replay } from './Models/Replay';

const url = `mongodb://${settings.db.host}:${settings.db.port || 27017}`;
const dbName = settings.db.database;
let memes: Db;

export let total = 0;
export let ChampsCollection: Collection<Champ>;
export let SetsCollection: Collection<Sets>;
export let ReplaysCollection: Collection<Replay>;

let connection: MongoClient;
let inited = false;
export let init = async () => {
    if (inited)
        return;
    connection = await MongoClient.connect(url, { useNewUrlParser: true });
    memes = connection.db(dbName);
    let collections = await memes.collections();
    inited = true;
    ChampsCollection = memes.collection('Champs');
    SetsCollection = memes.collection('Sets');
    ReplaysCollection = memes.collection('Replays');
    total = await SetsCollection.countDocuments({});
}

const updateElo = async (trip: string, name: string) => {
    let b: string = await request.get(`https://play.pokemonshowdown.com/~~showdown/action.php?act=ladderget&user=${toId(name)}`);
    let stats: ShowdownStat[] = JSON.parse(b.substr(1));
    if (stats.length == 0)
        throw "Unregistered or never played";
    let oustat = stats.filter(e => e.formatid == 'gen7ou')[0];
    if (!oustat)
        throw "Never played OU";
    let ouelo = ~~oustat.elo;
    // no need to sync
    ChampsCollection.updateOne({
        trip
    }, {
            $set: {
                elo: ouelo,
                showdown_name: name
            }
    });
}

export const registerChampResult = async (battleData: BattleData, hasWon: boolean): Promise<void> => {
    let replayurl: string = '';
    try {
        updateElo(battleData.champ.trip, battleData.champ.showdown_name);
    } catch (e) {
        console.log(e);
    }
    let inc = hasWon ? 'wins' : 'loses';
    let champ = ChampsCollection.findOne({ trip: battleData.champ.trip });
    if (!champ) {
        ChampsCollection.insertOne(new Champ(battleData.champ.name, battleData.champ.trip));
    }
    if (battleData.champ.avatar != '166')
        await ChampsCollection.updateOne({
            trip: battleData.champ.trip
        }, {
                $set: { avatar: battleData.champ.avatar }
            });
    await ChampsCollection.updateOne({
        trip: battleData.champ.trip
    }, {
            $inc: { [inc]: 1 },
            $set: {
                name: battleData.champ.name,
                last_seen: +new Date
            }
        });
    if (!hasWon)
        return;
    await pokeUtils.saveReplay(battleData.champ.current_battle);
    replayurl = 'http://replay.pokemonshowdown.com/' + battleData.roomid;
    let savedrepl = await ReplaysCollection.insertOne(new Replay(replayurl,
        'Automatically uploaded replay. Champ: ' + battleData.champ.name + ' ' + battleData.champ.trip,
        battleData.champ.name,
        battleData.champ.trip,
        0));
    let n = 0;
    for (let i = 0; i < battleData.memes.length; ++i) {
        let set = await SetsCollection.findOne({ name: battleData.memes[i].name })
        if (set) {
            ++n;
            await ReplaysCollection.update({ _id: savedrepl.insertedId },
                { $push: { sets: set } });
        }
    }
}

export const deleteSet = async (id: number, trip: string, ignored?: any) => {
    let row = await SetsCollection.findOne({ id });
    if (!row)
        throw 'No such set';
    if (trip != settings.admin_pass && (!row.hash || !trip))
        throw 'No tripcode associated with this set or no tripcode given';
    if (!(trip == settings.admin_pass || row.hash == tripcode(trip)))
        throw 'Wrong tripcode';
    let del = await SetsCollection.deleteOne({ id });
    total--;
    return null;
}

export const updateSet = async (id: number, trip: string, info: { format: string, desc: string, set: string }) => {
    let uset = await SetsCollection.findOne({ id });
    if (!uset)
        throw 'No such set';
    if (trip != settings.admin_pass && (!uset.hash || !trip))
        throw 'No tripcode associated with this set or no tripcode given';
    if (!(trip == settings.admin_pass || uset.hash == tripcode(trip)))
        throw 'Wrong tripcode';
    uset.format = "gen7ou";
    let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
        "nu", "pu", "lc", "cap"];
    if (formats.includes(info.format))
        uset.format = info.format;
    uset.description = info.desc.substr(0, 230);
    let pok = pokeUtils.parseSet(info.set);
    pok.format = uset.format;
    for (let i in pok)
        uset[i] = pok[i];
    uset.date_added = +new Date();
    let errors = await pokeUtils.checkSet(pok);
    if (errors) {
        throw errors;
    }
    SetsCollection.updateOne({ id }, { $set: uset });
    return null;
}

export const buildCheckableSet = (set: Sets) => {
    let nset = set;
    [1, 2, 3, 4]
        .map(d => 'move_' + d)
        .forEach(mp => nset[mp] = nset[mp] ? (<string>nset[mp]).split('/')[0].trim() : null);
    return nset;
}


export const createNewSet = async (sdata: {
    trip: string,
    format: string,
    desc: string,
    set: string,
    creat: string
}) => {
    let nset: Sets = {} as Sets;
    nset.hash = tripcode(sdata.trip);
    nset.format = "gen7ou";
    let formats = ["gen7ou", "gen7ubers", "gen7anythinggoes", "gen7uu", "gen7ru", "gen7nu", "gen7pu", "gen7lc", "gen7natureswap", "gen7balancedhackmons", "gen7mixandmega", "gen7almostanyability", "gen7camomons", "gen7stabmons", "gen7customgame"];
    if (formats.includes(sdata.format))
        nset.format = sdata.format;
    nset.creator = sdata.creat.substr(0, 23);
    nset.description = sdata.desc.substr(0, 230);
    let pok = pokeUtils.parseSet(sdata.set);
    pok.format = nset.format;
    let errors = await pokeUtils.checkSet(pok);
    if (errors)
        throw errors;
    for (let i in pok)
        nset[i] = pok[i];
    nset.date_added = +new Date();
    total++;
    nset.id = (await SetsCollection.find().sort({ id: -1 }).toArray())[0].id + 1;
    await SetsCollection.insert(nset);
    return nset;
}

export let getRandomSet = async (seed: number = ~~(Math.random() * total)) => SetsCollection.find().skip(seed % total).limit(1).toArray();
