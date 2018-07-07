import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import * as express from 'express';
import compression = require('compression');

import { settings } from '../Backend/settings';

export let router = express();
let apiai = require('apiai');

import { api } from './api';
import cors = require('cors');

api.use(cors());
router.use(cors());

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