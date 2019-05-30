import request = require('request-promise-native');
import cheerio = require('cheerio');

export async function *proxyList() {
    console.log('GETing');
    let code = await request.get('https://www.socks-proxy.net/');
    let doc = cheerio.load(code);
    let elems = doc('#proxylisttable tr');
    let links: string[] = elems.map(function(i, e){
        return `socks4://${doc(e.children[0]).text()}:${doc(e.children[1]).text()}`;
    }).get();
    console.log('GOT');
    yield *links.slice(1);
}