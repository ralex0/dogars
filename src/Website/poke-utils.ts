import request = require('request-promise-native');

import { toId, clamp } from './utils';

import { connection } from '../Showdown/PSConnection';
import { PSCheckTeamRequest, PSSaveBattleRequest } from '../Showdown/PSMessage';

import { Sets } from '../Backend/Models/Sets';
import { buildCheckableSet } from '../Backend/mongo';
import { BattleURL } from '../Backend/CringeCompilation';
import { RoomID } from '../Showdown/PSRoom';

// Shamelessly stolen and adapted from showdown-client
let BattleStatIDs: { [idx: string]: string } = {
    HP: 'hp',
    hp: 'hp',
    Atk: 'atk',
    atk: 'atk',
    Def: 'def',
    def: 'def',
    SpA: 'spa',
    SAtk: 'spa',
    SpAtk: 'spa',
    spa: 'spa',
    SpD: 'spd',
    SDef: 'spd',
    SpDef: 'spd',
    spd: 'spd',
    Spe: 'spe',
    Spd: 'spe',
    spe: 'spe'
};

export module pokeUtils {
    // I'm never touching this.
    export let parseSet = (text: string) => {
        let stext = text.split("\n");
        var team = [];
        var curSet: any = {};
        let moves = [];
        let first = false;
        for (var i = 0; i < stext.length; i++) {
            var line = stext[i].trim();
            if (!first) {
                first = true;
                curSet.hp_iv = curSet.atk_iv = curSet.def_iv = curSet.spa_iv = curSet.spd_iv = curSet.spe_iv = 31;
                curSet.hp_ev = curSet.atk_ev = curSet.def_ev = curSet.spa_ev = curSet.spd_ev = curSet.spe_ev = 0;

                team.push(curSet);
                var atIndex = line.lastIndexOf(' @ ');
                if (atIndex !== -1) {
                    curSet.item = line.substr(atIndex + 3);
                    line = line.substr(0, atIndex);
                }
                if (line.substr(line.length - 4) === ' (M)') {
                    curSet.gender = 'M';
                    line = line.substr(0, line.length - 4);
                }
                if (line.substr(line.length - 4) === ' (F)') {
                    curSet.gender = 'F';
                    line = line.substr(0, line.length - 4);
                }
                var parenIndex = line.lastIndexOf(' (');
                if (line.substr(line.length - 1) === ')' && parenIndex !== -1) {
                    line = line.substr(0, line.length - 1);
                    curSet.species = line.substr(parenIndex + 2);
                    line = line.substr(0, parenIndex);
                    curSet.name = line;
                } else {
                    curSet.species = line.trim();
                    curSet.name = '';
                }
            } else if (line.substr(0, 9) === 'Ability: ') {
                line = line.substr(9);
                curSet.ability = line.substr(0, 20);
            } else if (line === 'Shiny: Yes') {
                curSet.shiny = 1;
            } else if (line.substr(0, 7) === 'Level: ') {
                line = line.substr(7);
                curSet.level = clamp(1, +line, 100);
            } else if (line.substr(0, 11) === 'Happiness: ') {
                line = line.substr(11);
                curSet.happiness = clamp(0, +line, 256);
            } else if (line.substr(0, 5) === 'EVs: ') {
                line = line.substr(5);
                var evLines = line.split('/');

                curSet.hp_ev = curSet.atk_ev = curSet.def_ev = curSet.spa_ev = curSet.spd_ev = curSet.spe_ev = 0;

                for (var j = 0; j < evLines.length; j++) {
                    var evLine = evLines[j].trim();
                    var spaceIndex = evLine.indexOf(' ');
                    if (spaceIndex === -1) continue;
                    var statid = BattleStatIDs[evLine.substr(spaceIndex + 1)];
                    var statval = parseInt(evLine.substr(0, spaceIndex), 10);
                    if (!statid) continue;
                    curSet[statid + '_ev'] = clamp(0, statval, 252);
                }
            } else if (line.substr(0, 5) === 'IVs: ') {
                line = line.substr(5);
                var ivLines = line.split(' / ');
                curSet.hp_iv = curSet.atk_iv = curSet.def_iv = curSet.spa_iv = curSet.spd_iv = curSet.spe_iv = 31;
                for (var j = 0; j < ivLines.length; j++) {
                    var ivLine = ivLines[j];
                    var spaceIndex = ivLine.indexOf(' ');
                    if (spaceIndex === -1) continue;
                    var statid = BattleStatIDs[ivLine.substr(spaceIndex + 1)];
                    var statval = parseInt(ivLine.substr(0, spaceIndex), 10);
                    if (!statid) continue;
                    if (isNaN(statval)) statval = 31;
                    curSet[statid + '_iv'] = clamp(0, statval, 31);
                }
            } else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
                var natureIndex = line.indexOf(' Nature');
                if (natureIndex === -1) natureIndex = line.indexOf(' nature');
                if (natureIndex === -1) continue;
                line = line.substr(0, natureIndex);
                if (line !== 'undefined') curSet.nature = line.substr(0, 15);
            } else if (line.substr(0, 1) === '-' || line.substr(0, 1) === '~') {
                line = line.substr(1);
                if (line.substr(0, 1) === ' ') line = line.substr(1);
                moves.push(line);
            }
        }
        curSet.move_1 = moves[0];
        curSet.move_2 = moves[1];
        curSet.move_3 = moves[2];
        curSet.move_4 = moves[3];
        curSet.name = curSet.name!.substr(0, 30);
        curSet.species = curSet.species!.substr(0, 30);
        return curSet;
    }

    let headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.8,fr;q=0.6,ja;q=0.4,de;q=0.2',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'dnt': '1',
        'origin': 'https://play.pokemonshowdown.com',
        'referer': 'https://play.pokemonshowdown.com/crossprotocol.html?v1.2',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
    }

    let replayq = 'a["|queryresponse|savereplay|';

    let pack = (set: Sets): string => {
        let packed = `${set.name || ''}|`;
        let attrs1 = ['species', 'item', 'ability'];
        packed += attrs1.map(attr => `${toId(set[attr])}|`).join('');
        packed += [1, 2, 3, 4]
            .map(d => `move_${d}`)
            .map(m => toId(set[m]))
            .join(',') + '|';
        packed += `${set.nature || ''}|`;
        let appstats = (n: string, def: number) =>
            ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
                .map(s => `${s}_${n}`)
                .map(s => set[s] == def ? '' : set[s])
                .join(',');
        packed += `${appstats('ev', 0)}|`;
        packed += `${set.gender || ''}|`;
        packed += `${appstats('iv', 31)}|`;
        if (set.shiny)
            packed += 'S';
        packed += `|${(set.level && set.level != 100) ? set.level : ''}|`;
        packed += ((set.happiness && set.happiness < 255) ? set.happiness : '');
        return packed;
    }

    export let checkSet = async (set: Sets) => {
        let cset = buildCheckableSet(set);
        await connection.setTeam(pack(cset));
        let req = new PSCheckTeamRequest(set.format!);
        let res = await connection.request(req);
        if (res.failed)
            return res.reasons;
        return null;
    }

    export let saveReplay = async (url: BattleURL) => {
        let room = url.match(/(battle-.*)\/?/)![0] as RoomID;
        let roomid = url.match(/battle-(.*)\/?/)![1];
        // maybe something wrong here
        connection.tryJoin(room);
        let req = new PSSaveBattleRequest(room);
        let data = await connection.request(req);
        try {
            await request.post('http://play.pokemonshowdown.com/~~showdown/action.php?act=uploadreplay', {
                headers: headers,
                form: data
            });
        } catch (e) {
            console.log("Couldn't save replay:", data, e);
        }
    }
}
