/*
 * @license MIT
 * @file
 * @copyright KeyW Corporation 2016
 */


'use strict';

angular.module('hog')
  .controller('LandingCtrl', function ($state, Runner) {

    var vm = this;
    Runner.recent(5, 'simple')
      .then(
        function(data)
        {
          vm.simplePigs = data.json;
        });

    Runner.recent(5, 'complex')
      .then(
        function(data)
        {
          vm.complexPigs = data.json;
          console.log('piggies', vm.complexPigs, 'data', data.json);
        });

    /**
     * Description
     * @method editComplex
     * @param {} id
     */
    vm.editComplex = function(id)
    {
      $state.go('home.complex.edit', {id: id});
    };

    /**
     * Description
     * @method editSimple
     * @param {} id
     */
    vm.editSimple = function(id)
    {
      $state.go('home.simple.edit', {id: id});
    };

    angular.extend(vm, {
      name: 'LandingCtrl',
    });

  });
