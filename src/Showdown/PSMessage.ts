import { PSRoom } from "./PSRoom";
import { ShowdownMon } from "./ShowdownMon";

export type PSJoinMessage = PSLeaveMessage;

export class UnknownMessage {
}

export interface PSRequest<T extends PSMessage> {
    isResponse(m: T): boolean;
    buildResponse(m: T): any;
    toString(): string;
}

export interface PSRoomRequest<T extends PSMessage> extends PSRequest<T> {
    room: string;
    isResponse(m: T): boolean;
    buildResponse(m: T): any;
    toString(): string;
}

export class PSSaveBattleRequest implements PSRoomRequest<QueryResponse> {
    room: string;

    constructor(room: string) {
        this.room = room;
    }

    isResponse(m: QueryResponse): boolean {
        return m.type == 'savereplay';
    }

    buildResponse(m: QueryResponse) {
        return JSON.parse(m.data);
    }

    toString(): string {
        return `${this.room}|/savereplay`;
    }
}

export class PSCheckTeamRequest implements PSRequest<Popup> {
    format: string;
    constructor(format: string) {
        this.format = format;
    }

    isResponse(m: Popup): boolean {
        return m.text.indexOf('Your team') == 0;
    }

    buildResponse(m: Popup): any {
        let res = m.text.split('||');
        let failed = res[0].indexOf('rejected') != -1;
        let reasons = res.slice(2);
        return {failed, reasons};
    }

    toString(): string {
        return `|/vtm ${this.format}`;
    }
}

export interface PSRoomSaveRequest extends PSRequest<QueryResponse> {
    room: PSRoom; 
}

export class PSMessage {
    event_name: string = '';
}

export class PSBattleMessage extends PSMessage {
    name: string = '';
    params: any[] = [];
}

export class UpdateUser extends PSMessage {
    user: string = '';
    avatar: string = '';
}

export class UpdateSearchMessage extends PSMessage {
    searches: {games: string[]} = {games: []};
}

export class Formats extends PSMessage {
    formats: string[] = [];
}

export class QueryResponse extends PSMessage {
    data: string = '';
    type: string = '';
}

export class Popup extends PSMessage {
    text = '';
}

export class Challstr extends PSMessage {
    challstr: string = '';
}

export class PSLeaveMessage extends PSBattleMessage {
    username: string = '';
}

export class MoveOrder {
    move = '';
    id = '';
    pp = 0;
    maxpp = 0;
    disabled = false;
    target = 'normal'
}

export class PokemonOrder {
    moves: MoveOrder[] = [];
    canMegaEvo = false;
}

export class PSRequestMessage extends PSBattleMessage {
    active: PokemonOrder[] = [];
    side: { pokemon?: ShowdownMon[] } = {};
    rqid: number = 0;
}

export class PSFaintMessage extends PSBattleMessage {
    nick = '';
}

export class PSChatMessage extends PSBattleMessage {
    username = '';
    content = '';
}

export class PSSwitchMessage extends PSBattleMessage {
    nick = '';
    status = '';
}

export class PSPlayerDecl extends PSBattleMessage {
    alias?: 'p1' | 'p2';
    showdown_name = '';
    avatar = '';
}

export class PSWinMessage extends PSLeaveMessage{} 

let messageToPSBattleMessage = (d: string): PSBattleMessage => {
    let ret: PSBattleMessage = new PSBattleMessage();
    let s = d.split('|');
    s.shift();
    /*
    faint: this.faint,
    inactive: this.inactive
    */
    switch(s[0]) {
        case 'faint':
            let f = new PSFaintMessage();
            f.nick = s[1];
            ret = f;
            break;
        case 'player':
            //player|p2|POO IN SPACE|278
            let pl = new PSPlayerDecl();
            pl.alias = s[1] as 'p1' | 'p2';
            pl.showdown_name = s[2];
            pl.avatar = s[3];
            ret = pl;
            break;
        case 'switch':
            let sw = new PSSwitchMessage();
            sw.nick = s[1];
            sw.status = s[2];
            ret = sw;
            break;
        case 'win':
            let u = new PSWinMessage();
            u.username = s[1].trim();
            ret = u;
            break; 
        case 'c': // chat
            let c = new PSChatMessage();
            c.username = s[1].trim();
            c.content = s[2];
            ret = c;
            break;
        case 'request':
            let r = new PSRequestMessage();
            let js = JSON.parse(s.slice(1).join('|'));
            r.active = js.active;
            r.side = js.side;
            r.rqid = js.rqid;
            ret = r;
            break;
        case 'l': // chat
        case 'j': // chat
            let l = new PSLeaveMessage();            
            l.username = s[1].trim();
            ret = l;
            break;
        default:
            ret = new PSBattleMessage();
    }
    ret.name = s[0];
    return ret;
}

let messageToPSMessage = (d: string): PSMessage => {
    let ret: PSMessage;
    let s = d.split('|');
    s.shift();
    switch (s[0]) {
        case 'updateuser':
            let u = new UpdateUser();
            u.user = s[1];
            u.avatar = s[3];
            ret = u;
            break;
        case 'queryresponse':
            let qr = new QueryResponse();
            qr.type = s[1];
            qr.data = s.slice(2).join('|');
            ret = qr;
            break;
        case 'popup':
            let p = new Popup();
            p.text = s.slice(1).join('|');
            ret = p;
            break;
        case 'formats':
            ret = new Formats();
            /// don't care about that yet
            break;
        case 'challstr':
            let v = new Challstr();
            v.challstr = s.slice(1).join('|');
            ret = v;
            break;
        case 'updatesearch':
            let usm = new UpdateSearchMessage();
            usm.searches = JSON.parse(s.slice(1).join('|'));
            ret = usm;
        default:
            ret = new PSMessage;
    }
    ret.event_name = s[0];
    return ret;
}

export let eventToPSBattleMessage = (me: MessageEvent): {
    room: string, 
    events: PSBattleMessage[]
} => {
    let data: string[] = me.data.split('\n');
    return {
        room: data.shift()!.substr(1),
        events: data.map(messageToPSBattleMessage)
    }
}

export let eventToPSMessages = (me: MessageEvent): PSMessage[] => {
    let data: string[] = me.data.split('\n');
    return data.map(messageToPSMessage);
}

export let battleEventNameToType:
 {[idx:string]: any} = {
    l: PSLeaveMessage,
    faint: PSFaintMessage,
    win: PSWinMessage,
    "switch": PSSwitchMessage,
    c: PSChatMessage,
    j: PSLeaveMessage,
    inactve: PSLeaveMessage,
};