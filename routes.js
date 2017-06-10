let fs       = require('fs');
let _        = require('promise-async');
let tripcode = require('tripcode');
let poke     = require('./poke-utils');
let db       = require('./db.js');
let shoe     = require('./shoedrip.js');
let mustache = require('mustache');
let mkdirp   = require('mkdirp');
let mv       = require('mv');
let cp       = require('child_process');

let cookieParser	= require('cookie-parser')
let bodyParser		= require('body-parser');
let multer			= require('multer');
let express			= require('express');
let upload          = multer({dest: '/tmp'});
let router			= express();
let compression     = require('compression');

router.set('env', 'production');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(cookieParser());
router.use(compression());

let files = fs.readdirSync('./templates')
	.filter(file => /\.mustache$/g.test(file))
	.map(file => file.replace(/\.mustache$/g, ''));

let fileCache = {};

let banners = fs.readdirSync('./public/ban');

files.forEach(f => {
	let file = 'templates/' + f + '.mustache';
	fileCache[f] = fs.readFileSync(file, 'utf8');
	fs.watch(file, {persistent: false, }, (event, name) => {
		if (event != 'change')
			return;
		console.log(file + ' changed');
		fileCache[f] = fs.readFileSync(file, 'utf8');
	});
});

fs.watch('./public/ban', {persistent: false}, (e, n) => {
	fs.readdir('./public/ban', (e, banfiles) => {
		banners = banfiles;
	});
})

let extend = (d, s) => {
	let ret = d;
	for(var i in s)
		d[i] = s[i];
	return d;
}

let render = (view, data) => {
	let subs = extend(fileCache, {content: fileCache[view]});
	return mustache.render(fileCache['shell'], data, subs);
}

let sendTemplate = (req, res, n, data) => {
	data = data || {};
	res.set({'Content-type': 'text/html'});
	data = extend(data, genericData(req));
	res.send(render(n, data));
	res.end();
}

let cookie2obj = (str) => {
	let cook = str.split(';').map(e => e.trim());
	let ret = {};
	cook.forEach(e => {
		let spl = e.split('=').map(kv => kv.trim());
		ret[spl[0]] = spl[1];
	});
	return ret;
}

let getSetOfTheDay = async cb => {
	let today = new Date();
	let seed = today.getDate() * (today.getMonth() + 1) * (today.getYear() + 1900);
	seed = seed % db.total;
	// >set of the "day"
	// >changes everytime you add or delete a set
	let set = db.getSetById('' + seed);
	set = await set;
	return poke.formatSetFromRow(set[0]);
}

let getCookieData = request => {
	if (!request.headers.cookie)
		return {
			dark: 'false',
			style_suffix: '',
			waifu: '/lillie2.png'
		};
	let cook = cookie2obj(request.headers.cookie);
	return {
		dark: cook.dark,
		style_suffix: cook.dark == 'true' ? '2' : '',
		waifu: cook.dark == 'true' ? '/moon.png' : '/lillie2.png'
	};
}

let genericData = (request) => {
	let ret = extend(shoe.champ, getCookieData(request));
	let rand_ban = banners[~~(Math.random() * banners.length)];
	ret = extend(ret, {banner: '/ban/' + rand_ban});
	return ret;
}

router.use(express.static('./public'));

router.get("/", async (request, response) => {
	let set = await getSetOfTheDay();
	sendTemplate(request, response, 'index', set);
});

router.get("/all", async (request, response) => {
	let spp = 15; //request.query.spp || 10;
	let npages = ~~(db.total / spp) + (db.total % spp != 0);
	let page = request.query.page || 0;
	page = ~~page;
	let sets = await db.getSetsPage(spp, page);
	sets = sets.map(e => { return poke.formatSetFromRow(e)});
	let data = {sets: sets};
	data = extend(data, {display_pages: true, current_page: ~~page + 1, npages: npages, lastpage: npages - 1});
	if (page > 0) {
		data.prev = ~~page - 1;
		data.has_prev = true;
	}
	if (page + 1 < npages)
		data.next = ~~page + 1;
	sendTemplate(request, response, 'all', data);
});

router.get("/import", (request, response) => {
	sendTemplate(request, response, 'import');
});

router.get("/thanks", (request, response) => {
	response.set({'Refresh': '2; url=/'});
	sendTemplate(request, response, 'import');
});

router.post("/update/:id", async (request, response, next) => {
	let handleErrorGen = e => {
		if(e) {
		}
	};

	try {
		if (request.body.action == "Update")
			await db.updateSet(request);
		else if (request.body.action == "Delete")
			await db.deleteSet(request);
		response.set({'Refresh': '0; url=/set/' + request.params.id});
	}
	catch(e) {
		response.set({'Refresh': '2; url=/'});
		response.send('You fucked up something. Back to the homepage in 2, 1...');
	}
	finally {
		response.end();    
	}
});

router.post("/add", async (request, response) => {
	try {
		let info = await db.createNewSet(request);
		response.set({'Refresh': '0; url=/set/' + info.insertId});
		response.end();
	}
	catch(e) {
		console.log(e);
		response.set({'Refresh': '2; url=/'});
		response.send('You fucked up something. Back to the homepage in 2, 1...');
		response.end();
	}
});

router.get("/random", (request, response) => {
	let randid = Math.random() * db.total;
	randid = ~~randid;
	response.set({'Refresh': '0; url=/set/' + randid});
	response.end();
});

router.post("/search", async (request, response) => {
	for(var i in request.body)
		if(request.body[i] === '')
			delete request.body[i];
	if(request.body.q) {
		let sets = await db.getSetsByName(request.body.q)
		sets = sets.map(poke.formatSetFromRow);
		sendTemplate(request, response, 'all', {sets: sets});
	}
	else { // Advanced search
		let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
					'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
					'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
					'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
					'spd_iv', 'spe_iv', 'description'];
		for(var i in request.body)
			if (data.indexOf(i) == -1)
				delete request.body[i];
		if (request.body == {}) {
			sendTemplate(request, response, 'all', {sets: []});
		} else {
			let sets = await db.getSetsByProperty(request.body);
			sets = sets.map(e => { return poke.formatSetFromRow(e)});
			sendTemplate(request, response, 'all', {sets: sets});			
		}
	}
});

router.get("/search", async (request, response) => {
	if(request.query.q) {
		let sets = await db.getSetsByName(request.body.q);
		sets = sets.map(poke.formatSetFromRow);
		sendTemplate(request, response, 'all', {sets: sets});
	}
	else {
		sendTemplate(request, response, 'search', {});
	}
});

router.get("/replays", async (request, response) => {
	let replays = await db.getReplays();
	let memes = [];
	for(var i = 0; i < replays.length; ++i)
		memes.push(await db.memesInReplay(replays[i].id));
	replays = replays.map((r, i) => extend(r, {memes: memes[i].map(poke.formatSetFromRow)}));
	let data = {replays: replays};
	if (request.query.fail)
		data['error'] = true;
	sendTemplate(request, response, 'replays', data);
});

router.get("/replays/add/:id", (request, response) => {
	data = { id: request.params.id };
	sendTemplate(request, response, 'addrset', data);
});

router.post("/replays/add/:id", async (request, response) => {
	response.set({'Content-type': 'text/html'});
	response.set({'Refresh': '0; url=/replays'});
	response.end();

	let id = request.body.set.match(/http:\/\/dogars\.ml\/set\/([0-9]+)/)[1];
	db.addSetToReplay(id, request.params.id);
});

router.post("/replays", async (request, response) => {
	if(/https?:\/\/replay.pokemonshowdown.com\/(.*)-[0-9]*/.test(request.body.link)) {
		db.addReplay(request.body);
		response.set({'Refresh': '0; url=/replays'});
	}
	else {
		response.set({'Refresh': '0; url=/replays?fail=true'});
	}
	response.end();
});

router.get("/fame", async (request, response) => {
	let sets = await db.getSetsByProperty({has_custom: 1})
	sets = sets.map(e => { return poke.formatSetFromRow(e)});
	sendTemplate(request, response, 'fame', {sets: sets});
});

router.get("/champs", async (request, response) => {
	let champs = await db.getChamps();
	let data = {champs: champs};
	sendTemplate(request, response, 'champs', data);
});

router.get("/suggest/:type", async (request, response) => {
	let data = {};
	if (request.params.type == 'banner') {
		sendTemplate(request, response, 'suggest-banner');
	}
	else if (/^\d+$/.test(request.params.type)) {
		let set = await db.getSetById(request.params.type);
		set = set[0];
		if (!set) {
			response.set({'Refresh': '0; url=/'});
			response.end();
			return;
		}
		set = poke.formatSetFromRow(set);
		sendTemplate(request, response, 'suggest-set', set);
	}
	else
		router._404(request, response, '/suggest/' + request.params.type);
});

router.post("/suggest", upload.single('sugg'), (request, response, next) => {
	if (!request.file)
		return next();
	let saveToDir = (dir) => {
		fs.access(dir, (err) => {
			if (err)
				mkdirp.sync(dir);
			fs.readdir(dir, (e, f) => {
				if (e)
					throw e;
				mv(request.file.path, dir + '/' + f.length + '-' + request.file.originalname, {mkdirp: true});
			});
		});
	}

	if (request.body.type == 'banner') {
		saveToDir('./ban-submission');
		response.set({'Refresh': '0; url=/thanks'});
		response.end();
	}
	else if (/^\d+$/.test(request.body.type)) {
		saveToDir('./sets/' + request.body.type);
		response.set({'Refresh': '0; url=/thanks'});
		response.end();
	}
	else
		router._404(request, response, '/suggest/' + request.params.type);
});

router.get("/set/:id", async (request, response) => {
	let set = await db.getSetById(request.params.id);
	set = set[0];
	if (!set) {
		response.set({'Refresh': '0; url=/'});
		response.end();
		return;
	}
	set = poke.formatSetFromRow(set);
	sendTemplate(request, response, 'set', set);
});

router._404 = (request, response, path) => {
	set = genericData(request);
	response.status(404);
	response.set(404, {'Content-type': 'text/html'});
	response.send(render('404', set));
	response.end();
}

router.use(function(request, response) {
	response.send(render('404', genericData(request)));
	response.end();
});

router.use(function(error, request, response, next) {
	console.log(error);
	response.send(render('500', genericData(request)));
	response.end();
});

module.exports = router;
