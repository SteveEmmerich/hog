/*
 * @license MIT
 * @file
 * @copyright KeyW Corporation 2016
 */


'use strict';

angular.module('hog')

.controller('EditComplexCtrl',
  function ($scope, $window, $timeout, $log, $state, $stateParams, HogTemplates, Runner, lodash, Settings, $mdToast,  NgTableParams, $interval, Pig, $mdDialog, PigCompleter, FileSaver, Blob)
    {
      var vm = this;

      var ctx;
      var myNewChart;

      // Graphs are not displayed initially
      vm.outputs = [];
      vm.graph_data = false;

      vm.edited = false;
      vm.name_edited = false;
      vm.args_edited = false;
      vm.script_edited = false;

      vm.taskList = [];
      vm.running = false;

      Pig.on('tracker:update', function (data)
          {
            vm.taskList = data;
          });

      Pig.on('run:finished', function ()
          {
            vm.running = false;
          });

      /**
       * Description
       * @method ots
       * @param {} o
       */
      vm.ots = function (o)
      {
        return JSON.stringify(o);
      }

      // Initialize chart values
      vm.labels = [];
      vm.series = ['Series A'];
      vm.data = [];


      // Inject data from PIG script output to chart
      /**
       * Description
       * @method getData
       * @param {} newData
       */
      vm.getData = function(newData)
      {
        var t = JSON.parse(newData);
        vm.data[0] = t;
      };

      var _ = lodash;
      angular.extend(this, {
        name: 'EditComplexCtrl',
        running: false
      });

      Runner.get($stateParams.id)
        .then(
            function(data)
            {
              vm.script = data.json;

              vm.latestVersion = vm.currentVersion = vm.version = vm.script.version;
              vm.versions = lodash.filter(vm.script.history, 'version');
              vm.version = vm.currentVersion = vm.versions[vm.versions.length-1];
              if(typeof vm.script.args[0] != 'string')
              {
                var strfy = _.flatMap(vm.script.args,
                  function(n)
                  {
                    return [n.arg, n.input];
                  });

                vm.args = strfy.join(" ").trim();
              }
              else
              {
                vm.args = vm.script.args.join(" ");
              }
              vm.script_data = vm.script.data;
              $scope.script_data = vm.script_data;
              $scope.script_name = vm.script.name;
              $scope.script_args = vm.args;

            });
      /**
       * Description
       * @method getVersion
       * @param {} idx
       */
      vm.getVersion = function(idx)
      {
        vm.leftIdx = vm.versions.length-1;
        vm.rightIdx = lodash.findIndex(vm.versions, ['version', vm.version.version]);
        var dmp = new $window.diff_match_patch();

            var rightDiff = vm.versions[vm.rightIdx].diff;
            var rt = _.transform(rightDiff, function(result, e) {
               if(e[0] == 0)
               {
                 result.push(e[1]);
                 return true;
               }
              }, []);
            rt = rt.join('');
            var rp = dmp.patch_make(rightDiff);
            var rs = dmp.patch_apply(rp, rt);
            $scope.script_data = rs[0];
      }
      /**
       * Description
       * @method bumpVersion
       */
      vm.bumpVersion = function()
      {
        Runner.bumpVersion(vm.script._id)
          .then(
            function(data)
            {
              $timeout(function()
              {
                vm.script.version = vm.latestVersion = vm.currentVersion = vm.version['version'] = data.json;
              });
            },
            function(err)
            {
              console.log(err);
            });
      }
      vm.modes = ['Pig_Latin'];
      vm.themes = ['monokai', 'twilight', 'none'];
      vm.mode = vm.modes[0];
      vm.theme = vm.themes[0];
      vm.selectedArgs = [];
      vm.editorModel = '';
      vm.progress = 0;

      vm.info_outputs = [];
      vm.logs = [];
      vm.warnings = [];
      vm.errors = [];

      /**
       * Description
       * @method onEditorLoad
       * @param {} _ace
       */
      vm.onEditorLoad = function(_ace)
      {
        /*
         * set vim keybindings
         */
        //_ace.setKeyboardHandler("ace/keyboard/vim");

        /**
         * Description
         * @method modeChanged
         */
        vm.modeChanged = function () {
          console.log('changing mode to: ' + vm.mode.toLowerCase());
          _ace.getSession().setMode("ace/mode/" + vm.mode.toLowerCase());
        };
        _ace.$blockScrolling = Infinity;
        var langTools = ace.require("ace/ext/language_tools");
        langTools.addCompleter(PigCompleter);
      };
      /**
       * Description
       * @method onEditorChange
       * @param {} _ace
       */
      vm.onEditorChange = function(_ace)
      {

      };




      vm.editorOptions = {
        advanced: {
          enableSnippets: false,
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true
        },
        mode: vm.mode.toLowerCase(),
        /**
         * Description
         * @method onLoad
         * @param {} _ace
         */
        onLoad: function(_ace) {vm.onEditorLoad(_ace);},
        useWrapMode: false,
        showGutter: true,
        theme: vm.theme,
        firstLineNumber: 1,
        onChange: vm.onEditorChange()
      };



      /**
       * Description
       * @method downloadScript
       */
      vm.downloadScript = function()
      {
        var data = new Blob([vm.script.data], {type: 'text/plain;charset=utf-8'});
        FileSaver.saveAs(data, vm.script.name + ".pig");
      };




      /**
       * Description
       * @method deleteScript
       * @param {} ev
       */
      vm.deleteScript = function(ev)
      {
        $mdDialog.show({
          controller: HogTemplates.DeleteDialogController,
          templateUrl: HogTemplates.deleteDialogTemplate,
          clickOutsideToClose: true,
          parent: angular.element(document.body),
          targetEvent: ev,
          locals: {
            script_id: vm.script._id,
            /**
             * Description
             * @method cb
             * @param {} data
             */
            cb: function (data)
            {
              $state.go('^.list');
            }
          },
        });
      };




      /**
       * Description
       * @method save
       * @param {} graph
       * @param {} numOutput
       * @param {} cb
       */
      vm.save = function(graph, numOutput, cb)
      {
        if (vm.script.type == 'simple')
        {
          vm.script._id = null;
          vm.script.nodes = [];
          vm.script.links = [];
          vm.script.type = 'complex';
          vm.script.data = $scope.script_data;
          vm.script.args = $scope.script_args.split(" ");
          vm.script.graph_type = graph || vm.script.graph_type;
          vm.script.graph_count = numOutput || vm.script.graph_count;
          vm.script.name = $scope.script_name.replace(/[\s,\.]/g, "_") + "_complex";

          Runner.create(vm.script)
            .then(
              function(data)
              {
                vm.script = data.json;

                $mdToast.show(
                  $mdToast.simple()
                  .content('Script Saved!')
                  .hideDelay(3000)
                );

                if (cb)
                {
                  cb();
                }

                $state.go('home.complex.edit', {id: vm.script._id});
              },
              function(err)
              {
                $log.error('error: ' +err);
              });
        }
        else
        {
          vm.script.type = 'complex';
          vm.script.data = $scope.script_data;
          vm.script.args = $scope.script_args.split(" ");
          vm.script.graph_type = graph || vm.script.graph_type;
          vm.script.graph_count = numOutput || vm.script.graph_count;
          vm.script.name = $scope.script_name.replace(/[\s,\.]/g, "_");

          Runner.update(vm.script)
            .then(
              function(data)
              {
                $log.debug('saved: ' + data);

                vm.script = data.json;
                vm.args = vm.script.args.join(" ");

                $scope.script_args = vm.args;
                $scope.script_data = vm.script.data;
                $scope.script_name = vm.script.name;

                vm.versions = lodash.filter(vm.script.history, 'version');

                vm.version = vm.currentVersion = vm.versions[vm.versions.length-1];
                console.log('vm1: ', vm);
                vm.latestVersion = vm.script.version;
                console.log('vm: ', vm);
                vm.edited = false;
                vm.name_edited = false;
                vm.args_edited = false;
                vm.script_edited = false;

                $mdToast.show(
                  $mdToast.simple()
                  .content('Script Saved!')
                  .hideDelay(3000)
                );

                if (cb)
                {
                  cb();
                }
              },
              function(err)
              {
                $log.error('error: ' +err);
              });
        }
      };



      /**
       * Description
       * @method saveAndRun
       */
      vm.saveAndRun = function()
      {
        vm.save(null, null, vm.run);
      };


      /**
       * Description
       * @method kill
       */
      vm.kill = function()
      {
        Runner.kill(vm.script._id)
          .then(
              function(data)
              {
                console.log("Killed: " + JSON.stringify(data, null, 2));
              });
      };

      /**
       * Description
       * @method run
       */
      vm.run = function()
      {
        vm.taskList = [];
        vm.pigList = [];
        vm.running = true;
        vm.graph_data = false;

        $log.debug('running: ', vm.script._id);

        vm.info_outputs = [];
        vm.outputs = [];
        vm.logs = [];
        vm.warnings = [];
        vm.errors = [];

        Runner.run(vm.script._id)
          .then(
              function(end)
              {
                console.log("END");
              },
              function(error)
              {
                console.log("ERROR: " + JSON.stringify(error));
              },
              function(update)
              {
                if (update.type == 'progress')
                {
                  vm.progress = update.data.json;
                }
                else if (update.type == 'log')
                {
                  if (update.data.json !== "null")
                  {
                    vm.logs.push(update.data.json);
                    vm.info_outputs.push({data: update.data.json, type: "log", color: {'color': 'blue.400'}});
                  }
                }
                else if (update.type == 'warning')
                {
                  if (update.data.json !== "null")
                  {
                    vm.warnings.push(update.data.json);
                    vm.info_outputs.push({data: update.data.json, type: "warning", color: {'color': 'orange.400'}});
                  }
                }
                else if (update.type == 'output')
                {
                  if (update.data.json !== "null")
                  {
                    vm.outputs.push(update.data.json);
                    vm.info_outputs.push({data: update.data.json, type: "output", color: {'color': 'green.400'}});

                    HogTemplates.parseOutput(update.data.json, vm.pigList);
                  }
                }
                else if (update.type == 'error')
                {
                  vm.errors.push(update.data.json);
                  vm.info_outputs.push({data: update.data.json, type: "error", color: {'color': 'red.400'}});
                }
              });
      };



      /**
       * Description
       * @method exists
       * @param {} item
       * @param {} list
       */
      vm.exists = function(item, list)
      {
        if(angular.isDefined(list) && angular.isDefined(item))
        {
          return _.findIndex(list, 'arg', item.arg) > -1;
        }
        else
        {
          return false;
        }
      };




      /**
       * Description
       * @method toggle
       * @param {} item
       * @param {} list
       */
      vm.toggle = function(item, list)
      {
        if(angular.isDefined(list) && angular.isDefined(item))
        {
          var idx = _.findIndex(list, 'arg', item.arg);
          if (idx > -1) list.splice(idx, 1);
          else list.push(item);
        }
      };




      /**
       * Description
       * @method index
       * @param {} list
       * @param {} item
       */
      vm.index = function(list, item)
      {
        var indx = _.findIndex(list, 'arg', item);
        return indx;
      };


      $scope.$watch("script_name", function(newValue, oldValue)
      {
        if (vm.script)
        {
          if (vm.script.name !== "undefined")
          {
            if (newValue !== vm.script.name)
            {
              vm.name_edited = true;
            }
            else
            {
              vm.name_edited = false;
            }
            updateEdit();
          }
        }
      });




      $scope.$watch("script_args", function(newValue, oldValue)
      {
        if (vm.args !== "undefined")
        {
          if (newValue !== vm.args)
          {
            vm.args_edited = true;
          }
          else
          {
            vm.args_edited = false;
          }
          updateEdit();
        }
      });




      $scope.$watch("script_data", function(newValue, oldValue)
      {
        if (vm.script)
        {
          if (vm.script.data !== "undefined")
          {
            if (newValue !== vm.script.data)
            {
              vm.script_edited = true;
            }
            else
            {
              vm.script_edited = false;
            }
            updateEdit();
          }
        }
      });



      /**
       * Description
       * @method updateEdit
       */
      function updateEdit ()
      {
        vm.edited = vm.name_edited || vm.args_edited || vm.script_edited;
      };
      /**
       * Description
       * @method openVersionDifferenceInfo
       * @param {} ev
       */
      vm.openVersionDifferenceInfo = function(ev)
      {
        $mdDialog.show({
          templateUrl: HogTemplates.versionDiffTemplate,
          controller: HogTemplates.VersionDiffController,
          clickOutsideToClose: true,
          parent: angular.element(document.body),
          targetEvent: ev,
          bindToController: true,
          locals: {
            vm: {
              versions: vm.versions,
              leftIdx: vm.leftIdx,
              rightIdx: vm.rightIdx,
              latest: vm.latestVersion
            }
          },
        })
        .then(
          function(data)
          {
            if(data.revertIdx >= 0 && data.revertIdx < vm.versions.length)
            {
              $timeout(
                function()
                {
                  $scope.script_data = data.source;
                 vm.version = vm.currentVersion = vm.versions[data.revertIdx];
                });
            }
          });
      };

      /**
       * Description
       * @method openGraphInfo
       * @param {} ev
       * @param {} graph_data
       * @param {} script
       */
      vm.openGraphInfo = function(ev, graph_data, script)
      {
        $mdDialog.show({
          templateUrl: HogTemplates.graphInfoTemplate,
          controller: HogTemplates.GraphInfoController,
          clickOutsideToClose: true,
          parent: angular.element(document.body),
          targetEvent: ev,
          bindToController: true,
          locals: {
            graph_data: graph_data || vm.pigList,
            script: script || vm.script
          },
        });
      };



      /**
       * Description
       * @method openInfo
       * @param {} ev
       * @param {} filter_type
       */
      vm.openInfo = function(ev, filter_type)
      {
        $mdDialog.show({
          templateUrl: HogTemplates.outputInfoTemplate,
          controller: HogTemplates.InfoController,
          clickOutsideToClose: true,
          parent: angular.element(document.body),
          targetEvent: ev,
          locals: {
            script_name: vm.script.name,
            info_outputs: vm.info_outputs,
            outputs: vm.outputs,
            logs: vm.logs,
            warnings: vm.warnings,
            errors: vm.errors,
            filter_type: filter_type,
            graph_data: vm.pigList,
            openGraphInfo: vm.openGraphInfo,
            script_id: null
          },
        });
      };



      /**
       * Description
       * @method openSettings
       * @param {} ev
       */
      vm.openSettings = function(ev)
      {

        $mdDialog.show({
          controller: HogTemplates.SettingsController,
          templateUrl: HogTemplates.complexEditSettingsTemplate,
          clickOutsideToClose: true,
          parent: angular.element(document.body),
          targetEvent: ev,
          locals:{vm:vm},

        });

      };

    });
