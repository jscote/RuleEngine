/**
 * Created by jean-sebastiencote on 12/6/14.
 */

var p = require('path');

(function (RuleSet, Rule, RuleCondition) {

    module.exports = new RuleSet({
        ruleSetName: 'SomeTestStopOnFirstTrueRule',
        haltOnFirstTrueRule: true,
        rules: {
            "female": {},
            "female20to40": {},
            "married": {}

        }
    });


})(require(p.resolve(__dirname + '/../RuleEvaluator')).RuleSet,
    require(p.resolve(__dirname + '/../Rule')).Rule,
    require(p.resolve(__dirname + '/../Rule')).RuleCondition);