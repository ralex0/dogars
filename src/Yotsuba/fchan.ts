import * as request from 'request-promise-native';

export namespace fchan {
    export class Catalog {
        pages: Page[] = [];
    }

    export class Page {
        page: number = 0;
        threads?: OP[] | null;
        constructor(js: any) {
            this.page = js.page;
            this.threads = js.threads.map((t: any) => new OP(t));
        }
    }

    export class OP {
        no: number = 0;
        now: string = '';
        name: string = '';
        sub?: string | null;
        com?: string | null;
        filename: string = '';
        ext: string = '';
        w: number = 0;
        h: number = 0;
        tn_w: number = 0;
        tn_h: number = 0;
        tim: number = 0;
        time: number = 0;
        md5: string = '';
        fsize: number = 0;
        resto: number = 0;
        bumplimit: number = 0;
        imagelimit: number = 0;
        semantic_url: string = '';
        custom_spoiler: number = 0;
        replies: number = 0;
        images: number = 0;
        omitted_posts?: number | null;
        omitted_images?: number | null;
        last_replies?: LastReply[] | null;
        last_modified: number = 0;
        trip?: string | null;
        spoiler?: number | null;

        async getThread(): Promise<Thread> {
            let now = new Date();
            let b = await request.get({
                url: `http://a.4cdn.org/vp/thread/${this.no}.json`
            });
            b = JSON.parse(b);
            return new Thread(now, this.no, b.posts);
        }

        constructor(js: any) {
            Object.assign(this, js);
        }
    }

    export class LastReply {
        no: number = 0;
        now: string = '';
        name?: string | null;
        com?: string | null;
        time: number = 0;
        resto: number = 0;
        filename?: string | null;
        ext?: string | null;
        w?: number | null;
        h?: number | null;
        tn_w?: number | null;
        tn_h?: number | null;
        tim?: number | null;
        md5?: string | null;
        fsize?: number | null;
        trip?: string | null;
        spoiler?: number | null;
        filedeleted?: number | null;
    }

    export class Thread {
        posts?: Post[] | null;
        lastmod: Date;
        id: number;

        constructor(lastmod: Date, id: number, posts: Post[]) {
            this.posts = posts;
            this.lastmod = lastmod;
            this.id = id;
        }

        async update() {
            let b = await request.get({
                headers: { 'If-Modified-Since': this.lastmod.toUTCString() },
                url: `http://a.4cdn.org/vp/thread/${this.id}.json`
            });
            b = JSON.parse(b);
            this.posts = b;
        }
    }

    export class Post {
        no: number = 0;
        closed?: number | null;
        now: string = '';
        name: string = '';
        sub?: string | null;
        com?: string | null;
        filename?: string | null;
        ext?: string | null;
        trip?: string | null;
        w?: number | null;
        h?: number | null;
        tn_w?: number | null;
        tn_h?: number | null;
        tim?: number | null;
        time: number = 0;
        md5?: string | null;
        fsize?: number | null;
        resto: number = 0;
        archived?: number | null;
        bumplimit?: number | null;
        archived_on?: number | null;
        imagelimit?: number | null;
        semantic_url?: string | null;
        custom_spoiler?: number | null;
        replies?: number | null;
        images?: number | null;
        tail_size?: number | null;
        spoiler?: number | null;
    }

    export let getBoard = async (board: string): Promise<Page[]> => {
        let b = await request.get(`http://a.4cdn.org/${board}/catalog.json`);
        let pages: any[] = JSON.parse(b);
        return pages.map(p => new Page(p));
    }
}