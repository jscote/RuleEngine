/**
 * Created by jscote on 3/8/14.
 */

var p = require('path');
var Rule = require(p.resolve(__dirname + '/../Rule')).Rule;
var RuleCondition = require(p.resolve(__dirname + '/../Rule')).RuleCondition;
var EvaluationContext = require(p.resolve(__dirname + '/../Rule')).EvaluationContext;
var ruleEngine = require(p.resolve(__dirname + '/../RuleEvaluator'));

global.Injector = require('jsai-injector');

ruleEngine.RuleEngine.config({
    ruleSetPath: p.resolve(__dirname + '/../SampleRules/'),
    rulePath: p.resolve(__dirname + '/../SampleRules/')
});

var Person = function (age, gender, maritalStatus) {
    this.age = age;
    this.gender = gender;
    this.maritalStatus = maritalStatus
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
    testRuleEngineCanEvaluateMultipleRuleSets: function (test) {


        var ruleEngine = Injector.resolve({target: 'ruleEngine'});

        test.ok(ruleEngine);

        ruleEngine.evaluate(new Person(30, 'F'), ['SomeTest', 'SomeOtherTest']).then(function (result) {
            test.ok(result.isTrue);
            test.ok(result.evaluationContext.isEvaluated('SomeTest_female'));
            test.ok(result.evaluationContext.isTrue('SomeTest_female'));

            test.ok(result.evaluationContext.isEvaluated('SomeTest_female20to40'));
            test.ok(result.evaluationContext.isTrue('SomeTest_female20to40'));

            test.ok(result.evaluationContext.isEvaluated('SomeOtherTest_female10to50'));
            test.ok(result.evaluationContext.isTrue('SomeOtherTest_female10to50'));

            test.done();
        });

    },
    testRuleEngineCanStopOnFirstTrueRule: function (test) {


        var ruleEngine = Injector.resolve({target: 'ruleEngine'});

        test.ok(ruleEngine);

        ruleEngine.evaluate(new Person(30, 'F', 'Single'), ['SomeTestStopOnFirstTrueRule', 'SomeOtherTest']).then(function (result) {
            test.ok(result.isTrue, 'overall it should be false');
            test.ok(result.evaluationContext.isEvaluated('SomeTestStopOnFirstTrueRule_female'), 'SomeTestStopOnFirstTrueRule_female should be evaluated');
            test.ok(result.evaluationContext.isTrue('SomeTestStopOnFirstTrueRule_female'), 'SomeTestStopOnFirstTrueRule_female should be true');

            test.ok(!result.evaluationContext.isEvaluated('SomeTestStopOnFirstTrueRule_female20to40'), 'SomeTestStopOnFirstTrueRule_female20to40 should be evaluated');
            test.throws(function () {
                test.ok(result.evaluationContext.isTrue('SomeTestStopOnFirstTrueRule_female20to40'));
            });

            test.ok(!result.evaluationContext.isEvaluated('SomeTestStopOnFirstTrueRule_maritalStatus'), 'SomeTestStopOnFirstTrueRule_maritalStatus should be evaluated');
            test.throws(function () {
                test.ok(!result.evaluationContext.isTrue('SomeTestStopOnFirstTrueRule_maritalStatus'));
            });

            test.ok(result.evaluationContext.isEvaluated('SomeOtherTest_female10to50'), 'SomeOtherTest_female10to50 should be evaluated');
            test.ok(result.evaluationContext.isTrue('SomeOtherTest_female10to50'));


            test.done();
        });

    },
    testRuleEngineCanStopOnFalseRule: function (test) {


        var ruleEngine = Injector.resolve({target: 'ruleEngine'});

        test.ok(ruleEngine);

        ruleEngine.evaluate(new Person(30, 'F', 'Single'), ['SomeTestStopOnFirstFalseRule', 'SomeOtherTest']).then(function (result) {
            test.ok(!result.isTrue);
            test.ok(result.evaluationContext.isEvaluated('SomeTestStopOnFirstFalseRule_female'), 'SomeTestStopOnFirstTrueRule_female should be evaluated');
            test.ok(result.evaluationContext.isTrue('SomeTestStopOnFirstFalseRule_female'), 'SomeTestStopOnFirstTrueRule_female should be true');

            test.ok(!result.evaluationContext.isEvaluated('SomeTestStopOnFirstFalseRule_female20to40'), 'SomeTestStopOnFirstTrueRule_female20to40 should be evaluated');
            test.throws(function () {
                test.ok(result.evaluationContext.isTrue('SomeTestStopOnFirstFalseRule_female20to40'));
            });

            test.ok(result.evaluationContext.isEvaluated('SomeTestStopOnFirstFalseRule_married'), 'SomeTestStopOnFirstTrueRule_maritalStatus should be evaluated');
            //test.throws(function () {
            test.ok(!result.evaluationContext.isTrue('SomeTestStopOnFirstFalseRule_married'));
            //});

            test.ok(result.evaluationContext.isEvaluated('SomeOtherTest_female10to50'), 'SomeOtherTest_female10to50 should be evaluated');
            test.ok(result.evaluationContext.isTrue('SomeOtherTest_female10to50'));


            test.done();
        });

    },
    testLoadInvalidRuleSets: function (test) {
        var ruleEngine = Injector.resolve({target: 'ruleEngine'});

        test.ok(ruleEngine);

        ruleEngine.evaluate(new Person(30, 'F', 'Single'), ['blah']).then(function (result) {
            test.ok(false, "should not pass");
            test.done();

        }).fail(function (error) {
                test.ok(true, "should generate a failure");
                test.done();
            }
        );

    }
};