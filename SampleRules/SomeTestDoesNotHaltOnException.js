/**
 * Created by jean-sebastiencote on 12/6/14.
 */
var p = require('path');

(function (RuleSet, Rule, RuleCondition) {

    module.exports = new RuleSet({
        ruleSetName: 'SomeTestDoesNotHaltOnException',
        haltOnException: true,
        rules: {
            "female": new Rule({
                ruleName: 'female',
                condition: new RuleCondition("isTrue = evaluationContext.fact.gender !='M'")

            }),
            "blowit": new Rule({
                ruleName: 'blowit',
                condition: new RuleCondition("throw(Error('Test Error'))")

            }),
            "female20to40": new Rule({
                ruleName: 'female20to40',
                condition: new RuleCondition("isTrue = evaluationContext.fact.gender !='M' && evaluationContext.fact.age >=20 && evaluationContext.fact.age <=40")
            })


        }
    });


})(require(p.resolve(__dirname + '/../RuleEvaluator')).RuleSet,
    require(p.resolve(__dirname + '/../Rule')).Rule,
    require(p.resolve(__dirname + '/../Rule')).RuleCondition);