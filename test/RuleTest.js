/**
 * Created by jscote on 3/8/14.
 */

var p = require('path');
var q = require('q');

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
        var c = new RuleCondition('isTrue = evaluationContext.value;');

        c.evaluateCondition({value: true}).then(function(result){
            test.ok(result);
            test.done();
        });


    },
    testRuleConditionWithCombineSpecificationAreSatisfied: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        }

        var c = new RuleCondition("isTrue = evaluationContext.fact.gender !='M' && evaluationContext.fact.age >=20 && evaluationContext.fact.age <=40");

        var evaluationContext = new EvaluationContext({fact: new Person(30, 'F')});

        c.evaluateCondition(evaluationContext).then(function(result) {
            test.ok(result);
            test.done();
        });
    },
    testRuleConditionWithCombineSpecificationAreNotSatisfied: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };
        var c = new RuleCondition("isTrue = evaluationContext.fact.gender !='M' && evaluationContext.fact.age >=20 && evaluationContext.fact.age <=40");

        var evaluationContext = new EvaluationContext({fact: new Person(30, 'M')});

        c.evaluateCondition(evaluationContext).then(function(result) {
            test.ok(!result);
            test.done();
        });
    },
    testRuleWithCombineSpecificationAreNotMarkedAsEvaluatedPriorToEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };


        var r = new Rule({ruleName: 'test', condition: new RuleCondition("isTrue = evaluationContext.fact.gender !='M' && evaluationContext.fact.age >=20 && evaluationContext.fact.age <=40")});

        var evalCtx = new EvaluationContext({fact: new Person(30, 'F')});

        test.ok(!evalCtx.isEvaluated(r.ruleName), 'is not evaluated yet');

        r.evaluateCondition(evalCtx).then(function(result){
            test.ok(evalCtx.isEvaluated(r.ruleName), 'has been evaluated');
            test.ok(result);
            test.done();
        });

    },
    testRuleDoesNotThrowWhenIsTrueIsCheckedAfterEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };


        var r = new Rule({ruleName: 'test', condition: new RuleCondition("isTrue = evaluationContext.fact.gender !='M' && evaluationContext.fact.age >=20 && evaluationContext.fact.age <=40")});

        var evalCtx = new EvaluationContext({fact: new Person(30, 'F')});

        r.evaluateCondition(evalCtx).then(function(result){
            test.ok(evalCtx.isTrue(r.ruleName));
            test.ok(result);
            test.done();
        });


    },
    rule_withFunctionForRuleCondition_evaluatesToTrue : function(test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        };

        var fCondition = function(evalContext) {
            var dfd = q.defer();

            process.nextTick(function(){
                dfd.resolve({isTrue : evalContext.fact.gender != 'M'});
            });

            return dfd.promise;
        };

        var r = new Rule({ruleName: 'test', condition: new RuleCondition(fCondition)});

        var evalCtx = new EvaluationContext({fact: new Person(30, 'F')});

        r.evaluateCondition(evalCtx).then(function(result){
            test.ok(evalCtx.isTrue(r.ruleName));
            test.ok(result);
            test.done();
        });
    }
};