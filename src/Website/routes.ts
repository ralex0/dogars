import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import multer = require('multer');
import * as express from 'express';
import compression = require('compression');

import { settings } from '../Backend/settings';

let upload = multer({ dest: '/tmp' });

export let router = express();
let apiai = require('apiai');

import { api } from './api';
let bot = apiai(settings.botkey);

router.set('env', 'production');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(cookieParser());
router.use(compression());

router.disable('x-powered-by');

router.use(express.static(settings.ressources + '/public', { lastModified: true }));
router.use('/api', api);

router.get('*', (req, res, next) => {
	res.sendFile(settings.ressources + '/public/index.html');
})