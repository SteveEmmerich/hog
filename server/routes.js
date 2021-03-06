/*
 * @license MIT
 * @file routes.js
 * @copyright KeyW Corporation 2016
 */


'use strict';

var config = require('./config/environment');

/**
 * Sets up the Rest API
 * @method exports
 * @param {} app
 */
module.exports = function (app) {

  // API

  app.route('/:url(api|app|bower_components|assets)/*')
    .get(function (req, res) {
      res.status(404).end();
    });

  app.route('/*')
    .get(function (req, res) {
      res.sendFile(
        app.get('appPath') + '/index.html',
        { root: config.root }
      );
    });

};
