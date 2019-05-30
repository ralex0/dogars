import { PSConnection } from "./PSConnection";
import { BattleEventsType, BattleEventsName, BattleEvents, As } from "./PSMessage";

export type RoomID = string & As<'RoomID'>;

export class PSRoom {
    con: PSConnection;
    room: RoomID;
    messqueu: BattleEventsType[] = [];

    res?: { filter?: BattleEventsName, res: (ev: BattleEventsType) => void} ;

    constructor(conn: PSConnection, room: RoomID) {
        this.con = conn;
        this.room = room;
    }

    recv(ev: BattleEventsType) {
        if(this.res && (this.res.filter === undefined || ev[0] == this.res.filter)) {
            this.res.res(ev);
            this.res = undefined;
        }
        else
            this.messqueu.push(ev);
    }

    async read<T extends BattleEventsName>(filter?: T) : Promise<BattleEvents[T]> {
        return new Promise<BattleEventsType>((res, rej) => {
            if(this.messqueu.length >= 1) {
                let idx = this.messqueu.findIndex(m => filter === undefined || m[0] == filter);
                let a: BattleEvents[T] = this.messqueu.splice(idx, 1)[0]! as any;
                return res(a);
            }
            this.res = {filter, res};
        }) as any;
    }

    send(data: string) {
		this.con.send(`${this.room}|${data}`);
    }
}
