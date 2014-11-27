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
            var r = new Rule({ruleName: 'HasAName', condition: new RuleCondition(function (item) {
                return item.value;
            })});
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

        test.throws(function () {
            var r = new Rule({ruleName: 'HasAName', condition: new RuleCondition('')});
        });

        test.done();
    },
    testRuleConditionMustHaveAPredicate: function (test) {
        test.doesNotThrow(function () {
            var c = new RuleCondition(function (item) {
                return item.value;
            });
        });

        test.done();
    },
    testRuleConditionMustHaveAPredicateThatIsEvaluated: function (test) {
        var c = new RuleCondition(function (item) {
            return item.value;
        });

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

        var genderSpec = new PredicateSpecification(function (item) {
            return item.gender == 'M';
        }, Person);

        var ageGreaterThanOrEqual20Spec = new PredicateSpecification(function (item) {
            return item.age >= 20;
        }, Person);

        var ageLessThanOrEqual40Spec = new PredicateSpecification(function (item) {
            return item.age <= 40;
        }, Person);

        var ageBetween20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageGreaterThanOrEqual20Spec, ageLessThanOrEqual40Spec).isSatisfiedBy(item);
        }, Person);


        var femaleBetweenAge20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageBetween20And40Spec, Specification.not(genderSpec)).isSatisfiedBy(item);
        }, Person);

        var c = new RuleCondition(femaleBetweenAge20And40Spec);

        c.evaluateCondition(new Person(30, 'F')).then(function(result) {
            test.ok(result);
            test.done();
        });
    },
    testRuleWithCombineSpecificationAreSatisfied: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        }

        var genderSpec = new PredicateSpecification(function (item) {
            return item.gender == 'M';
        }, Person);

        var ageGreaterThanOrEqual20Spec = new PredicateSpecification(function (item) {
            return item.age >= 20;
        }, Person);

        var ageLessThanOrEqual40Spec = new PredicateSpecification(function (item) {
            return item.age <= 40;
        }, Person);

        var ageBetween20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageGreaterThanOrEqual20Spec, ageLessThanOrEqual40Spec).isSatisfiedBy(item);
        }, Person);


        var femaleBetweenAge20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageBetween20And40Spec, Specification.not(genderSpec)).isSatisfiedBy(item);
        }, Person);

        var r = new Rule({ruleName: 'test', condition: new RuleCondition(femaleBetweenAge20And40Spec)});

        r.evaluateCondition(new Person(30, 'F')).then(function(result) {
            test.ok(result);
            test.done();
        });


    },
    testRuleWithCombineSpecificationAreNotMarkedAsEvaluatedPriorToEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        }

        var genderSpec = new PredicateSpecification(function (item) {
            return item.gender == 'M';
        }, Person);

        var ageGreaterThanOrEqual20Spec = new PredicateSpecification(function (item) {
            return item.age >= 20;
        }, Person);

        var ageLessThanOrEqual40Spec = new PredicateSpecification(function (item) {
            return item.age <= 40;
        }, Person);

        var ageBetween20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageGreaterThanOrEqual20Spec, ageLessThanOrEqual40Spec).isSatisfiedBy(item);
        }, Person);


        var femaleBetweenAge20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageBetween20And40Spec, Specification.not(genderSpec)).isSatisfiedBy(item);
        }, Person);

        var r = new Rule({ruleName: 'test', condition: new RuleCondition(femaleBetweenAge20And40Spec)});

        test.ok(!r.isEvaluated, 'is not evaluated yet')

        r.evaluateCondition(new Person(30, 'F')).then(function(result){
            test.ok(r.isEvaluated, 'has been evaluated')
            test.done();
        });

    },
    testRuleThrowsWhenCheckingIsTruePriorToEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        }

        var genderSpec = new PredicateSpecification(function (item) {
            return item.gender == 'M';
        }, Person);

        var ageGreaterThanOrEqual20Spec = new PredicateSpecification(function (item) {
            return item.age >= 20;
        }, Person);

        var ageLessThanOrEqual40Spec = new PredicateSpecification(function (item) {
            return item.age <= 40;
        }, Person);

        var ageBetween20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageGreaterThanOrEqual20Spec, ageLessThanOrEqual40Spec).isSatisfiedBy(item);
        }, Person);


        var femaleBetweenAge20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageBetween20And40Spec, Specification.not(genderSpec)).isSatisfiedBy(item);
        }, Person);

        test.throws(function(){
            var r = new Rule({ruleName: 'test', condition: new RuleCondition(femaleBetweenAge20And40Spec)});
            r.isTrue;
        });
        test.done();
    },
    testRuleDoesNotThrowWhenIsTrueIsCheckedAfterEvaluation: function (test) {

        var Person = function (age, gender) {
            this.age = age;
            this.gender = gender;
        }

        var genderSpec = new PredicateSpecification(function (item) {
            return item.gender == 'M';
        }, Person);

        var ageGreaterThanOrEqual20Spec = new PredicateSpecification(function (item) {
            return item.age >= 20;
        }, Person);

        var ageLessThanOrEqual40Spec = new PredicateSpecification(function (item) {
            return item.age <= 40;
        }, Person);

        var ageBetween20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageGreaterThanOrEqual20Spec, ageLessThanOrEqual40Spec).isSatisfiedBy(item);
        }, Person);

        var femaleBetweenAge20And40Spec = new PredicateSpecification(function (item) {
            return Specification.and(ageBetween20And40Spec, Specification.not(genderSpec)).isSatisfiedBy(item);
        }, Person);

        var r = new Rule({ruleName: 'test', condition: new RuleCondition(femaleBetweenAge20And40Spec)});

        test.throws(function(){
            var t = r.isTrue;
        });

        r.evaluateCondition(new Person(30, 'F')).then(function(result){
            test.ok(r.isTrue);
            test.done();
        });


    }
};