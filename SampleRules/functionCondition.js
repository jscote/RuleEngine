/**
 * Created by jean-sebastiencote on 12/6/14.
 */

var p = require('path');
var q = require('q');

(function(Rule, RuleCondition) {


    var fCondition = function(evalContext) {
        var dfd = q.defer();

        process.nextTick(function(){
            dfd.resolve({isTrue : evalContext.fact.gender != 'M'});
        });

        return dfd.promise;
    };

    module.exports = new Rule({
                ruleName: 'functionCondition',
                condition: new RuleCondition(fCondition)

            });


})(
    require(p.resolve(__dirname + '/../Rule')).Rule,
    require(p.resolve(__dirname + '/../Rule')).RuleCondition);
