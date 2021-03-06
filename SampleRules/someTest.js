/**
 * Created by jean-sebastiencote on 12/6/14.
 */

var p = require('path');

(function (RuleSet, Rule, RuleCondition) {

    module.exports = new RuleSet({
        ruleSetName: 'SomeTest',
        haltOnException: false,
        rules: {
            "female": new Rule({
                ruleName: 'female',
                condition: new RuleCondition("isTrue = evaluationContext.fact.gender !='M'")

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
