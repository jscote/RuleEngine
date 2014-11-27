/**
 * Created by jscote on 3/8/14.
 */

var p = require('path');

//var Predicate = require(p.resolve(__dirname + '../../../server/Predicate/Predicate/')).Predicate;
//var predicateFactory = require(p.resolve(__dirname + '../../../server/Predicate/Predicate/')).predicateFactory;
//var PredicateSpecification = require(p.resolve(__dirname + '../../../server/Predicate/Specification/')).PredicateSpecification;
//var Specification = require(p.resolve(__dirname + '../../../server/Predicate/Specification/')).Specification;
var Rule = require(p.resolve(__dirname + '/../Rule')).Rule;
var RuleCondition = require(p.resolve(__dirname + '/../Rule')).RuleCondition;
var EvaluationContext = require(p.resolve(__dirname + '/../Rule')).EvaluationContext;

module.exports = {
    setUp: function (callback) {
        callback();
    },
    tearDown: function (callback) {
        // clean up
        callback();
    },
    testRuleMustHaveANameAndARuleCondition: function (test) {

        test.doesNotThrow(function () {
            var r = new Rule({ruleName: 'HasAName', condition: new RuleCondition("return true;")});
        });

        test.done();
    },
    testRuleMustHaveANameAndARuleConditionThatIsAPredicate: function (test) {

        test.throws(function () {
            var r = new Rule({ruleName: 'HasAName', condition: new RuleCondition()});
        });

        test.done();
    },
    testRuleMustHaveANameAndARuleConditionThatIsNotAFunction: function (test) {

        test.doesNotThrow(function () {
            var r = new Rule({ruleName: 'HasAName', condition: new RuleCondition('')});
        });

        test.done();
    },
    testRuleConditionMustHaveAPredicate: function (test) {
        test.doesNotThrow(function () {
            var c = new RuleCondition('');
        });

        test.done();
    },
    testRuleConditionMustHaveAPredicateThatIsEvaluated: function (test) {
        var c = new RuleCondition('isTrue = fact.value;');

        c.evaluateCondition({},{value: true}).then(function(result){
            test.ok(result);
            test.done();
        });


    },
    testRuleConditionWithCombineSpecificationAreSatisfied: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        }

        var c = new RuleCondition("isTrue = fact.gender !='M' && fact.age >-20 && fact.age <=40");

        c.evaluateCondition({}, new Person(30, 'F')).then(function(result) {
            test.ok(result);
            test.done();
        });
    },
    testRuleConditionWithCombineSpecificationAreNotSatisfied: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };

        var c = new RuleCondition("isTrue = fact.gender !='M' && fact.age >-20 && fact.age <=40");

        c.evaluateCondition({}, new Person(30, 'M')).then(function(result) {
            test.ok(!result);
            test.done();
        });
    },
    testRuleWithCombineSpecificationAreNotMarkedAsEvaluatedPriorToEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };


        var r = new Rule({ruleName: 'test', condition: new RuleCondition("isTrue = fact.gender !='M' && fact.age >-20 && fact.age <=40")});

        var evalCtx = new EvaluationContext();

        test.ok(!evalCtx.isEvaluated(r.ruleName), 'is not evaluated yet');

        r.evaluateCondition(evalCtx, new Person(30, 'F')).then(function(result){
            test.ok(evalCtx.isEvaluated(r.ruleName), 'has been evaluated');
            test.ok(result);
            test.done();
        });

    },
    /*testRuleThrowsWhenCheckingIsTruePriorToEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };

        test.throws(function(){
            var r = new Rule({ruleName: 'test', condition: new RuleCondition("isTrue = fact.gender !='M' && fact.age >-20 && fact.age <=40")});
            r.evaluationContext.ruleStates[r.ruleName].isTrue;
        });
        test.done();
    },*/
    testRuleDoesNotThrowWhenIsTrueIsCheckedAfterEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };


        var r = new Rule({ruleName: 'test', condition: new RuleCondition("isTrue = fact.gender !='M' && fact.age >-20 && fact.age <=40")});

        var evalCtx = new EvaluationContext();

        r.evaluateCondition(evalCtx, new Person(30, 'F')).then(function(result){
            test.ok(evalCtx.isTrue(r.ruleName));
            test.ok(result);
            test.done();
        });


    }
};