'use strict';

var fs      = require('fs');
var _       = require('lodash');
var spawn   = require('child_process').spawn;
var logger  = require('../../config/logger.js');
var path   = require('path');
// if you want to track ids locally uncomment below.
/* Local ID */
var nextId = 0;

var collection = {
    raw: {},
    instances: {}
}
var Pig = function(obj)
{
    /* Preform creation logic. */

    this.id = obj.id;
    this.name = obj.name;
    this.args = obj.args;
    this.data = obj.data;
    obj.logs = [];
    obj.output = [];
    collection.raw[this.id] = obj;
   // exports.created(obj);
}
Pig.prototype.update = function(obj, cb)
{
    /* Preform update logic */

    console.log('Pig: ', this.id, 'being updated');
    obj = JSON.parse(obj);
    console.log('to: ', obj);

    this.args = obj.args;
    this.data = obj.data;
    if (this.name != obj.name)
        this.updateName(obj.name, cb);
    this.name = obj.name;
    //this.id = obj.id;
    this.save(cb);
    collection.raw[this.id] = obj;
    cb(null, obj);
    //exports.updated(obj);
}
Pig.prototype.remove = function(obj)
{
    /* Preform remove logic. */
    //exports.removed(obj);
}
Pig.prototype.save = function(cb)
{
    fs.writeFile('server/scripts/pig/' + this.name + '.pig', this.data, 'utf-8', cb);
}
Pig.prototype.updateName = function(name, cb)
{
    fs.writeFile('server/scripts/pig/' + name + '.pig', this.data, 'utf-8', cb);
}

exports.save = function(cb)
{
    console.log('writting file', collection.raw);

    fs.writeFile('server/api/pig/pig.data.json', JSON.stringify(collection.raw, null, 2), 'utf-8', cb);
}
exports.load = function(cb)
{
    fs.readFile('server/api/pig/pig.data.json', 'utf-8',
        function(err, data)
        {
            if (err)
            {
                return cb(err);
            }

            collection.raw = JSON.parse(data);
            for(var id in collection.raw)
            {
                collection.instances[id] = new Pig(collection.raw[id]);
                /* Local ID */

                if (nextId < id)
                {
                    nextId = id + 1;
                }
            }
    })
}

exports.create = function(obj, cb)
{
    /* Local ID */
    obj.id = nextId;
    if (_.find(collection.raw, { name: obj.name}) != undefined)
    {
        setImmediate(
            function()
            {
                cb('name alread exists', obj);
            });
        return;
    }
    var inst = new Pig(obj);
    collection.instances[inst.id] = inst;
    inst.save(
        function(err)
        {
            if(err)
                return cb(err, obj);

            this.save(
                function(err)
                {
                    cb(err, obj);
                });
        });

    /* Local ID */
    nextId++;

}
exports.list = function(cb)
{
    setImmediate(
        function()
        {
            cb(null, _.values(collection.raw));
        });
}
exports.find = function(id, cb)
{
    if (_.isUndefined(collection.raw[id]))
    {
        var err = 'Id ' + id + ' was not found in Pig collection';
        if (_.isUndefined(cb) )
        {
            return err;
        }
        else
        {
            setImmediate(
                function()
                {
                    cb(err);
                });
        }
    }
    else
    {
        if (_.isUndefined(cb) )
        {
            return collection.raw[id];
        }
        else
        {
            setImmediate(
                function()
                {
                    cb(null, collection.raw[id]);
                });
        }
    }
}
exports.update = function(id, changes, cb)
{
    if (_.isUndefined(collection.instances[id]) || _.isUndefined(collection.raw[id]))
    {
        setImmediate(
            function()
            {
                cb('Id ' + id + ' was not found in Pig collection');
            });
    }
    else
    {
        var up = this;
        console.log('Instance of id: ', id, 'data : ', collection.instances[id], 'changes: ', changes);
        collection.instances[id].update(changes,
            function(err, raw)
            {
                up.save(
                    function(err)
                    {
                        console.log('finished saving');
                        cb(err, raw);
                    });
            });
    }
}
exports.delete = function(id, cb)
{
    if (_.isUndefined(collection.instances[id]) || _.isUndefined(collection.raw[id]))
    {
        setImmediate(
            function()
            {
                cb('Id ' + id + ' was not found in Pig collection');
            });
    }
    else
    {
        collection.instances[id].remove();
        delete collection.instances[id];
        delete collection.raw[id];
        this.save(cb);
    }
}
exports.run = function(id, stdoutCB, stderrCB, errCB)
{
    logger.debug('Running Pig Script: ', id);
     if (_.isUndefined(collection.instances[id]) || _.isUndefined(collection.raw[id]))
    {
        setImmediate(
            function()
            {
                errCB('Id ' + id + ' was not found in Pig collection');
            });
    }
    else
    {
        var nArg = [];
        for( var index in collection.instances[id].args)
        {
            nArg.push(_.values(collection.instances[id].args[index]));
        }
        nArg = _.flatten(nArg);
        //nArg = [];
        nArg.push(path.join(__dirname, '../../',  'scripts/pig/', collection.instances[id].name +  '.pig'));
        logger.debug('Args: ', JSON.stringify(nArg));


        var pig = spawn('pig', nArg);
        var prgs = 0;
        pig.stdout.on('data',
            function(d)
            {
                logger.debug('data: ', JSON.stringify(d.toString(), null, 2));
                //Parse the log
                var parsed = {type: 'output', data: JSON.stringify(d.toString(), null, 2)};
                setImmediate(
                    function()
                    {
                        stdoutCB(parsed);
                    });
            });
        pig.stderr.on('data',
            function(d)
            {
                var parser = /(\d+-\d+-\d+)\s(\d+:\d+:\d+),(\d+)\s\[([a-z]*)\]\s([A-Z]+)\s*((?:[a-zA-Z]|\d|\.)+)\s-\s((?:\w|\W)+)/;
                var res = d.toString().match(parser);
                logger.info('parse: ', res)
                logger.debug('error: ', JSON.stringify(d.toString(), null, 2));
                //Parse the log
                var log = JSON.stringify(res, null, 2);
                if (log != null)
                {
                  var parsed = {type: 'log', data: log};
                  setImmediate(
                    function()
                    {
                        stderrCB(parsed);
                    });
                }
                if (res[7].indexOf('%') > -1)
                {
                  parsed = { type: 'percent', data: res[7].match(/\%(d+)/)[1]}
                  setImmediate(
                    function()
                    {
                      stderrCB(parsed);
                    });
                }
                //{type: 'progress', data: '95'};
            });
        pig.on('close',
            function(code)
            {
                logger.debug('close: ', code);
                //Parse the log
                var parsed = {type: 'close', data: code};
                logger.debug(parsed);
            setImmediate(
                    function()
                    {
                        stdoutCB(parsed);
                    });
            });
    }
};
