/**
 * Created by jscote on 3/8/14.
 */

var p = require('path');
var Rule = require(p.resolve(__dirname + '/../Rule')).Rule;
var RuleCondition = require(p.resolve(__dirname + '/../Rule')).RuleCondition;
var EvaluationContext = require(p.resolve(__dirname + '/../Rule')).EvaluationContext;
var ruleEngine = require(p.resolve(__dirname + '/../RuleEvaluator'));

global.Injector = require('jsai-injector');

var Person = function (age, gender) {
    this.age = age;
    this.gender = gender;
};

module.exports = {
    setUp: function (callback) {
        callback();
    },
    tearDown: function (callback) {
        // clean up
        callback();
    },
    testCanInjectRuleEngine: function (test) {

        var ruleEngine = Injector.resolve({target: 'ruleEngine'});

        test.ok(ruleEngine);

        test.done();
    },
    testCanResolveRuleSetWithRuleEngine: function (test) {


        var ruleEngine = Injector.resolve({target: 'ruleEngine'});

        test.ok(ruleEngine);

        ruleEngine.evaluate(new Person(30, 'F'), ['SomeTest']).then(function(result) {
            test.ok(result);
            test.done();
        });




    }

};