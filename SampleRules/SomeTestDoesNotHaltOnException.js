/**
 * Created by jean-sebastiencote on 12/6/14.
 */
var p = require('path');

(function (RuleSet, Rule, RuleCondition) {

    module.exports = new RuleSet({
        ruleSetName: 'SomeTestDoesNotHaltOnException',
        haltOnException: true,
        rules: {
            "female": {},
            "blowit": {},
            "female20to40": {}


        }
    });


})(require(p.resolve(__dirname + '/../RuleEvaluator')).RuleSet,
    require(p.resolve(__dirname + '/../Rule')).Rule,
    require(p.resolve(__dirname + '/../Rule')).RuleCondition);